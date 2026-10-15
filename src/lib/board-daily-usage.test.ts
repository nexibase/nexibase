import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Prisma } from '@prisma/client'
import { BoardDailyLimitError, checkBoardDailyLimit } from './board-daily-usage'

type CountWhere = { authorId: number; createdAt: { gte: Date; lt: Date }; boardId?: number; post?: { boardId: number } }

function fixture(globalLimit: number, boardLimit: number, posts = 0, comments = 0, totalPosts = posts, totalComments = comments) {
  const counts: { kind: string; where: CountWhere }[] = []
  const tx = {
    $queryRaw: async () => [],
    board: { findUniqueOrThrow: async () => ({ dailyPostLimit: boardLimit, dailyCommentLimit: boardLimit }) },
    setting: { findUnique: async () => ({ value: String(globalLimit) }) },
    post: { count: async ({ where }: { where: CountWhere }) => { counts.push({ kind: 'post', where }); return where.boardId ? posts : totalPosts } },
    comment: { count: async ({ where }: { where: CountWhere }) => { counts.push({ kind: 'comment', where }); return where.post ? comments : totalComments } },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, counts }
}

test('global count wins when both limits are exhausted, without querying the board count', async () => {
  const { tx, counts } = fixture(2, 1, 1, 0, 2)
  await assert.rejects(checkBoardDailyLimit(tx, 7, 3, 'post'), (error: unknown) => {
    assert.ok(error instanceof BoardDailyLimitError)
    assert.equal(error.scope, 'global')
    assert.equal(error.limit, 2)
    return true
  })
  assert.equal(counts.length, 1)
  assert.equal(counts[0].where.boardId, undefined)
})

test('board zero cannot bypass a global limit reached on other boards', async () => {
  const { tx } = fixture(5, 0, 0, 0, 5)
  await assert.rejects(checkBoardDailyLimit(tx, 7, 3, 'post'), { scope: 'global' })
})

test('board post count is checked after passing the global count', async () => {
  const { tx, counts } = fixture(10, 2, 2, 0, 4)
  await assert.rejects(checkBoardDailyLimit(tx, 7, 3, 'post'), { scope: 'board', limit: 2 })
  assert.deepEqual(counts.map(c => c.where.boardId), [undefined, 7])
})

test('global zero still checks comments on every post in the requested board', async () => {
  const { tx, counts } = fixture(0, 3, 0, 3)
  await assert.rejects(checkBoardDailyLimit(tx, 7, 3, 'comment', 9), { scope: 'board', kind: 'comment' })
  assert.equal(counts.length, 1)
  assert.deepEqual(counts[0].where.post, { boardId: 7 })
})

test('one slot below the cap succeeds using only the requested member and Korean date range', async () => {
  const { tx, counts } = fixture(5, 3, 2, 3, 4, 5)
  await checkBoardDailyLimit(tx, 7, 3, 'post')
  assert.equal(counts.length, 2)
  for (const c of counts) {
    assert.equal(c.kind, 'post')
    assert.equal(c.where.authorId, 3)
    assert.equal(c.where.createdAt.gte.getUTCHours(), 15)
    assert.equal(c.where.createdAt.lt.getTime() - c.where.createdAt.gte.getTime(), 24 * 3600000)
  }
})

test('both zero limits skip content counting entirely', async () => {
  const { tx, counts } = fixture(0, 0, 100, 200)
  await checkBoardDailyLimit(tx, 7, 3, 'post')
  await checkBoardDailyLimit(tx, 7, 3, 'comment', 9)
  assert.equal(counts.length, 0)
})
