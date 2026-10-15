import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Prisma } from '@prisma/client'
import { BoardDailyLimitError, consumeBoardDailyUsage } from './board-daily-usage'

function fixture(globalLimit: number, boardLimit: number, posts = 0, comments = 0, totalPosts = posts, totalComments = comments) {
  const calls: string[] = []
  const usage = { postCount: posts, commentCount: comments }
  const tx = {
    $executeRaw: async () => { calls.push('lock') },
    $queryRaw: async () => { calls.push('board-lock') },
    board: { findUniqueOrThrow: async () => { calls.push('board'); return { dailyPostLimit: boardLimit, dailyCommentLimit: boardLimit } } },
    setting: { findUnique: async () => ({ value: String(globalLimit) }) },
    boardDailyUsage: {
      findUnique: async () => usage,
      aggregate: async () => ({ _sum: { postCount: totalPosts, commentCount: totalComments } }),
      update: async ({ data }: { data: { postCount?: unknown; commentCount?: unknown } }) => {
        if (data.postCount) usage.postCount++
        if (data.commentCount) usage.commentCount++
      },
    },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, calls, usage }
}

test('global limit wins when both limits are exhausted', async () => {
  const { tx, usage, calls } = fixture(2, 1, 1, 0, 2)
  await assert.rejects(consumeBoardDailyUsage(tx, 7, 3, 'post'), (error: unknown) => {
    assert.ok(error instanceof BoardDailyLimitError)
    assert.equal(error.scope, 'global')
    assert.equal(error.limit, 2)
    return true
  })
  assert.equal(usage.postCount, 1)
  assert.equal(calls[0], 'lock')
})

test('board zero cannot bypass a global limit reached on other boards', async () => {
  const { tx, usage } = fixture(5, 0, 0, 0, 5)
  await assert.rejects(consumeBoardDailyUsage(tx, 7, 3, 'post'), { scope: 'global' })
  assert.equal(usage.postCount, 0)
})

test('board limit applies after passing the global limit', async () => {
  const { tx } = fixture(10, 2, 2, 0, 4)
  await assert.rejects(consumeBoardDailyUsage(tx, 7, 3, 'post'), { scope: 'board', limit: 2 })
})

test('global zero still allows board limits to block comments and replies', async () => {
  const { tx, usage } = fixture(0, 3, 0, 3)
  await assert.rejects(consumeBoardDailyUsage(tx, 7, 3, 'comment'), { scope: 'board', kind: 'comment' })
  assert.equal(usage.commentCount, 3)
})

test('one slot below the cap succeeds and post/comment quotas are independent', async () => {
  const { tx, usage } = fixture(5, 3, 2, 3, 4, 5)
  await consumeBoardDailyUsage(tx, 7, 3, 'post')
  assert.deepEqual(usage, { postCount: 3, commentCount: 3 })
})

test('both zeros permit writes but keep recording usage for later limit changes', async () => {
  const { tx, usage } = fixture(0, 0, 100, 200)
  await consumeBoardDailyUsage(tx, 7, 3, 'post')
  await consumeBoardDailyUsage(tx, 7, 3, 'comment')
  assert.deepEqual(usage, { postCount: 101, commentCount: 201 })
})
