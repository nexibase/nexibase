import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
    const now = new Date()
    const user = await getAuthUser().catch(() => null)

    const poll = await prisma.poll.findFirst({
      where: {
        status: 'active',
        OR: [{ closesAt: null }, { closesAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
      },
    })

    if (!poll) return NextResponse.json({ poll: null })

    let votedOptionIds: number[] = []
    if (user) {
      const votes = await prisma.pollVote.findMany({
        where: { pollId: poll.id, userId: user.id },
        select: { optionId: true },
      })
      votedOptionIds = votes.map((v) => v.optionId)
    }

    const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0)

    return NextResponse.json({
      poll: {
        id: poll.id,
        question: poll.question,
        description: poll.description,
        category: poll.category,
        isMultiple: poll.isMultiple,
        status: poll.status,
        isAi: poll.isAi,
        closesAt: poll.closesAt,
        createdAt: poll.createdAt,
        totalVotes,
        hasVoted: votedOptionIds.length > 0,
        votedOptionIds,
        options: poll.options.map((o) => ({
          id: o.id,
          label: o.label,
          emoji: o.emoji,
          votes: o._count.votes,
        })),
      },
    })
  } catch (error) {
    console.error('failed to fetch current poll:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
