import type { Prisma } from '@prisma/client'
import { getKoreaDay, parseDailyLimit } from './board-limits'

export class BoardDailyLimitError extends Error {
  constructor(public kind: 'post' | 'comment', public limit: number, public resetAt: Date, public scope: 'global' | 'board') {
    super(`${scope === 'global' ? '전체 게시판의' : '이 게시판의'} 오늘 ${kind === 'post' ? '게시글' : '댓글'} 작성 한도(${limit}개)에 도달했습니다. 한국 시간 자정 이후 다시 작성할 수 있습니다.`)
  }
}

// Lock before consistent reads so requests see the previous committed usage.
// Do not lock users: notification fan-out references other members' user rows.
export async function consumeBoardDailyUsage(tx: Prisma.TransactionClient, boardId: number, authorId: number, kind: 'post' | 'comment', postId?: number) {
  await tx.$executeRaw`INSERT INTO board_write_locks (authorId) VALUES (${authorId}) ON DUPLICATE KEY UPDATE id = id`
  // Post creation later increments boards.postCount. Acquire its exclusive
  // lock before FK checks take shared locks, avoiding lock-upgrade deadlocks.
  if (kind === 'post') await tx.$queryRaw`SELECT id FROM boards WHERE id = ${boardId} FOR UPDATE`
  // Comment insertion also increments posts.commentCount. Lock before any
  // snapshot reads or FK checks, including the initial usage backfill query.
  if (kind === 'comment' && postId !== undefined) await tx.$queryRaw`SELECT id FROM posts WHERE id = ${postId} FOR UPDATE`
  const { day, start, end } = getKoreaDay()
  const board = await tx.board.findUniqueOrThrow({ where: { id: boardId } })
  const key = kind === 'post' ? 'board_daily_post_limit' : 'board_daily_comment_limit'
  const setting = await tx.setting.findUnique({ where: { key } })
  const globalLimit = parseDailyLimit(setting?.value) ?? 0
  const boardLimit = kind === 'post' ? board.dailyPostLimit : board.dailyCommentLimit
  const where = { boardId_authorId_day: { boardId, authorId, day } }
  let usage = await tx.boardDailyUsage.findUnique({ where })
  if (!usage) {
    // Include existing content on the first write after upgrading, including
    // soft-deleted posts. Later deletions never give consumed quota back.
    const createdAt = { gte: start, lt: end }
    const postCount = await tx.post.count({ where: { boardId, authorId, createdAt } })
    const commentCount = await tx.comment.count({ where: { authorId, createdAt, post: { boardId } } })
    usage = await tx.boardDailyUsage.create({ data: { boardId, authorId, day, postCount, commentCount } })
  }
  // The site-wide cap is checked first, across every board. A board's zero
  // only disables its own cap; it never overrides the site-wide restriction.
  if (globalLimit > 0) {
    const totals = await tx.boardDailyUsage.aggregate({ where: { authorId, day }, _sum: { postCount: true, commentCount: true } })
    const total = (kind === 'post' ? totals._sum.postCount : totals._sum.commentCount) ?? 0
    if (total >= globalLimit) throw new BoardDailyLimitError(kind, globalLimit, end, 'global')
  }
  const used = kind === 'post' ? usage.postCount : usage.commentCount
  if (boardLimit > 0 && used >= boardLimit) throw new BoardDailyLimitError(kind, boardLimit, end, 'board')
  await tx.boardDailyUsage.update({ where, data: kind === 'post' ? { postCount: { increment: 1 } } : { commentCount: { increment: 1 } } })
}
