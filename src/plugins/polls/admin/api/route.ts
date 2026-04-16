import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Admin: list polls with pagination/search + stats
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { question: { contains: search } },
        { description: { contains: search } },
        { category: { contains: search } },
      ]
    }
    if (status) {
      where.status = status
    }

    const [polls, total, activeCount, totalVotes] = await Promise.all([
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
          _count: { select: { votes: true } },
        },
      }),
      prisma.poll.count({ where }),
      prisma.poll.count({ where: { status: 'active' } }),
      prisma.pollVote.count(),
    ])

    return NextResponse.json({
      success: true,
      polls,
      stats: { total: await prisma.poll.count(), activeCount, totalVotes },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('failed to fetch polls:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

// Admin: create poll
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
    }

    const body = await request.json()
    const { question, description, category, isMultiple, status, closesAt, options } = body

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: 'Question and at least 2 options are required.' },
        { status: 400 }
      )
    }

    const poll = await prisma.poll.create({
      data: {
        question,
        description: description || null,
        category: category || null,
        isMultiple: isMultiple ?? false,
        status: status || 'active',
        closesAt: closesAt ? new Date(closesAt) : null,
        authorId: admin.id,
        options: {
          create: options.map((opt: { label: string; emoji?: string }, index: number) => ({
            label: opt.label,
            emoji: opt.emoji || null,
            sortOrder: index,
          })),
        },
      },
      include: {
        options: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return NextResponse.json({ success: true, poll }, { status: 201 })
  } catch (error) {
    console.error('failed to create poll:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
