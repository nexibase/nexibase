import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getNotificationConfig } from '@/lib/notifications/config'
import { ensureCoreRules } from '@/lib/notifications/service'
import { CORE_EVENTS } from '@/lib/notifications/policy'
import { sameOrigin } from '@/lib/notifications/admin'

const MANDATORY = { postComment: true, commentReply: true, mention: true, orderStatus: true }
const DEFAULTS = { ...MANDATORY, emailPostComment: false, emailCommentReply: false, emailMention: false, emailOrderStatus: true, emailDirectMessage: false }
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureCoreRules()
  const [preference, rules, { settings }] = await Promise.all([
    prisma.notificationPreference.findUnique({ where: { userId: session.id } }), prisma.notificationRule.findMany(), getNotificationConfig(),
  ])
  const availability = Object.fromEntries(Object.keys(CORE_EVENTS).map(type => [type, {
    email: settings.emailEnabled && rules.some(r => r.preferenceType === type && r.emailEnabled),
    sms: settings.smsEnabled && rules.some(r => r.preferenceType === type && r.smsEnabled),
    alimtalk: settings.alimtalkEnabled && rules.some(r => r.preferenceType === type && r.alimtalkEnabled),
  }]))
  return NextResponse.json({ preference: { ...DEFAULTS, ...preference, ...MANDATORY }, availability })
}
export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  try {
    const body = await request.json()
    const data: Record<string, boolean> = { ...MANDATORY }
    for (const key of ['emailPostComment', 'emailCommentReply', 'emailMention', 'emailOrderStatus', 'emailDirectMessage'] as const) {
      if (typeof body[key] === 'boolean') data[key] = body[key]
    }
    const preference = await prisma.$transaction(async tx => {
      const previous = await tx.notificationPreference.findUnique({ where: { userId: session.id } })
      const mobile = { ...(previous?.mobilePreferences as Record<string, Record<string, boolean>> | null) }
      if (body.mobilePreferences !== undefined) {
        if (!body.mobilePreferences || typeof body.mobilePreferences !== 'object' || Array.isArray(body.mobilePreferences)) throw new Error('잘못된 모바일 수신 설정')
        for (const type of Object.keys(CORE_EVENTS)) {
          const patch = body.mobilePreferences[type]
          if (patch === undefined) continue
          if (!patch || typeof patch !== 'object') throw new Error('잘못된 모바일 수신 설정')
          mobile[type] = { ...mobile[type] }
          for (const channel of ['sms', 'alimtalk']) if (typeof patch[channel] === 'boolean') mobile[type][channel] = patch[channel]
        }
      }
      return tx.notificationPreference.upsert({ where: { userId: session.id },
        create: { userId: session.id, ...DEFAULTS, ...data, mobilePreferences: mobile }, update: { ...data, mobilePreferences: mobile } })
    })
    return NextResponse.json({ preference })
  } catch { return NextResponse.json({ error: '수신 설정 저장에 실패했습니다.' }, { status: 400 }) }
}
