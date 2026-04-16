import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Admin: get single poll
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
    }

    const { id } = await params
    const pollId = parseInt(id)

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        author: { select: { id: true, nickname: true } },
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { votes: true } },
      },
    })

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, poll })
  } catch (error) {
    console.error('failed to fetch poll:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

// Admin: update poll
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
    }

    const { id } = await params
    const pollId = parseInt(id)
    const body = await request.json()
    const { question, description, category, isMultiple, status, closesAt, options } = body

    const existing = await prisma.poll.findUnique({ where: { id: pollId } })
    if (!existing) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    }

    // Update poll and optionally replace options
    const updateData: Record<string, unknown> = {}
    if (question !== undefined) updateData.question = question
    if (description !== undefined) updateData.description = description || null
    if (category !== undefined) updateData.category = category || null
    if (isMultiple !== undefined) updateData.isMultiple = isMultiple
    if (status !== undefined) updateData.status = status
    if (closesAt !== undefined) updateData.closesAt = closesAt ? new Date(closesAt) : null

    // If options are provided, delete existing and recreate
    if (options && Array.isArray(options) && options.length >= 2) {
      await prisma.pollOption.deleteMany({ where: { pollId } })

      await prisma.poll.update({
        where: { id: pollId },
        data: {
          ...updateData,
          options: {
            create: options.map((opt: { label: string; emoji?: string }, index: number) => ({
              label: opt.label,
              emoji: opt.emoji || null,
              sortOrder: index,
            })),
          },
        },
      })
    } else {
      await prisma.poll.update({
        where: { id: pollId },
        data: updateData,
      })
    }

    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          orderBy: { sortOrder: 'asc' },
          include: { _count: { select: { votes: true } } },
        },
        _count: { select: { votes: true } },
      },
    })

    return NextResponse.json({ success: true, poll })
  } catch (error) {
    console.error('failed to update poll:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

// Admin: delete poll
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
    }

    const { id } = await params
    const pollId = parseInt(id)

    const existing = await prisma.poll.findUnique({ where: { id: pollId } })
    if (!existing) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    }

    await prisma.poll.delete({ where: { id: pollId } })

    return NextResponse.json({ success: true, message: 'Poll deleted.' })
  } catch (error) {
    console.error('failed to delete poll:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
