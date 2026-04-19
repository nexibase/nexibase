import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createAdminMessageNotification, shouldEmail } from '@/lib/notification'
import { sendAdminMessageEmail } from '@/lib/email'
import { NotificationType } from '@/lib/notification-types'

// Simple in-memory rate limiter (per-session, 60/min). Resets on server
// restart — good enough for Phase 1.
const buckets = new Map<string, { count: number; resetAt: number }>()
function takeToken(key: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count++
  return true
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || (session.role !== 'admin' && session.role !== 'manager')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!takeToken(`send:${session.id}`)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = await request.json()
  const { userId, title, message, link, sendEmail } = body

  // Validation
  if (typeof userId !== 'number') return NextResponse.json({ error: 'userId required' }, { status: 400 })
  if (typeof title !== 'string' || title.length < 1 || title.length > 100) {
    return NextResponse.json({ error: 'title must be 1..100 chars' }, { status: 400 })
  }
  if (typeof message !== 'string' || message.length < 1 || message.length > 2000) {
    return NextResponse.json({ error: 'message must be 1..2000 chars' }, { status: 400 })
  }
  if (link !== undefined && link !== null && link !== '') {
    if (typeof link !== 'string' || !link.startsWith('/')) {
      return NextResponse.json({ error: 'link must be internal path starting with /' }, { status: 400 })
    }
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
  if (!user) return NextResponse.json({ error: 'user not found' }, { status: 404 })

  const notif = await createAdminMessageNotification({
    userId: user.id, title, message, link: link || undefined,
  })

  if (sendEmail && user.email && await shouldEmail(user.id, NotificationType.ADMIN_MESSAGE)) {
    // fire-and-forget
    sendAdminMessageEmail(user.email, title, message, link || undefined)
  }

  return NextResponse.json({ success: true, notification: notif })
}
