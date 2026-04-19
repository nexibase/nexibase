import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Defaults — must mirror prisma schema defaults for NotificationPreference.
const DEFAULTS = {
  postComment: true,
  commentReply: true,
  mention: true,
  orderStatus: true,
  emailPostComment: false,
  emailCommentReply: false,
  emailMention: false,
  emailAdminMessage: true,
  emailOrderStatus: true,
}

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId: session.id },
  })
  return NextResponse.json({ preference: pref ?? { userId: session.id, ...DEFAULTS } })
}

export async function PUT(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json()

  // Whitelist fields; coerce to boolean.
  const allowed: (keyof typeof DEFAULTS)[] = [
    'postComment', 'commentReply', 'mention', 'orderStatus',
    'emailPostComment', 'emailCommentReply', 'emailMention',
    'emailAdminMessage', 'emailOrderStatus',
  ]
  const data: Record<string, boolean> = {}
  for (const key of allowed) {
    if (typeof body[key] === 'boolean') data[key] = body[key]
  }

  const pref = await prisma.notificationPreference.upsert({
    where: { userId: session.id },
    create: { userId: session.id, ...DEFAULTS, ...data },
    update: data,
  })
  return NextResponse.json({ preference: pref })
}
