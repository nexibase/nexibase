import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { resolveSlot } from '@/plugins/vibe-coding-recipes/cron/slot-resolver'
import { buildSystemPrompt, buildUserPrompt } from '@/plugins/vibe-coding-recipes/cron/prompt-builder'
import { callClaude } from '@/plugins/vibe-coding-recipes/cron/claude-client'
import {
  parseClaudeResponse,
  validateRecipe,
  ensureUniqueSlug,
} from '@/plugins/vibe-coding-recipes/cron/recipe-validator'

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const difficulty = body.difficulty as string
    const type = body.type as string

    if (!difficulty || !type) {
      return NextResponse.json({ error: 'difficulty and type required' }, { status: 400 })
    }

    const slot = await resolveSlot(prisma, { difficulty: difficulty as any, type: type as any })

    const log = await prisma.vibeRecipeGenerationLog.create({
      data: {
        status: 'running',
        difficulty: slot.difficulty,
        type: slot.type,
        slot: slot.slot,
      },
    })

    try {
      const existingRecipes = await prisma.vibeRecipe.findMany({
        orderBy: { generatedAt: 'desc' },
        take: 100,
        select: { titleEn: true, slug: true },
      })

      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt(slot, existingRecipes)

      const response = await callClaude(systemPrompt, userPrompt)
      const parsed = parseClaudeResponse(response.text)
      const validated = validateRecipe(parsed)
      const uniqueSlug = await ensureUniqueSlug(prisma, validated.slug)

      const model = process.env.VIBE_RECIPES_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

      const recipe = await prisma.vibeRecipe.create({
        data: {
          slug: uniqueSlug,
          difficulty: validated.difficulty,
          type: validated.type,
          titleEn: validated.titleEn,
          titleKo: validated.titleKo,
          descriptionEn: validated.descriptionEn,
          descriptionKo: validated.descriptionKo,
          constraintsEn: validated.constraintsEn,
          constraintsKo: validated.constraintsKo,
          stepsEn: validated.stepsEn,
          stepsKo: validated.stepsKo,
          model,
        },
      })

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          recipeId: recipe.id,
          tokensUsed: response.inputTokens + response.outputTokens,
        },
      })

      return NextResponse.json({ success: true, recipe })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: msg.slice(0, 2000),
        },
      })

      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (error) {
    console.error('Failed to generate vibe recipe:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
