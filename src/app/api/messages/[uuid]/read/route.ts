import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { markConversationRead } from '@/lib/messaging'

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { uuid } = await params
  const conv = await prisma.conversation.findUnique({ where: { uuid }, select: { id: true } })
  if (!conv) return NextResponse.json({ error: 'not found' }, { status: 404 })
  await markConversationRead(conv.id, session.id)
  return NextResponse.json({ success: true })
}
