// Explicit opt-in: creates isolated, non-public fixtures and removes only those fixtures.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { BoardDailyLimitError, reserveBoardDailyWrite } from '../src/features/boards/lib/daily-limits'

async function main() {
  assert.equal(process.env.BOARD_LIMITS_DB_TEST, '1', 'Set BOARD_LIMITS_DB_TEST=1 to run database integration checks')
  const db = new PrismaClient()
  const tag = randomUUID().replaceAll('-', '').slice(0, 12)
  let userId: number | undefined
  const boardIds: number[] = []
  try {
    const user = await db.user.create({ data: { email: `board-limit-test-${tag}@example.invalid`, nickname: `limitTest${tag}` } })
    userId = user.id
    const actor = { id: user.id, role: 'user' }
    for (let i = 0; i < 2; i++) {
      const board = await db.board.create({ data: { slug: `quota-test-${tag}-${i}`, name: 'Daily limit integration fixture', isActive: false, listMemberOnly: true, readMemberOnly: true, dailyPostLimit: 2, dailyCommentLimit: 1 } })
      boardIds.push(board.id)
    }
    const write = (boardId: number, now?: Date) => db.$transaction(async tx => {
      await reserveBoardDailyWrite(tx, actor, boardId, 'post', now)
      return tx.post.create({ data: { boardId, authorId: user.id, title: 'Integration fixture', content: 'Temporary draft', status: 'draft' } })
    }, { maxWait: 15000, timeout: 15000 })
    const concurrent = await Promise.allSettled(Array.from({ length: 6 }, () => write(boardIds[0])))
    assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 2)
    for (const result of concurrent) if (result.status === 'rejected') assert.ok(result.reason instanceof BoardDailyLimitError)
    const post = await db.post.findFirstOrThrow({ where: { boardId: boardIds[0] } })
    await db.post.delete({ where: { id: post.id } })
    await assert.rejects(write(boardIds[0]), BoardDailyLimitError)
    const remaining = await db.post.findFirstOrThrow({ where: { boardId: boardIds[0] } })
    await db.$transaction(async tx => {
      await reserveBoardDailyWrite(tx, actor, boardIds[0], 'comment')
      await tx.comment.create({ data: { postId: remaining.id, authorId: user.id, content: 'Temporary comment' } })
    })
    await db.comment.deleteMany({ where: { postId: remaining.id } })
    await assert.rejects(db.$transaction(tx => reserveBoardDailyWrite(tx, actor, boardIds[0], 'comment')), BoardDailyLimitError)
    await write(boardIds[1])
    const before = await db.boardDailyUsage.findUniqueOrThrow({ where: { boardId_userId: { boardId: boardIds[1], userId: user.id } } })
    await assert.rejects(db.$transaction(async tx => {
      await reserveBoardDailyWrite(tx, actor, boardIds[1], 'post')
      throw new Error('Intentional rollback')
    }), /Intentional rollback/)
    const after = await db.boardDailyUsage.findUniqueOrThrow({ where: { boardId_userId: { boardId: boardIds[1], userId: user.id } } })
    assert.equal(after.postCount, before.postCount)
    await write(boardIds[0], new Date(Date.now() + 86400000))
    await db.board.update({ where: { id: boardIds[1] }, data: { dailyPostLimit: 0, dailyCommentLimit: 0 } })
    for (let i = 0; i < 4; i++) await write(boardIds[1])
    await db.$transaction(tx => reserveBoardDailyWrite(tx, { ...actor, role: 'admin' }, boardIds[0], 'post'))
    console.log(JSON.stringify({ passed: true, checks: ['concurrent cap', 'post and comment deletion do not refund', 'board isolation', 'rollback', 'next day', 'zero is unlimited', 'admin exemption'] }))
  } finally {
    if (boardIds.length) await db.board.deleteMany({ where: { id: { in: boardIds } } })
    if (userId) await db.user.delete({ where: { id: userId } })
    await db.$disconnect()
  }
}
main().catch(() => { console.error('Board daily limit database checks failed'); process.exitCode = 1 })
