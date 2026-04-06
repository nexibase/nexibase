const globalForRateLimit = globalThis as unknown as {
  bidRateLimit: Map<number, { count: number; resetAt: number }> | undefined
}

const bidRateLimit: Map<number, { count: number; resetAt: number }> =
  globalForRateLimit.bidRateLimit ?? new Map()

if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.bidRateLimit = bidRateLimit
}

const MAX_BIDS_PER_MINUTE = 10

export function checkBidRateLimit(userId: number): {
  allowed: boolean
  remaining: number
} {
  const now = Date.now()
  const entry = bidRateLimit.get(userId)

  if (!entry || now > entry.resetAt) {
    bidRateLimit.set(userId, { count: 1, resetAt: now + 60_000 })
    return { allowed: true, remaining: MAX_BIDS_PER_MINUTE - 1 }
  }

  if (entry.count >= MAX_BIDS_PER_MINUTE) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: MAX_BIDS_PER_MINUTE - entry.count }
}
