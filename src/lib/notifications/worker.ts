import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { isPluginEnabled } from '@/lib/plugins'
import { getNotificationConfig, configReadiness } from './config'
import { decrypt } from './crypto'
import { canUseLiveDelivery, isManualSmtpTest, normalizePhone, type Channel } from './policy'
import { emailPreference, mobilePreference } from './service'
import { sendViaProvider, queryDelivery, type DeliveryPayload, type ProviderResult } from './providers'

interface WorkerOptions {
  send?: typeof sendViaProvider; query?: typeof queryDelivery
  getConfig?: typeof getNotificationConfig; eventIds?: string[]
}
const MAX_ATTEMPTS = 3
async function settleMobile(eventId: string) {
  const alimtalk = await prisma.notificationDelivery.findUnique({ where: { eventId_channel: { eventId, channel: 'alimtalk' } } })
  if (!alimtalk) return
  if (alimtalk.status === 'failed') {
    await prisma.notificationDelivery.updateMany({ where: { eventId, channel: 'sms', status: 'waiting' },
      data: { status: 'pending', nextAttemptAt: new Date(), reason: '알림톡 최종 실패 확인: 문자로 대체 발송' } })
  } else if (['delivered', 'tested', 'skipped'].includes(alimtalk.status)) {
    await prisma.notificationDelivery.updateMany({ where: { eventId, channel: 'sms', status: 'waiting' },
      data: { status: 'skipped', reason: alimtalk.status === 'delivered' ? '알림톡 전달 완료로 문자 대체 불필요'
        : '알림톡이 테스트 처리되었거나 발송되지 않아 문자로 대체하지 않습니다.', completedAt: new Date() } })
  }
}
export async function runNotificationWorkerOnce(options: WorkerOptions = {}) {
  const getConfig = options.getConfig || getNotificationConfig
  const send = options.send || sendViaProvider
  const query = options.query || queryDelivery
  const scope = options.eventIds ? { eventId: { in: options.eventIds } } : {}
  const now = new Date()
  const stale = await prisma.notificationDelivery.updateMany({ where: { ...scope, status: 'processing', lockedAt: { lt: new Date(Date.now() - 5 * 60000) } },
    data: { status: 'unknown', reason: '작업 중단 후 접수 여부 불명확. 중복 방지를 위해 자동 재발송하지 않습니다.', lockToken: null } })
  const { settings, secrets } = await getConfig()
  const jobs = await prisma.notificationDelivery.findMany({ where: { ...scope, status: 'pending', attempts: { lt: MAX_ATTEMPTS }, nextAttemptAt: { lte: now } }, orderBy: { createdAt: 'asc' }, take: 50 })
  let processed = 0
  for (const job of jobs) {
    const token = randomUUID()
    const claimed = await prisma.notificationDelivery.updateMany({ where: { id: job.id, status: 'pending', attempts: { lt: MAX_ATTEMPTS }, nextAttemptAt: { lte: new Date() } },
      data: { status: 'processing', lockToken: token, lockedAt: new Date(), attempts: { increment: 1 } } })
    if (!claimed.count) continue
    const claimedJob = await prisma.notificationDelivery.findUnique({ where: { id: job.id }, select: { attempts: true, lockToken: true } })
    if (!claimedJob || claimedJob.lockToken !== token) continue
    const attempt = claimedJob.attempts
    const update = async (result: ProviderResult | { status: 'skipped'; reason: string }) => {
      const retry = result.status === 'retry' && attempt < MAX_ATTEMPTS
      await prisma.notificationDelivery.updateMany({ where: { id: job.id, lockToken: token, status: 'processing' }, data: {
        status: result.status === 'retry' ? (retry ? 'pending' : 'failed') : result.status,
        reason: result.reason, providerId: 'providerId' in result ? result.providerId : undefined,
        providerCode: 'code' in result ? result.code?.slice(0, 50) : undefined, lockToken: null,
        nextAttemptAt: new Date(Date.now() + Math.pow(2, attempt - 1) * 60000),
        ...(result.status === 'accepted' ? { acceptedAt: new Date() } : {}),
        ...(['failed', 'delivered', 'tested', 'skipped'].includes(result.status) || (result.status === 'retry' && !retry) ? { completedAt: new Date() } : {}),
      } })
    }
    try {
      const { settings, secrets } = await getConfig()
      const channel = job.channel as Channel
      const event = await prisma.notificationEvent.findUnique({ where: { id: job.eventId }, include: { user: true } })
      const rule = event ? await prisma.notificationRule.findUnique({ where: { eventType: event.type } }) : null
      const pref = event ? await prisma.notificationPreference.findUnique({ where: { userId: event.userId } }) : null
      const payload = job.payloadEncrypted ? decrypt<DeliveryPayload>(job.payloadEncrypted) : null
      const smtpTest = isManualSmtpTest(channel, event?.type, event?.user.role, payload)
      const testEvent = event?.type === 'notification_test' || smtpTest
      const currentRecipient = channel === 'email' ? event?.user.email.toLowerCase() : normalizePhone(event?.user.phone || '')
      let reason = !event || event.user.deletedAt || event.user.status !== 'active' ? '수신 회원이 없거나 비활성 상태입니다.' : ''
      if (!reason && rule && rule.owner !== 'core' && !await isPluginEnabled(rule.owner)) reason = '알림을 요청한 플러그인이 비활성화되었습니다.'
      if (!reason && (!payload || (!smtpTest && currentRecipient !== (channel === 'email' ? payload.to.toLowerCase() : normalizePhone(payload.to))))) reason = '회원 연락처가 변경되었거나 발송 정보가 없습니다.'
      if (!reason && !testEvent && (!settings[`${channel}Enabled`] || !rule?.[`${channel}Enabled`])) reason = '관리자가 채널 또는 이벤트 발송을 껐습니다.'
      if (!reason && !testEvent && rule && !(channel === 'email' ? emailPreference(pref, rule.preferenceType) : mobilePreference(pref, rule.preferenceType, channel))) reason = '회원이 채널 수신을 해제했습니다.'
      if (!reason && !(channel === 'email' && payload?.test)) {
        const missing = configReadiness(settings, secrets)[channel]
        if (missing.length) reason = `설정 필요: ${missing.join(', ')}`
      }
      if (reason || !payload) await update({ status: 'skipped', reason: reason || '발송 정보 없음' })
      else await update(await send(channel, payload, settings, secrets, payload.test !== true && (smtpTest || canUseLiveDelivery(settings, payload.to, channel))))
    } catch {
      // Once claimed, an unexpected exception may have happened after provider acceptance.
      await update({ status: 'unknown', reason: '처리 결과를 확인할 수 없어 자동 재발송하지 않습니다.' })
    }
    await settleMobile(job.eventId)
    processed++
  }
  const accepted = await prisma.notificationDelivery.findMany({ where: { ...scope, status: 'accepted', channel: { in: ['sms', 'alimtalk'] }, providerId: { not: null },
    OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - 60000) } }] }, take: 50, orderBy: { lastCheckedAt: 'asc' } })
  let checked = 0
  for (const job of accepted) {
    try {
      if (!job.payloadEncrypted) continue
      const payload = decrypt<DeliveryPayload>(job.payloadEncrypted)
      const result = await query(job.channel as 'sms' | 'alimtalk', job.providerId!, payload.to, settings, secrets)
      await prisma.notificationDelivery.updateMany({ where: { id: job.id, status: 'accepted' }, data: {
        lastCheckedAt: new Date(), ...(result ? { status: result.status, reason: result.reason, providerCode: result.code, completedAt: new Date() } : {}),
      } })
      if (result) await settleMobile(job.eventId)
      checked++
    } catch { await prisma.notificationDelivery.updateMany({ where: { id: job.id }, data: { lastCheckedAt: new Date() } }) }
  }
  // Also recover the handoff if the process stopped between recording an outcome and releasing SMS.
  const waiting = await prisma.notificationDelivery.findMany({ where: { ...scope, channel: 'sms', status: 'waiting' }, select: { eventId: true }, take: 100 })
  for (const job of waiting) await settleMobile(job.eventId)
  return { processed, checked, uncertainAfterRestart: stale.count }
}
