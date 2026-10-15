import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Prisma } from '@prisma/client'
import { BoardDailyLimitError, koreanPostingDay, parseDailyLimits, reserveBoardDailyWrite } from './daily-limits'

test('board defaults and explicit zero are unlimited; invalid settings are rejected', () => {
  assert.deepEqual(parseDailyLimits({}), { dailyPostLimit: 0, dailyCommentLimit: 0 })
  assert.deepEqual(parseDailyLimits({ dailyPostLimit: 0 }, { dailyPostLimit: 2, dailyCommentLimit: 3 }), { dailyPostLimit: 0, dailyCommentLimit: 3 })
  for (const value of [-1, 1.5, '2', null, NaN, Infinity, 1_000_001]) {
    assert.throws(() => parseDailyLimits({ dailyCommentLimit: value }))
  }
})

test('the allowance resets exactly at midnight in Korea, independent of server timezone', () => {
  assert.equal(koreanPostingDay(new Date('2026-10-15T14:59:59.999Z')).day, '2026-10-15')
  const window = koreanPostingDay(new Date('2026-10-15T15:00:00Z'))
  assert.equal(window.day, '2026-10-16')
  assert.equal(window.start.toISOString(), '2026-10-15T15:00:00.000Z')
  assert.equal(window.end.toISOString(), '2026-10-16T15:00:00.000Z')
})

function fixture(postLimit = 2, commentLimit = 0, existingPosts = 0) {
  const usage = new Map<number, { day: string; postCount: number; commentCount: number }>()
  let locked = false
  const tx = {
    $queryRaw: async () => { locked = true; return [{ id: 1 }] },
    board: { findUniqueOrThrow: async () => { assert.ok(locked); return { dailyPostLimit: postLimit, dailyCommentLimit: commentLimit } } },
    post: { count: async () => existingPosts },
    comment: { count: async () => 0 },
    boardDailyUsage: {
      findUnique: async ({ where }: { where: { boardId_userId: { boardId: number } } }) => usage.get(where.boardId_userId.boardId) ?? null,
      upsert: async ({ where, update }: { where: { boardId_userId: { boardId: number } }; update: { day: string; postCount: number; commentCount: number } }) => { usage.set(where.boardId_userId.boardId, update) },
    },
  } as unknown as Prisma.TransactionClient
  return { tx, usage }
}

test('two posts block a third in that board while comments and other boards remain independent', async () => {
  const { tx } = fixture()
  const user = { id: 1, role: 'user' }, now = new Date('2026-10-15T10:00:00Z')
  await reserveBoardDailyWrite(tx, user, 1, 'post', now)
  await reserveBoardDailyWrite(tx, user, 1, 'post', now)
  await assert.rejects(reserveBoardDailyWrite(tx, user, 1, 'post', now), BoardDailyLimitError)
  for (let i = 0; i < 35; i++) await reserveBoardDailyWrite(tx, user, 1, 'comment', now)
  await reserveBoardDailyWrite(tx, user, 2, 'post', now)
  await reserveBoardDailyWrite(tx, user, 1, 'post', new Date('2026-10-15T15:00:00Z'))
})

test('initialization includes existing activity and deletion does not refund a reserved count', async () => {
  const { tx, usage } = fixture(2, 1, 1)
  const user = { id: 1, role: 'user' }, now = new Date('2026-10-15T10:00:00Z')
  await reserveBoardDailyWrite(tx, user, 1, 'post', now)
  assert.equal(usage.get(1)?.postCount, 2)
  await assert.rejects(reserveBoardDailyWrite(tx, user, 1, 'post', now), BoardDailyLimitError)
  await reserveBoardDailyWrite(tx, user, 1, 'comment', now)
  await assert.rejects(reserveBoardDailyWrite(tx, user, 1, 'comment', now), BoardDailyLimitError)
})

test('unlimited boards accept repeated posts and moderation roles do not consume allowances', async () => {
  const { tx, usage } = fixture(0, 0)
  const now = new Date('2026-10-15T10:00:00Z')
  for (let i = 0; i < 12; i++) await reserveBoardDailyWrite(tx, { id: 1, role: 'user' }, 1, 'post', now)
  const count = usage.get(1)?.postCount
  for (const role of ['admin', 'manager']) await reserveBoardDailyWrite(tx, { id: 1, role }, 1, 'post', now)
  assert.equal(usage.get(1)?.postCount, count)
})
