import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notificationAdmin } from '@/lib/notifications/admin'
import { CHANNELS } from '@/lib/notifications/policy'

export async function GET(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  const params = request.nextUrl.searchParams
  const page = Math.max(1, Math.min(100000, Number(params.get('page')) || 1))
  if (!Number.isInteger(page)) return NextResponse.json({ error: '페이지를 확인하세요.' }, { status: 400 })
  const where: Prisma.NotificationDeliveryWhereInput = {}
  const channel = params.get('channel')
  if (CHANNELS.includes(channel as typeof CHANNELS[number])) where.channel = channel!
  const status = params.get('status')
  if (status) where.status = status.slice(0, 20)
  const type = params.get('event')
  if (type) where.event = { type: type.slice(0, 50) }
  const search = params.get('search')?.trim().slice(0, 100)
  if (search) where.OR = [{ recipientMasked: { contains: search } }, { event: { user: { nickname: { contains: search } } } }, { event: { type: { contains: search } } }]
  const start = params.get('start'), end = params.get('end')
  if (start || end) {
    const from = start ? new Date(`${start}T00:00:00+09:00`) : undefined
    const to = end ? new Date(`${end}T23:59:59.999+09:00`) : undefined
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return NextResponse.json({ error: '날짜를 확인하세요.' }, { status: 400 })
    where.createdAt = { gte: from, lte: to }
  }
  const [total, deliveries] = await Promise.all([prisma.notificationDelivery.count({ where }), prisma.notificationDelivery.findMany({
    where, skip: (page - 1) * 30, take: 30, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, eventId: true, channel: true, status: true, recipientMasked: true, providerId: true, providerCode: true, reason: true,
      attempts: true, nextAttemptAt: true, lockedAt: true, acceptedAt: true, completedAt: true, lastCheckedAt: true, createdAt: true,
      event: { select: { type: true, user: { select: { id: true, nickname: true } } } } },
  })])
  const rules = await prisma.notificationRule.findMany({ select: { eventType: true, label: true } })
  return NextResponse.json({ total, page, pageSize: 30, deliveries, events: { ...Object.fromEntries(rules.map(r => [r.eventType, r.label])), smtp_test: 'SMTP 테스트 메일' } })
}
