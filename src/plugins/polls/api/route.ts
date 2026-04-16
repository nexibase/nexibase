import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const category = searchParams.get('category') || ''
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      status: { in: ['active', 'closed'] },
    }
    if (category) where.category = category

    const user = await getAuthUser().catch(() => null)

    const [polls, total] = await Promise.all([
      prisma.poll.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, nickname: true } },
          options: {
            orderBy: { sortOrder: 'asc' },
            include: { _count: { select: { votes: true } } },
          },
        },
      }),
      prisma.poll.count({ where }),
    ])

    const userVotesMap: Record<number, number[]> = {}
    if (user && polls.length > 0) {
      const votes = await prisma.pollVote.findMany({
        where: { pollId: { in: polls.map((p) => p.id) }, userId: user.id },
        select: { pollId: true, optionId: true },
      })
      for (const v of votes) {
        if (!userVotesMap[v.pollId]) userVotesMap[v.pollId] = []
        userVotesMap[v.pollId].push(v.optionId)
      }
    }

    const normalized = polls.map((poll) => {
      const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0)
      const votedOptionIds = userVotesMap[poll.id] || []
      return {
        id: poll.id,
        question: poll.question,
        description: poll.description,
        category: poll.category,
        isMultiple: poll.isMultiple,
        status: poll.status,
        isAi: poll.isAi,
        closesAt: poll.closesAt,
        createdAt: poll.createdAt,
        author: poll.author,
        totalVotes,
        hasVoted: votedOptionIds.length > 0,
        votedOptionIds,
        options: poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          emoji: o.emoji,
          votes: o._count.votes,
        })),
      }
    })

    return NextResponse.json({
      polls: normalized,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('failed to fetch polls:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
