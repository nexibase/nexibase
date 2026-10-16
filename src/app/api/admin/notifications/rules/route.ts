import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { getNotificationConfig } from '@/lib/notifications/config'
import { ensureCoreRules } from '@/lib/notifications/service'
import { validateNotificationRules } from '@/lib/notifications/rules'

const headers = { 'Cache-Control': 'no-store, private' }
export async function GET() {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401, headers })
  await ensureCoreRules()
  const [{ settings, secrets }, rules] = await Promise.all([
    getNotificationConfig(), prisma.notificationRule.findMany({ orderBy: [{ owner: 'asc' }, { eventType: 'asc' }] }),
  ])
  return NextResponse.json({ channels: { email: settings.emailEnabled, sms: settings.smsEnabled, alimtalk: settings.alimtalkEnabled },
    canLoadTemplates: !!(settings.aligoUserId && secrets.aligoKey && secrets.senderKey), rules }, { headers })
}
export async function PUT(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401, headers })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers })
  try {
    const body = await request.json()
    const known = await prisma.notificationRule.findMany({ select: { eventType: true } })
    const rules = validateNotificationRules(body.rules, known.map(rule => rule.eventType))
    await prisma.$transaction(async tx => {
      for (const rule of rules) await tx.notificationRule.update({ where: { eventType: rule.eventType }, data: rule.data })
    })
    return NextResponse.json({ success: true }, { headers })
  } catch (error) {
    const message = error instanceof Error && !('code' in error) ? error.message : '이벤트 설정을 저장하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400, headers })
  }
}
