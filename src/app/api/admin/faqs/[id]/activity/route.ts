import { createHmac } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import type { FaqActivityAudience, FaqActivityKind } from '@/features/faqs/lib/activity-types'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await getAdminUser()) return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
  const id = Number((await params).id)
  const query = request.nextUrl.searchParams
  const kind = (query.get('kind') ?? 'views') as FaqActivityKind
  const audience = (query.get('audience') ?? 'all') as FaqActivityAudience
  const page = Number(query.get('page') ?? '1')
  const pageSize = Number(query.get('pageSize') ?? '20')
  if (!Number.isSafeInteger(id) || id < 1 || !['views', 'helpful', 'notHelpful'].includes(kind) || !['all', 'user', 'guest'].includes(audience) || !Number.isInteger(page) || page < 1 || page > 10000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return NextResponse.json({ error: 'Invalid activity query' }, { status: 400 })
  }
  try {
    return await prisma.$transaction(async tx => {
    const faq = await tx.faq.findUnique({ where: { id }, select: { id: true, question: true, views: true, helpful: true, notHelpful: true } })
    if (!faq) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const filter = audience === 'user' ? { userId: { not: null } } : audience === 'guest' ? { userId: null } : {}
    const include = { user: { select: { id: true, nickname: true, status: true } } }
    const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
    let recorded: number, users: number, total: number
    type Row = { id: number; createdAt: Date; key: string; userId: number | null; user: { id: number; nickname: string; status: string } | null }
    let rows: Row[]
    if (kind === 'views') {
      const where = { faqId: id }
      const filtered = { ...where, ...filter }
      const result = await Promise.all([
        tx.faqView.count({ where }),
        tx.faqView.count({ where: { ...where, userId: { not: null } } }),
        tx.faqView.count({ where: filtered }),
        tx.faqView.findMany({ where: filtered, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      ])
      ;[recorded, users, total] = result
      rows = result[3].map(row => ({ ...row, key: row.viewerKey }))
    } else {
      const where = { faqId: id, helpful: kind === 'helpful' }
      const filtered = { ...where, ...filter }
      const result = await Promise.all([
        tx.faqFeedback.count({ where }),
        tx.faqFeedback.count({ where: { ...where, userId: { not: null } } }),
        tx.faqFeedback.count({ where: filtered }),
        tx.faqFeedback.findMany({ where: filtered, include, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      ])
      ;[recorded, users, total] = result
      rows = result[3].map(row => ({ ...row, key: row.voterKey }))
    }
    const records = rows.map(row => ({
      id: row.id, occurredAt: row.createdAt.toISOString(),
      actor: row.userId !== null ? { type: 'user', user: row.user ?? { id: row.userId, nickname: '', status: 'withdrawn' } } : {
        type: 'guest', label: createHmac('sha256', process.env.NEXTAUTH_SECRET!).update(`faq-admin:${row.key}`).digest('hex').slice(0, 12),
      },
    }))
    return NextResponse.json({
      faq: { id: faq.id, question: faq.question }, kind,
      totals: { aggregate: faq[kind], recorded, user: users, guest: recorded - users, historical: Math.max(0, faq[kind] - recorded) },
      pagination: { page, pageSize, total }, records,
    }, { headers: { 'Cache-Control': 'private, no-store' } })
    })
  } catch (error) {
    console.error('[faq activity GET]', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
