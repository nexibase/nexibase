import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { configReadiness, getNotificationConfig } from '@/lib/notifications/config'
import { CHANNELS, canUseLiveDelivery, maskRecipient, normalizeSmtpTestEmail, type Channel } from '@/lib/notifications/policy'
import { emitNotification } from '@/lib/notifications/service'
import { smtpFailure, smtpTransport } from '@/lib/notifications/providers'
import { enqueueSmtpTest } from '@/lib/notifications/smtp-test'

export async function GET(request: NextRequest) {
  const admin = await notificationAdmin()
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  if (request.nextUrl.searchParams.get('checkRecipient') === '1') {
    try {
      const email = normalizeSmtpTestEmail(request.nextUrl.searchParams.get('recipientEmail')?.trim() || admin.email)
      const recipientMasked = maskRecipient(email, 'email')
      return NextResponse.json({ ready: true, message: `수신자 ${recipientMasked} · 회원 여부와 허용 목록에 관계없이 테스트 메일 발송 가능`, recipientMasked })
    } catch { return NextResponse.json({ ready: false, message: '올바른 이메일 주소 한 개를 입력하세요.' }) }
  }
  const eventId = request.nextUrl.searchParams.get('eventId') || ''
  if (!/^[a-f0-9-]{36}$/i.test(eventId)) return NextResponse.json({ error: '테스트 발송 ID를 확인하세요.' }, { status: 400 })
  const delivery = await prisma.notificationDelivery.findFirst({ where: { eventId, channel: 'email', event: { type: { in: ['notification_test', 'smtp_test'] } } },
    select: { status: true, reason: true, recipientMasked: true, attempts: true } })
  if (!delivery) return NextResponse.json({ error: '테스트 메일 발송 내역을 찾을 수 없습니다.' }, { status: 404 })
  return NextResponse.json({ delivery })
}

export async function POST(request: NextRequest) {
  const admin = await notificationAdmin()
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  try {
    const body = await request.json()
    if (body.action === 'smtp_send') {
      if (body.channel !== undefined && body.channel !== 'email') throw new Error('SMTP 테스트는 메일만 보낼 수 있습니다.')
      if (body.userId !== undefined || body.eventType !== undefined || body.mode !== undefined) throw new Error('SMTP 테스트 요청 형식을 확인하세요.')
      const recipient = body.recipientEmail === undefined || body.recipientEmail === '' ? admin.email : body.recipientEmail
      const notification = await enqueueSmtpTest(admin.id, recipient, typeof body.requestId === 'string' ? body.requestId : randomUUID())
      return NextResponse.json({ success: true, notificationId: notification.id, eventId: notification.eventId })
    }
    if (body.action === 'smtp_check') {
      const { settings, secrets } = await getNotificationConfig()
      const missing = configReadiness(settings, secrets).email
      if (missing.length) throw new Error(`SMTP 설정 필요: ${missing.join(', ')}`)
      const transport = smtpTransport(settings, secrets)
      try {
        await transport.verify()
        return NextResponse.json({ success: true, message: 'SMTP 서버 연결과 인증에 성공했습니다. 메일은 발송하지 않았습니다. 실제 수신 확인은 아래 테스트 메일 보내기를 이용하세요.' })
      } catch (error) {
        const result = smtpFailure(error, false)
        return NextResponse.json({ error: `${result.reason}${result.code ? ` (${result.code})` : ''}` }, { status: 400 })
      } finally { transport.close() }
    }
    if (!CHANNELS.includes(body.channel) || !['test', 'live'].includes(body.mode)) throw new Error('테스트 채널과 모드를 확인하세요.')
    const recipientEmail = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim() : ''
    if (body.recipientEmail !== undefined && (body.channel !== 'email' || typeof body.recipientEmail !== 'string' || recipientEmail.length > 254 || (recipientEmail && !/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(recipientEmail)))) throw new Error('수신 회원 이메일을 확인하세요.')
    if (recipientEmail && body.userId !== undefined) throw new Error('수신 회원 이메일과 회원 ID 중 하나만 입력하세요.')
    const requestedUserId = body.userId === undefined ? admin.id : Number(body.userId)
    if (!Number.isSafeInteger(requestedUserId) || requestedUserId < 1) throw new Error('테스트 회원 ID를 확인하세요.')
    const user = await prisma.user.findFirst({ where: { ...(recipientEmail ? { email: recipientEmail } : { id: requestedUserId }), deletedAt: null, status: 'active' }, select: { id: true, email: true, phone: true } })
    if (!user) throw new Error('테스트 수신 회원을 찾을 수 없습니다.')
    const userId = user.id
    const { settings, secrets } = await getNotificationConfig()
    const recipient = body.channel === 'email' ? user.email : user.phone || ''
    if (!recipient) throw new Error('테스트 회원의 연락처가 없습니다.')
    if (body.mode === 'live' && !canUseLiveDelivery(settings, recipient, body.channel)) throw new Error('실발송 설정과 테스트 수신자 허용 목록을 확인하세요.')
    if (body.mode === 'live' && body.channel === 'email') {
      const missing = configReadiness(settings, secrets).email
      if (missing.length) throw new Error(`SMTP 설정 필요: ${missing.join(', ')}`)
    }
    // Alimtalk test uses an existing configured event template; the channel remains a test event to bypass member preferences.
    const sourceRule = body.eventType ? await prisma.notificationRule.findUnique({ where: { eventType: String(body.eventType) } }) : null
    if (body.channel === 'alimtalk' && (!sourceRule?.alimtalkCode || !sourceRule.alimtalkTemplate)) throw new Error('알림톡 템플릿이 설정된 이벤트를 선택하세요.')
    const notification = await emitNotification({ userId, type: 'notification_test', eventKey: randomUUID(), title: '통합 알림 테스트',
      message: '관리자 화면에서 요청한 테스트 알림입니다.', link: '/mypage/notifications',
      variables: { orderNo: 'TEST-ORDER', status: '테스트', totalAmount: '1000', trackingNumber: 'TEST', customerName: '테스트 회원' },
      ...(sourceRule ? { testRule: sourceRule } : {}), test: { channel: body.channel as Channel, live: body.mode === 'live' } })
    return NextResponse.json({ success: true, notificationId: notification?.id, eventId: notification?.eventId })
  } catch (error) { return NextResponse.json({ error: error instanceof Error && !('code' in error) ? error.message : '테스트 요청 실패' }, { status: 400 }) }
}
