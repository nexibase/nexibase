import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = body.id
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const faq = await prisma.faq.findUnique({ where: { id }, select: { published: true } })
    if (!faq || !faq.published) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (body.type === 'view') {
      const updated = await prisma.faq.update({
        where: { id },
        data: { views: { increment: 1 } },
        select: { views: true },
      })
      return NextResponse.json(updated)
    }

    if (body.type === 'feedback') {
      const field = body.helpful === true ? 'helpful' : body.helpful === false ? 'notHelpful' : null
      if (!field) return NextResponse.json({ error: 'helpful boolean required' }, { status: 400 })
      const updated = await prisma.faq.update({
        where: { id },
        data: { [field]: { increment: 1 } },
        select: { helpful: true, notHelpful: true },
      })
      return NextResponse.json(updated)
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    console.error('[faq-accordion public PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
