import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// Vote on a poll
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required to vote.' }, { status: 401 })
    }

    const { id } = await params
    const pollId = parseInt(id)
    const body = await request.json()
    const { optionIds } = body

    if (!optionIds || !Array.isArray(optionIds) || optionIds.length === 0) {
      return NextResponse.json({ error: 'At least one option must be selected.' }, { status: 400 })
    }

    // Fetch poll with options
    const poll = await prisma.poll.findUnique({
      where: { id: pollId },
      include: { options: true },
    })

    if (!poll) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    }

    // Check poll is active
    if (poll.status !== 'active') {
      return NextResponse.json({ error: 'This poll is not active.' }, { status: 400 })
    }

    // Check poll hasn't expired
    if (poll.closesAt && new Date(poll.closesAt) < new Date()) {
      return NextResponse.json({ error: 'This poll has closed.' }, { status: 400 })
    }

    // Check user hasn't already voted
    const existingVote = await prisma.pollVote.findFirst({
      where: { pollId, userId: user.id },
    })

    if (existingVote) {
      return NextResponse.json({ error: 'You have already voted on this poll.' }, { status: 409 })
    }

    // Validate single vs multiple choice
    if (!poll.isMultiple && optionIds.length > 1) {
      return NextResponse.json({ error: 'This poll allows only one selection.' }, { status: 400 })
    }

    // Validate all option IDs belong to this poll
    const validOptionIds = poll.options.map((o) => o.id)
    const allValid = optionIds.every((oid: number) => validOptionIds.includes(oid))
    if (!allValid) {
      return NextResponse.json({ error: 'Invalid option selected.' }, { status: 400 })
    }

    // Get IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') || null

    // Create votes
    await prisma.pollVote.createMany({
      data: optionIds.map((optionId: number) => ({
        pollId,
        optionId,
        userId: user.id,
        ip,
      })),
    })

    return NextResponse.json({ success: true, message: 'Vote recorded.' })
  } catch (error) {
    console.error('failed to vote:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}

// Cancel vote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Login required.' }, { status: 401 })
    }

    const { id } = await params
    const pollId = parseInt(id)

    // Check poll exists
    const poll = await prisma.poll.findUnique({ where: { id: pollId } })
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found.' }, { status: 404 })
    }

    // Delete all user's votes for this poll
    const deleted = await prisma.pollVote.deleteMany({
      where: { pollId, userId: user.id },
    })

    if (deleted.count === 0) {
      return NextResponse.json({ error: 'No votes to cancel.' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Vote cancelled.' })
  } catch (error) {
    console.error('failed to cancel vote:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
