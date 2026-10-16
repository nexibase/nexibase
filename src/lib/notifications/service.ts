import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAllPlugins } from '@/lib/plugins'
import { getNotificationConfig, configReadiness } from './config'
import { encrypt, encryptionReady } from './crypto'
import { CHANNELS, CORE_EVENTS, PREF_FIELDS, canUseLiveDelivery, escapeHtml, maskRecipient, normalizePhone, renderTemplate, validPhone, type Channel } from './policy'
import type { DeliveryPayload } from './providers'

type Db = Prisma.TransactionClient
export interface EventDefinition { eventType: string; label: string; preferenceType?: string; owner?: string; emailEnabled?: boolean }
export async function registerNotificationEvent(definition: EventDefinition, db: Db = prisma) {
  if (!/^[a-z][a-z0-9_.-]{0,49}$/.test(definition.eventType)) throw new Error('잘못된 알림 이벤트 이름')
  return db.notificationRule.upsert({ where: { eventType: definition.eventType }, update: {}, create: {
    eventType: definition.eventType, label: definition.label, preferenceType: definition.preferenceType || definition.eventType,
    owner: definition.owner || 'core', emailEnabled: definition.emailEnabled ?? true,
    smsTemplate: '#{title}\n#{message}\n#{link}', alimtalkTemplate: '',
  } })
}
export async function ensureCoreRules() {
  for (const [eventType, label] of Object.entries(CORE_EVENTS)) {
    // Order-specific event rules belong to plugins. Keep order_status as the shared member preference type.
    if (eventType !== 'order_status') await registerNotificationEvent({ eventType, label })
  }
  for (const plugin of await getAllPlugins()) {
    if (plugin.enabled) for (const definition of plugin.notificationEvents || []) {
      await registerNotificationEvent({ ...definition, owner: plugin.folder })
    }
  }
}
export function emailPreference(pref: Record<string, unknown> | null, type: string) {
  const suffix = PREF_FIELDS[type as keyof typeof PREF_FIELDS]
  return suffix ? (pref?.[`email${suffix}`] as boolean | undefined) ?? (type === 'order_status') : false
}
export function mobilePreference(pref: Record<string, unknown> | null, type: string, channel: 'sms' | 'alimtalk') {
  const preferences = pref?.mobilePreferences as Record<string, Record<string, boolean>> | null
  return preferences?.[type]?.[channel] === true
}
export interface EmitNotificationInput {
  userId: number; type: string; title: string; message: string; link?: string
  // A stable source action ID is required for callers that can be retried.
  eventKey: string
  definition?: EventDefinition; variables?: Record<string, string>
  email?: { subject: string; html: string }
  test?: { channel: Channel; live: boolean }
  testRule?: { smsTemplate: string; alimtalkTemplate: string; alimtalkCode: string; alimtalkButtons: unknown; variableMapping: unknown }
}
export async function emitNotification(input: EmitNotificationInput, transaction?: Db) {
  let config: Awaited<ReturnType<typeof getNotificationConfig>> | null = null
  try { config = await getNotificationConfig() } catch { /* The mandatory in-app record must survive configuration errors. */ }
  const write = async (db: Db) => {
    const user = await db.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true, phone: true, nickname: true, name: true, status: true, deletedAt: true } })
    if (!user || user.deletedAt || user.status === 'withdrawn') return null
    const hash = createHash('sha256').update(`${input.userId}:${input.type}:${input.eventKey}`).digest('hex')
    const id = randomUUID()
    const event = await db.notificationEvent.upsert({ where: { dedupeKey: hash }, update: {},
      create: { id, dedupeKey: hash, userId: input.userId, type: input.type } })
    if (event.id !== id) return db.notification.findUnique({ where: { eventId: event.id } })
    const notification = await db.notification.create({ data: { userId: input.userId, eventId: id,
      type: input.definition?.preferenceType || input.type, title: input.title.slice(0, 200), message: input.message, link: input.link || null } })
    const registeredRule = await registerNotificationEvent(input.definition || { eventType: input.type, label: CORE_EVENTS[input.type as keyof typeof CORE_EVENTS] || input.type }, db)
    const rule = input.test && input.testRule ? { ...registeredRule, ...input.testRule } : registeredRule
    const pref = await db.notificationPreference.findUnique({ where: { userId: input.userId } })
    const url = input.link ? new URL(input.link, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').href : ''
    const site = await db.setting.findUnique({ where: { key: 'site_name' }, select: { value: true } })
    const variables = { title: input.title, message: input.message, link: url, name: user.name || user.nickname,
      eventType: input.type, ...input.variables, siteName: site?.value.trim() || 'NexiBase' }
    const mapping = rule.variableMapping as Record<string, string> | null
    if (mapping) for (const [name, source] of Object.entries(mapping)) {
      if (Object.prototype.hasOwnProperty.call(variables, source)) variables[name as keyof typeof variables] = variables[source as keyof typeof variables]
    }
    const allowed = (channel: Channel) => !!config && (input.test?.channel === channel ||
      (config.settings[`${channel}Enabled`] && rule[`${channel}Enabled`] &&
        (channel === 'email' ? emailPreference(pref, rule.preferenceType) : mobilePreference(pref, rule.preferenceType, channel))))
    const alimtalkFirst = !input.test && allowed('sms') && allowed('alimtalk')
    let fallbackSms: DeliveryPayload | undefined
    for (const channel of CHANNELS) {
      const recipient = channel === 'email' ? user.email : normalizePhone(user.phone || '')
      let reason = !allowed(channel) ? '채널 또는 이벤트가 꺼져 있거나 회원이 수신을 선택하지 않았습니다.' : ''
      if (!reason && user.status !== 'active') reason = '비활성 회원에게 외부 알림을 보내지 않습니다.'
      if (input.test && input.test.channel !== channel) reason = '테스트 대상 채널이 아닙니다.'
      if (!reason && !recipient) reason = '회원 연락처가 없습니다.'
      if (!reason && channel !== 'email' && !validPhone(recipient)) reason = '유효한 회원 전화번호가 없습니다.'
      if (!reason && !encryptionReady()) reason = '서버 알림 암호화 키 설정이 필요합니다.'
      if (!reason && config && !(channel === 'email' && input.test && !input.test.live)) {
        const missing = configReadiness(config.settings, config.secrets)[channel]
        if (missing.length) reason = `설정 필요: ${missing.join(', ')}`
      }
      let payload: DeliveryPayload | undefined
      if (!reason) {
        try {
          const text = channel === 'email' ? `${input.message}\n${url}`
            : renderTemplate(channel === 'sms' ? rule.smsTemplate : rule.alimtalkTemplate, variables)
          if (channel === 'alimtalk' && (!rule.alimtalkCode || !text)) throw new Error('승인된 알림톡 템플릿 코드와 본문이 필요합니다.')
          payload = { to: recipient, subject: input.email?.subject || input.title, text,
            test: input.test ? !input.test.live : !canUseLiveDelivery(config!.settings, recipient, channel),
            ...(channel === 'email' ? { html: input.email?.html || `<h2>${escapeHtml(input.title)}</h2><p>${escapeHtml(input.message).replace(/\n/g, '<br>')}</p>${url ? `<a href="${escapeHtml(url)}">자세히 보기</a>` : ''}` } : {}),
            ...(channel === 'alimtalk' ? { templateCode: rule.alimtalkCode,
              ...(rule.alimtalkButtons ? { buttons: JSON.parse(renderTemplate(JSON.stringify(rule.alimtalkButtons), Object.fromEntries(Object.entries(variables).map(([key, value]) => [key, JSON.stringify(value).slice(1, -1)])))) } : {}) } : {}),
          }
          if (channel === 'sms') {
            payload.text = payload.text.replace(/[\u{1F000}-\u{1FAFF}]/gu, '')
            if (alimtalkFirst) { payload.aligoManaged = true; fallbackSms = payload }
          }
          if (channel === 'alimtalk' && fallbackSms) {
            if (!fallbackSms.text.trim()) throw new Error('대체 문자 본문이 필요합니다.')
            payload.aligoFailoverSms = { subject: fallbackSms.subject, text: fallbackSms.text }
          }
        } catch (error) { reason = error instanceof Error ? error.message : '템플릿 오류' }
      }
      await db.notificationDelivery.create({ data: { eventId: id, channel, recipientMasked: maskRecipient(recipient, channel),
        status: reason ? 'skipped' : channel === 'sms' && alimtalkFirst ? 'waiting' : 'pending',
        reason: reason || (channel === 'sms' && alimtalkFirst ? '알리고 자동 대체 문자 대기 · 자체 발송하지 않음' : null),
        payloadEncrypted: payload ? encrypt(payload) : null } })
    }
    return notification
  }
  const run = async () => {
    if (transaction) return write(transaction)
    for (let attempt = 0; ; attempt++) {
      try { return await prisma.$transaction(write, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 }) }
      catch (error) {
        if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') continue
        throw error
      }
    }
  }
  try {
    return await run()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const db = transaction || prisma
      const hash = createHash('sha256').update(`${input.userId}:${input.type}:${input.eventKey}`).digest('hex')
      const event = await db.notificationEvent.findUnique({ where: { dedupeKey: hash } })
      if (event) return db.notification.findUnique({ where: { eventId: event.id } })
    }
    throw error
  }
}
