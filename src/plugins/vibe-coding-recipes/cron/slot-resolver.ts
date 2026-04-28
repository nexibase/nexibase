import { PrismaClient } from '@prisma/client'

export interface SlotResult {
  slot: 1 | 2 | 3
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  type: 'plugin' | 'widget' | 'plugin_with_widget'
}

// One recipe per weekday, generated at 07:00 KST.
// Sat/Sun: cron does not fire; admin UI calls always pass overrides so the
// fallback path is rare but safe (defaults to beginner / weekday-style type).
const WEEKDAY_DIFFICULTY: Record<number, SlotResult['difficulty']> = {
  1: 'beginner',     // Mon
  2: 'beginner',     // Tue
  3: 'beginner',     // Wed
  4: 'intermediate', // Thu
  5: 'advanced',     // Fri
}

export async function resolveSlot(
  prisma: PrismaClient,
  overrides?: { difficulty?: SlotResult['difficulty']; type?: SlotResult['type'] }
): Promise<SlotResult> {
  const dayOfWeek = new Date().getDay()
  const difficulty =
    overrides?.difficulty ?? WEEKDAY_DIFFICULTY[dayOfWeek] ?? 'beginner'

  let type: SlotResult['type']
  if (overrides?.type) {
    type = overrides.type
  } else if (difficulty === 'advanced') {
    type = 'plugin_with_widget'
  } else if (difficulty === 'intermediate') {
    type = 'plugin'
  } else {
    type = await getNextBeginnerType(prisma)
  }

  // slot is kept in the schema but no longer disambiguates time-of-day.
  // Always 1 since there's a single fire per day.
  return { slot: 1, difficulty, type }
}

async function getNextBeginnerType(
  prisma: PrismaClient
): Promise<'plugin' | 'widget'> {
  const last = await prisma.vibeRecipe.findFirst({
    where: { difficulty: 'beginner' },
    orderBy: { generatedAt: 'desc' },
    select: { type: true },
  })
  return last?.type === 'plugin' ? 'widget' : 'plugin'
}
