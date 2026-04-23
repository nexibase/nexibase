import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

function clampLimit(raw: string | null): number {
  const n = raw === null ? 5 : parseInt(raw, 10)
  if (Number.isNaN(n)) return 5
  return Math.min(10, Math.max(1, n))
}

async function fetchRandomFaqs(limit: number) {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM faqs WHERE published = 1 ORDER BY RAND() LIMIT ${limit}
  `
  const ids = rows.map((r) => r.id)
  if (ids.length === 0) return []
  const faqs = await prisma.faq.findMany({
    where: { id: { in: ids } },
    select: { id: true, question: true, answer: true, views: true },
  })
  const byId = new Map(faqs.map((f) => [f.id, f]))
  return ids.map((id) => byId.get(id)).filter((f): f is NonNullable<typeof f> => !!f)
}

function getCachedRandomFaqs(limit: number) {
  return unstable_cache(
    () => fetchRandomFaqs(limit),
    ['faq-random', String(limit)],
    { revalidate: 600 },
  )()
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    if (type !== 'random') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    const limit = clampLimit(searchParams.get('limit'))
    const faqs = await getCachedRandomFaqs(limit)
    return NextResponse.json({ faqs })
  } catch (e) {
    console.error('[faq-accordion public GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

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
