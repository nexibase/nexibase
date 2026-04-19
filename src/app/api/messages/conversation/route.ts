import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { findOrCreateConversation } from '@/lib/messaging'

// POST /api/messages/conversation — { toUserId } → { conversationId }
// Finds or creates the 1:1 conversation without sending a message.
// Used by admin surfaces that open the thread in a new tab instead of a dialog.
export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { toUserId } = body
  if (typeof toUserId !== 'number') {
    return NextResponse.json({ error: 'toUserId required' }, { status: 400 })
  }
  if (toUserId === session.id) {
    return NextResponse.json({ error: 'cannot converse with self' }, { status: 400 })
  }

  const recipient = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true, deletedAt: true },
  })
  if (!recipient || recipient.deletedAt) {
    return NextResponse.json({ error: 'user not found' }, { status: 404 })
  }

  const conversation = await findOrCreateConversation(session.id, toUserId)
  return NextResponse.json({ conversationId: conversation.id })
}
