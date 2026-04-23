import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { stripHtml } from '@/plugins/faq-accordion/lib/sanitize'

async function requireAdmin() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  }
  return null
}

function makeSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return base || `category-${Date.now()}`
}

async function uniqueSlug(desired: string, excludeId?: number): Promise<string> {
  let candidate = desired
  let i = 2
  while (true) {
    const existing = await prisma.faqCategory.findUnique({ where: { slug: candidate } })
    if (!existing || existing.id === excludeId) return candidate
    candidate = `${desired}-${i++}`
  }
}

export async function GET(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'faqs') {
      const faqs = await prisma.faq.findMany({
        include: { category: true },
        orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
      })
      return NextResponse.json(faqs)
    }

    if (type === 'categories') {
      const categories = await prisma.faqCategory.findMany({
        include: { _count: { select: { faqs: true } } },
        orderBy: { sortOrder: 'asc' },
      })
      return NextResponse.json(categories)
    }

    return NextResponse.json({ error: 'Missing or invalid type' }, { status: 400 })
  } catch (e) {
    console.error('[faq-accordion admin GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    const body = await request.json()

    if (body.type === 'faq') {
      const { question, answer, categoryId, sortOrder, published } = body
      if (!question || typeof question !== 'string' || question.trim() === '') {
        return NextResponse.json({ error: 'Question required' }, { status: 400 })
      }
      if (!answer || stripHtml(String(answer)).trim() === '') {
        return NextResponse.json({ error: 'Answer required' }, { status: 400 })
      }
      if (!Number.isInteger(categoryId)) {
        return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
      }
      const faq = await prisma.faq.create({
        data: {
          question: String(question).slice(0, 500),
          answer: String(answer),
          categoryId,
          sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
          published: typeof published === 'boolean' ? published : true,
        },
        include: { category: true },
      })
      return NextResponse.json(faq, { status: 201 })
    }

    if (body.type === 'category') {
      const { name, slug } = body
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ error: 'Name required' }, { status: 400 })
      }
      const desired = slug && typeof slug === 'string' && slug.trim() !== ''
        ? makeSlug(slug)
        : makeSlug(name)
      const finalSlug = await uniqueSlug(desired)
      const category = await prisma.faqCategory.create({
        data: { name: name.trim().slice(0, 100), slug: finalSlug },
      })
      return NextResponse.json(category, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    console.error('[faq-accordion admin POST]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    const body = await request.json()

    if (body.type === 'faq') {
      const { id, ...rest } = body
      if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const data: Record<string, unknown> = {}
      if (typeof rest.question === 'string') data.question = rest.question.slice(0, 500)
      if (typeof rest.answer === 'string') {
        if (stripHtml(rest.answer).trim() === '') {
          return NextResponse.json({ error: 'Answer required' }, { status: 400 })
        }
        data.answer = rest.answer
      }
      if (Number.isInteger(rest.categoryId)) data.categoryId = rest.categoryId
      if (typeof rest.sortOrder === 'number') data.sortOrder = rest.sortOrder
      if (typeof rest.published === 'boolean') data.published = rest.published
      const updated = await prisma.faq.update({ where: { id }, data, include: { category: true } })
      return NextResponse.json(updated)
    }

    if (body.type === 'category') {
      const { id, ...rest } = body
      if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const data: Record<string, unknown> = {}
      if (typeof rest.name === 'string') data.name = rest.name.trim().slice(0, 100)
      if (typeof rest.slug === 'string' && rest.slug.trim() !== '') {
        data.slug = await uniqueSlug(makeSlug(rest.slug), id)
      }
      if (typeof rest.sortOrder === 'number') data.sortOrder = rest.sortOrder
      const updated = await prisma.faqCategory.update({ where: { id }, data })
      return NextResponse.json(updated)
    }

    if (body.type === 'reorder-faqs' || body.type === 'reorder-categories') {
      const items = body.items
      if (!Array.isArray(items)) return NextResponse.json({ error: 'items[] required' }, { status: 400 })
      const table = body.type === 'reorder-faqs' ? 'faq' : 'faqCategory'
      await prisma.$transaction(
        items.map((it: { id: number; sortOrder: number }) =>
          table === 'faq'
            ? prisma.faq.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } })
            : prisma.faqCategory.update({ where: { id: it.id }, data: { sortOrder: it.sortOrder } })
        )
      )
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    console.error('[faq-accordion admin PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const guard = await requireAdmin()
  if (guard) return guard

  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const idStr = searchParams.get('id')
    const force = searchParams.get('force') === 'true'
    const id = idStr ? parseInt(idStr, 10) : NaN
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

    if (type === 'faq') {
      await prisma.faq.delete({ where: { id } })
      return new NextResponse(null, { status: 204 })
    }

    if (type === 'category') {
      const cat = await prisma.faqCategory.findUnique({
        where: { id },
        include: { _count: { select: { faqs: true } } },
      })
      if (!cat) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      if (cat._count.faqs > 0 && !force) {
        return NextResponse.json({ error: 'has_faqs', faqCount: cat._count.faqs }, { status: 400 })
      }
      await prisma.faqCategory.delete({ where: { id } })
      return new NextResponse(null, { status: 204 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    console.error('[faq-accordion admin DELETE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
