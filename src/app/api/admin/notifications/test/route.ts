import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { getNotificationConfig } from '@/lib/notifications/config'
import { CHANNELS, canUseLiveDelivery, type Channel } from '@/lib/notifications/policy'
import { emitNotification } from '@/lib/notifications/service'

export async function POST(request: NextRequest) {
  const admin = await notificationAdmin()
  if (!admin) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  try {
    const body = await request.json()
    if (!CHANNELS.includes(body.channel) || !['test', 'live'].includes(body.mode)) throw new Error('테스트 채널과 모드를 확인하세요.')
    const userId = body.userId === undefined ? admin.id : Number(body.userId)
    if (!Number.isSafeInteger(userId) || userId < 1) throw new Error('테스트 회원 ID를 확인하세요.')
    const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null, status: 'active' }, select: { email: true, phone: true } })
    if (!user) throw new Error('테스트 수신 회원을 찾을 수 없습니다.')
    const { settings } = await getNotificationConfig()
    const recipient = body.channel === 'email' ? user.email : user.phone || ''
    if (!recipient) throw new Error('테스트 회원의 연락처가 없습니다.')
    if (body.mode === 'live' && !canUseLiveDelivery(settings, recipient, body.channel)) throw new Error('실발송 설정과 테스트 수신자 허용 목록을 확인하세요.')
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
