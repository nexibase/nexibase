import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { markConversationRead } from '@/lib/messaging'

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const conversationId = parseInt(id)
  if (!Number.isFinite(conversationId)) {
    return NextResponse.json({ error: 'bad id' }, { status: 400 })
  }
  await markConversationRead(conversationId, session.id)
  return NextResponse.json({ success: true })
}
