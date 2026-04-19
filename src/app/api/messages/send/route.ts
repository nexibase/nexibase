import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canSendMessage, sendMessageTo } from '@/lib/messaging'

// Session-keyed in-memory rate limiter: 60 sends per minute.
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
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await canSendMessage(session.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!takeToken(`send:${session.id}`)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  const body = await request.json()
  const { toUserId, content, sendEmail } = body

  if (typeof toUserId !== 'number') {
    return NextResponse.json({ error: 'toUserId required' }, { status: 400 })
  }
  if (toUserId === session.id) {
    return NextResponse.json({ error: 'cannot message self' }, { status: 400 })
  }
  if (typeof content !== 'string' || content.length < 1 || content.length > 2000) {
    return NextResponse.json({ error: 'content must be 1..2000 chars' }, { status: 400 })
  }

  const recipient = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, email: true, deletedAt: true },
  })
  if (!recipient || recipient.deletedAt) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const sender = await prisma.user.findUnique({
    where: { id: session.id },
    select: { nickname: true, role: true },
  })
  if (!sender) return NextResponse.json({ error: 'sender not found' }, { status: 401 })

  const senderIsAdmin = sender.role === 'admin' || sender.role === 'manager'

  const { conversation, message } = await sendMessageTo({
    fromUserId: session.id,
    toUserId,
    content,
    sendEmailOverride: sendEmail === true,
    fromUserName: sender.nickname,
    senderIsAdmin,
    recipientEmail: recipient.email,
  })

  return NextResponse.json({
    success: true,
    conversationUuid: conversation.uuid,
    messageId: message.id,
  })
}
