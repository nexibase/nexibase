import { PrismaClient } from '@prisma/client'

export interface ValidatedRecipe {
  slug: string
  titleEn: string
  titleKo: string
  descriptionEn: string
  descriptionKo: string
  difficulty: string
  type: string
  constraintsEn: string[]
  constraintsKo: string[]
  stepsEn: { step: number; prompt: string; expected: string }[]
  stepsKo: { step: number; prompt: string; expected: string }[]
}

const STEP_LIMITS: Record<string, [number, number]> = {
  beginner: [2, 3],
  intermediate: [4, 6],
  advanced: [6, 10],
}

export function parseClaudeResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '')
  cleaned = cleaned.replace(/\s*```$/, '')

  const parsed = JSON.parse(cleaned)
  if (Array.isArray(parsed)) return parsed[0]
  return parsed
}

export function validateRecipe(data: Record<string, unknown>): ValidatedRecipe {
  const required = [
    'slug', 'titleEn', 'titleKo', 'descriptionEn', 'descriptionKo',
    'difficulty', 'type', 'constraintsEn', 'constraintsKo', 'stepsEn', 'stepsKo',
  ] as const

  for (const key of required) {
    if (!data[key]) {
      throw new Error(`Missing required field: ${key}`)
    }
  }

  const slug = String(data.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const difficulty = String(data.difficulty)
  const type = String(data.type)

  if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    throw new Error(`Invalid difficulty: ${difficulty}`)
  }
  if (!['plugin', 'widget', 'plugin_with_widget'].includes(type)) {
    throw new Error(`Invalid type: ${type}`)
  }

  const stepsEn = data.stepsEn as ValidatedRecipe['stepsEn']
  const stepsKo = data.stepsKo as ValidatedRecipe['stepsKo']
  const [min, max] = STEP_LIMITS[difficulty] ?? [2, 10]

  if (stepsEn.length < min || stepsEn.length > max) {
    console.warn(`[vibe-recipes] Steps count ${stepsEn.length} outside expected range [${min}, ${max}] for ${difficulty}`)
  }

  return {
    slug,
    titleEn: String(data.titleEn),
    titleKo: String(data.titleKo),
    descriptionEn: String(data.descriptionEn),
    descriptionKo: String(data.descriptionKo),
    difficulty,
    type,
    constraintsEn: (data.constraintsEn as string[]) ?? [],
    constraintsKo: (data.constraintsKo as string[]) ?? [],
    stepsEn,
    stepsKo,
  }
}

export async function ensureUniqueSlug(
  prisma: PrismaClient,
  slug: string
): Promise<string> {
  let candidate = slug
  let counter = 1
  while (await prisma.vibeRecipe.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${counter++}`
  }
  return candidate
}
