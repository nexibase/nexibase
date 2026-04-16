import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { callClaude } from '@/plugins/polls/lib/claude-client'
import { buildSystemPrompt, buildUserPrompt, parseAiResponse } from '@/plugins/polls/lib/prompt-builder'

// Admin: generate poll with AI
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 401 })
    }

    const body = await request.json()
    const { topic } = body

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json({ error: 'Topic is required.' }, { status: 400 })
    }

    // Create generation log
    const log = await prisma.pollGenerationLog.create({
      data: {
        topic: topic.trim(),
        status: 'pending',
      },
    })

    try {
      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt(topic.trim())

      const { text, inputTokens, outputTokens } = await callClaude(systemPrompt, userPrompt)

      const parsed = parseAiResponse(text)

      // Create the poll with options
      const poll = await prisma.poll.create({
        data: {
          question: parsed.question,
          description: parsed.description,
          category: parsed.category,
          isMultiple: parsed.isMultiple,
          status: 'active',
          isAi: true,
          authorId: admin.id,
          options: {
            create: parsed.options.map((opt, index) => ({
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

      // Update log with success
      await prisma.pollGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          pollId: poll.id,
          tokensUsed: (inputTokens || 0) + (outputTokens || 0),
          finishedAt: new Date(),
        },
      })

      return NextResponse.json({ success: true, poll }, { status: 201 })
    } catch (aiError) {
      // Update log with failure
      await prisma.pollGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage: aiError instanceof Error ? aiError.message : 'Unknown error',
          finishedAt: new Date(),
        },
      })

      console.error('AI generation failed:', aiError)
      return NextResponse.json({ error: 'AI generation failed.' }, { status: 500 })
    }
  } catch (error) {
    console.error('failed to generate poll:', error)
    return NextResponse.json({ error: 'Server error.' }, { status: 500 })
  }
}
