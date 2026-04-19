import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversationId = parseInt(id)
  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      user1: { select: { id: true, nickname: true, image: true } },
      user2: { select: { id: true, nickname: true, image: true } },
    },
  })
  if (!conv) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const me = session.id
  if (conv.user1Id !== me && conv.user2Id !== me) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const before = searchParams.get('before')
  const after = searchParams.get('after')
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)

  let where: { conversationId: number; id?: { lt?: number; gt?: number } } = {
    conversationId,
  }
  if (before) where = { ...where, id: { lt: parseInt(before) } }
  else if (after) where = { ...where, id: { gt: parseInt(after) } }

  // For `after` we want ascending (new messages in order); for
  // `before`/none we want descending (newest first) then reverse later.
  const orderBy: { createdAt: 'asc' | 'desc' } = after ? { createdAt: 'asc' } : { createdAt: 'desc' }

  const rows = await prisma.message.findMany({
    where,
    orderBy,
    take: limit + 1,
    select: { id: true, senderId: true, content: true, createdAt: true },
  })
  const hasMore = rows.length > limit
  const pageRows = hasMore ? rows.slice(0, limit) : rows
  const messages = orderBy.createdAt === 'desc' ? [...pageRows].reverse() : pageRows

  const amIUser1 = conv.user1Id === me
  return NextResponse.json({
    conversation: {
      id: conv.id,
      opponent: amIUser1 ? conv.user2 : conv.user1,
      hiddenByMe: (amIUser1 ? conv.user1HiddenAt : conv.user2HiddenAt) != null,
    },
    messages,
    hasMore,
  })
}
