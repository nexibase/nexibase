import type { Prisma } from '@prisma/client'

export type DailyLimits = { dailyPostLimit: number; dailyCommentLimit: number }
export const UNLIMITED: DailyLimits = { dailyPostLimit: 0, dailyCommentLimit: 0 }

export function parseDailyLimits(input: Record<string, unknown>, defaults = UNLIMITED): DailyLimits {
  const result = { ...defaults }
  for (const key of ['dailyPostLimit', 'dailyCommentLimit'] as const) {
    if (input[key] === undefined) continue
    const value = input[key]
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 1_000_000) {
      throw new Error('일일 등록 제한은 0~1,000,000 사이의 정수로 입력해 주세요. 0은 무제한입니다.')
    }
    result[key] = value
  }
  return result
}

export function koreanPostingDay(now: Date) {
  const day = new Date(now.getTime() + 9 * 3600000).toISOString().slice(0, 10)
  const start = new Date(`${day}T00:00:00+09:00`)
  return { day, start, end: new Date(start.getTime() + 86400000) }
}

export class BoardDailyLimitError extends Error {
  constructor(public kind: 'post' | 'comment', public limit: number, public resetAt: Date) {
    super(`이 게시판의 하루 ${kind === 'post' ? '글' : '댓글'} 등록 한도 ${limit}개를 모두 사용했어요. 한국 시간 자정 이후 다시 등록해 주세요.`)
  }
}

// Call inside the SAME transaction as the post/comment creation. Locking a stable
// user row also serializes the first request of a day across processes.
export async function reserveBoardDailyWrite(
  tx: Prisma.TransactionClient,
  user: { id: number; role: string },
  boardId: number,
  kind: 'post' | 'comment',
  now?: Date,
) {
  if (user.role === 'admin' || user.role === 'manager') return
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${user.id} FOR UPDATE`
  const { day, start, end } = koreanPostingDay(now ?? new Date())
  const board = await tx.board.findUniqueOrThrow({ where: { id: boardId } })
  const prior = await tx.boardDailyUsage.findUnique({ where: { boardId_userId: { boardId, userId: user.id } } })
  // Include pre-feature activity when initializing; soft-deleted posts count too.
  const counts = prior?.day === day ? prior : {
    postCount: await tx.post.count({ where: { boardId, authorId: user.id, createdAt: { gte: start, lt: end } } }),
    commentCount: await tx.comment.count({ where: { post: { boardId }, authorId: user.id, createdAt: { gte: start, lt: end } } }),
  }
  const field = kind === 'post' ? 'postCount' : 'commentCount'
  const limit = kind === 'post' ? board.dailyPostLimit : board.dailyCommentLimit
  if (limit > 0 && counts[field] >= limit) throw new BoardDailyLimitError(kind, limit, end)
  const data = { day, postCount: counts.postCount, commentCount: counts.commentCount, [field]: counts[field] + 1 }
  await tx.boardDailyUsage.upsert({
    where: { boardId_userId: { boardId, userId: user.id } },
    create: { boardId, userId: user.id, ...data },
    update: data,
  })
}
