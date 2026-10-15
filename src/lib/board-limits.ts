export const BOARD_LIMIT_SETTING_KEYS = ['board_daily_post_limit', 'board_daily_comment_limit'] as const
export const MAX_DAILY_LIMIT = 2_147_483_647

// Keep numeric input strict: never silently truncate decimals or treat blanks as zero.
export function parseDailyLimit(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return undefined
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= MAX_DAILY_LIMIT ? number : undefined
}

export function isBoardDailyLimit(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === 'number' && parseDailyLimit(value) !== undefined)
}

export function getKoreaDay(now = new Date()) {
  const offset = 9 * 60 * 60 * 1000
  const date = new Date(now.getTime() + offset).toISOString().slice(0, 10)
  const day = new Date(`${date}T00:00:00.000Z`)
  const start = new Date(day.getTime() - offset)
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return { day, start, end }
}
