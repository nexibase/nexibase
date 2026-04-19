import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const hidden = searchParams.get('hidden') === 'true'
  const me = session.id

  const rows = await prisma.conversation.findMany({
    where: hidden
      ? {
          OR: [
            { AND: [{ user1Id: me }, { user1HiddenAt: { not: null } }] },
            { AND: [{ user2Id: me }, { user2HiddenAt: { not: null } }] },
          ],
        }
      : {
          OR: [
            { AND: [{ user1Id: me }, { user1HiddenAt: null }] },
            { AND: [{ user2Id: me }, { user2HiddenAt: null }] },
          ],
        },
    include: {
      user1: { select: { id: true, nickname: true, image: true } },
      user2: { select: { id: true, nickname: true, image: true } },
    },
    orderBy: { lastMessageAt: 'desc' },
  })

  const conversations = await Promise.all(
    rows.map(async (c) => {
      const amIUser1 = c.user1Id === me
      const myLastReadAt = amIUser1 ? c.user1LastReadAt : c.user2LastReadAt
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: me },
          ...(myLastReadAt ? { createdAt: { gt: myLastReadAt } } : {}),
        },
      })
      const lastMessage = await prisma.message.findFirst({
        where: { conversationId: c.id },
        orderBy: { createdAt: 'desc' },
        select: { content: true, createdAt: true, senderId: true },
      })
      return {
        id: c.id,
        opponent: amIUser1 ? c.user2 : c.user1,
        lastMessage,
        unreadCount,
        hiddenByMe: (amIUser1 ? c.user1HiddenAt : c.user2HiddenAt) != null,
        lastMessageAt: c.lastMessageAt,
      }
    }),
  )

  return NextResponse.json({ conversations, totalCount: conversations.length })
}
