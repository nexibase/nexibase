import type { Prisma } from '@prisma/client'
import { getKoreaDay, parseDailyLimit } from './board-limits'

export class BoardDailyLimitError extends Error {
  constructor(public kind: 'post' | 'comment', public limit: number, public resetAt: Date, public scope: 'global' | 'board') {
    super(`${scope === 'global' ? '전체 게시판의' : '이 게시판의'} 오늘 ${kind === 'post' ? '게시글' : '댓글'} 작성 한도(${limit}개)에 도달했습니다. 한국 시간 자정 이후 다시 작성할 수 있습니다.`)
  }
}

// Count existing content directly. The caller holds the member's advisory lock
// until this transaction commits, so concurrent requests cannot reuse a slot.
export async function checkBoardDailyLimit(tx: Prisma.TransactionClient, boardId: number, authorId: number, kind: 'post' | 'comment', postId?: number) {
  // Lock counters before snapshot reads and insertion's shared FK locks.
  if (kind === 'post') await tx.$queryRaw`SELECT id FROM boards WHERE id = ${boardId} FOR UPDATE`
  if (kind === 'comment' && postId !== undefined) await tx.$queryRaw`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`
  const { start, end } = getKoreaDay()
  const board = await tx.board.findUniqueOrThrow({ where: { id: boardId } })
  const key = kind === 'post' ? 'board_daily_post_limit' : 'board_daily_comment_limit'
  const setting = await tx.setting.findUnique({ where: { key } })
  const globalLimit = parseDailyLimit(setting?.value) ?? 0
  const boardLimit = kind === 'post' ? board.dailyPostLimit : board.dailyCommentLimit
  const where = { authorId, createdAt: { gte: start, lt: end } }

  // Global limit first, then this board's additional limit. Zero disables only
  // that particular cap. No usage counters or other persistent records are kept.
  if (globalLimit > 0) {
    const total = kind === 'post' ? await tx.post.count({ where }) : await tx.comment.count({ where })
    if (total >= globalLimit) throw new BoardDailyLimitError(kind, globalLimit, end, 'global')
  }
  if (boardLimit > 0) {
    const count = kind === 'post'
      ? await tx.post.count({ where: { ...where, boardId } })
      : await tx.comment.count({ where: { ...where, post: { boardId } } })
    if (count >= boardLimit) throw new BoardDailyLimitError(kind, boardLimit, end, 'board')
  }
}
