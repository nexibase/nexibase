import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { getNotificationConfig, publicNotificationConfig, saveNotificationConfig, type NotificationSettings, type Secrets } from '@/lib/notifications/config'
import { ensureCoreRules } from '@/lib/notifications/service'
import { isNotificationDevelopment, validPhone } from '@/lib/notifications/policy'

export async function GET() {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  await ensureCoreRules()
  return NextResponse.json({ ...await publicNotificationConfig(), rules: await prisma.notificationRule.findMany({ orderBy: [{ owner: 'asc' }, { eventType: 'asc' }] }) })
}
export async function PUT(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  try {
    const body = await request.json()
    const { settings: current } = await getNotificationConfig()
    const settings: NotificationSettings = { ...current }
    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) throw new Error('알림 설정 형식을 확인하세요.')
    for (const key of ['emailEnabled', 'smsEnabled', 'alimtalkEnabled', 'liveEnabled', 'smtpSecure'] as const) {
      if (typeof body.settings[key] !== 'boolean') throw new Error('채널 설정 형식을 확인하세요.')
      settings[key] = body.settings[key]
    }
    for (const key of ['smtpHost', 'smtpUser', 'smtpFrom', 'aligoUserId', 'sender'] as const) {
      if (typeof body.settings[key] !== 'string' || body.settings[key].length > 255 || /[\r\n]/.test(body.settings[key])) throw new Error('발송 설정 값을 확인하세요.')
      settings[key] = body.settings[key].trim()
    }
    if (!Number.isInteger(body.settings.smtpPort) || body.settings.smtpPort < 1 || body.settings.smtpPort > 65535) throw new Error('SMTP 포트를 확인하세요.')
    settings.smtpPort = body.settings.smtpPort
    if (settings.sender && !validPhone(settings.sender)) throw new Error('발신번호를 확인하세요.')
    if (!Array.isArray(body.settings.testRecipients) || body.settings.testRecipients.length > 50 || body.settings.testRecipients.some((v: unknown) => typeof v !== 'string' || v.length > 255 || (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !validPhone(v)))) throw new Error('테스트 수신자는 이메일 또는 전화번호로 입력하세요. 최대 50개입니다.')
    settings.testRecipients = [...new Set(body.settings.testRecipients as string[])].map(v => v.trim())
    if (settings.liveEnabled && isNotificationDevelopment() && !settings.testRecipients.length) throw new Error('dev 실발송은 테스트 수신자 목록을 먼저 등록해야 합니다.')
    const secrets: Secrets = {}
    for (const key of ['smtpPass', 'aligoKey', 'senderKey'] as const) {
      if (body.secrets?.[key] !== undefined && (typeof body.secrets[key] !== 'string' || body.secrets[key].length > 2048)) throw new Error('인증 정보 형식을 확인하세요.')
      if (body.secrets?.[key]) secrets[key] = body.secrets[key]
    }
    if (!Array.isArray(body.rules) || body.rules.length > 100) throw new Error('이벤트 설정 형식을 확인하세요.')
    const known = await prisma.notificationRule.findMany({ select: { eventType: true } })
    const rules = body.rules.map((rule: Record<string, unknown>) => {
      if (!known.some(k => k.eventType === rule.eventType)) throw new Error('등록되지 않은 알림 이벤트입니다.')
      for (const key of ['emailEnabled', 'smsEnabled', 'alimtalkEnabled']) if (typeof rule[key] !== 'boolean') throw new Error('이벤트 채널 설정 형식을 확인하세요.')
      for (const key of ['smsTemplate', 'alimtalkTemplate', 'alimtalkCode']) if (typeof rule[key] !== 'string' || (rule[key] as string).length > (key === 'alimtalkCode' ? 100 : 4000)) throw new Error('템플릿 길이를 확인하세요.')
      if (rule.alimtalkEnabled && (!rule.alimtalkCode || !rule.alimtalkTemplate)) throw new Error('알림톡을 켜려면 승인된 템플릿 코드와 본문이 필요합니다.')
      const mapping = rule.variableMapping || {}
      if (typeof mapping !== 'object' || Array.isArray(mapping) || Object.entries(mapping).some(([k,v]) => ['__proto__', 'constructor', 'prototype'].includes(k) || typeof v !== 'string' || k.length > 100 || v.length > 100)) throw new Error('템플릿 변수 매핑 형식을 확인하세요.')
      if (JSON.stringify(rule.alimtalkButtons ?? null).length > 10000) throw new Error('알림톡 버튼 정보가 너무 깁니다.')
      if (rule.alimtalkButtons != null && (typeof rule.alimtalkButtons !== 'object' || Array.isArray(rule.alimtalkButtons))) throw new Error('알림톡 버튼 정보는 JSON 객체로 입력하세요.')
      return { eventType: String(rule.eventType), data: {
        emailEnabled: rule.emailEnabled as boolean, smsEnabled: rule.smsEnabled as boolean, alimtalkEnabled: rule.alimtalkEnabled as boolean,
        smsTemplate: rule.smsTemplate as string, alimtalkCode: rule.alimtalkCode as string, alimtalkTemplate: rule.alimtalkTemplate as string,
        alimtalkButtons: rule.alimtalkButtons == null ? Prisma.DbNull : JSON.parse(JSON.stringify(rule.alimtalkButtons)), variableMapping: JSON.parse(JSON.stringify(mapping)),
      } }
    })
    await prisma.$transaction(async tx => {
      await saveNotificationConfig(settings, secrets, tx)
      for (const rule of rules) await tx.notificationRule.update({ where: { eventType: rule.eventType }, data: rule.data })
    })
    return NextResponse.json({ success: true, ...await publicNotificationConfig() })
  } catch (error) {
    const message = error instanceof Error && !('code' in error) ? error.message : '알림 설정을 저장하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
