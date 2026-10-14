import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'
import { Prisma } from '@prisma/client'
import { getFeedbackVoter, withVoterCookie } from '@/features/faqs/lib/feedback-voter'
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
    if (type === 'feedback' || type === 'activity') {
      const voter = await getFeedbackVoter(request)
      const votes = await prisma.faqFeedback.findMany({
        where: { voterKey: voter.voterKey, faq: { published: true } },
        select: { faqId: true, helpful: true },
      })
      const views = type === 'activity' ? await prisma.faqView.findMany({
        where: { viewerKey: voter.voterKey, faq: { published: true } }, select: { faqId: true },
      }) : []
      return withVoterCookie(NextResponse.json({ votes, viewedIds: views.map(view => view.faqId), guest: voter.userId === undefined }), voter, request)
    }
    if (type !== 'random') {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }
    const limit = clampLimit(searchParams.get('limit'))
    const faqs = await getCachedRandomFaqs(limit)
    return NextResponse.json({ faqs })
  } catch (e) {
    console.error('[faq public GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const id = body.id
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const faq = await prisma.faq.findUnique({ where: { id }, select: { published: true, views: true } })
    if (!faq || !faq.published) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    if (body.type === 'view') {
      const viewer = await getFeedbackVoter(request)
      if (viewer.cookie) {
        return withVoterCookie(NextResponse.json({ error: 'visitor_required' }, { status: 400 }), viewer, request)
      }
      try {
        const counts = await prisma.$transaction(async tx => {
          // Serialize first inserts before taking FK locks and updating totals.
          await tx.$queryRaw`SELECT id FROM faqs WHERE id = ${id} FOR UPDATE`
          await tx.faqView.create({ data: { faqId: id, viewerKey: viewer.voterKey, userId: viewer.userId } })
          return tx.faq.update({ where: { id }, data: { views: { increment: 1 } }, select: { views: true } })
        })
        return withVoterCookie(NextResponse.json({ ...counts, alreadyViewed: false }), viewer, request)
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
        const view = await prisma.faqView.findUnique({ where: { faqId_viewerKey: { faqId: id, viewerKey: viewer.voterKey } } })
        const counts = await prisma.faq.findUnique({ where: { id }, select: { views: true } })
        if (!view || !counts) throw error
        return withVoterCookie(NextResponse.json({ ...counts, alreadyViewed: true }), viewer, request)
      }
    }

    if (body.type === 'feedback') {
      const field = body.helpful === true ? 'helpful' : body.helpful === false ? 'notHelpful' : null
      if (!field) return NextResponse.json({ error: 'helpful boolean required' }, { status: 400 })
      const voter = await getFeedbackVoter(request)
      // Establish a signed identity before accepting an anonymous vote. This
      // prevents concurrent first requests from creating different identities.
      if (voter.cookie) {
        return withVoterCookie(NextResponse.json({ error: 'visitor_required' }, { status: 400 }), voter, request)
      }
      try {
        const result = await prisma.$transaction(async tx => {
          // Lock the parent before inserting the FK child. Concurrent first
          // votes otherwise hold shared FK locks while upgrading the count.
          await tx.$queryRaw`SELECT id FROM faqs WHERE id = ${id} FOR UPDATE`
          await tx.faqFeedback.create({ data: { faqId: id, voterKey: voter.voterKey, userId: voter.userId, helpful: body.helpful } })
          return tx.faq.update({
            where: { id }, data: { [field]: { increment: 1 } },
            select: { helpful: true, notHelpful: true },
          })
        })
        return withVoterCookie(NextResponse.json({ ...result, voted: true, choice: body.helpful, alreadyVoted: false }), voter, request)
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
        const vote = await prisma.faqFeedback.findUnique({ where: { faqId_voterKey: { faqId: id, voterKey: voter.voterKey } } })
        const counts = await prisma.faq.findUnique({ where: { id }, select: { helpful: true, notHelpful: true } })
        if (!vote || !counts) throw error
        return withVoterCookie(NextResponse.json({ ...counts, voted: true, choice: vote.helpful, alreadyVoted: true }), voter, request)
      }
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (e) {
    console.error('[faq public PATCH]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
