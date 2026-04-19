import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { setConversationHidden } from '@/lib/messaging'

export async function PUT(
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
  const body = await request.json().catch(() => ({}))
  const hidden = body.hidden === true
  try {
    await setConversationHidden(conversationId, session.id, hidden)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'hide failed'
    if (msg === 'not a participant') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (msg === 'conversation not found') return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
