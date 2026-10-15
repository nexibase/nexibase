import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
async function main() {
  const { prisma } = await import('../src/lib/prisma')
  try {
    const path = process.argv[2]
    assert.ok(path, 'Pass the pre-migration baseline JSON path')
    const baseline = JSON.parse(await readFile(path, 'utf8'))
    const notifications = await prisma.$queryRawUnsafe<unknown[]>('SELECT id, userId, type, title, message, link, isRead, createdAt, deletedAt FROM notifications WHERE eventId IS NULL ORDER BY id')
    const preferences = await prisma.$queryRawUnsafe<unknown[]>('SELECT userId, emailPostComment, emailCommentReply, emailMention, emailOrderStatus, emailDirectMessage FROM notification_preferences ORDER BY userId')
    const hash = (rows: unknown[]) => createHash('sha256').update(JSON.stringify(rows)).digest('hex')
    assert.equal(notifications.length, baseline.notifications.count)
    assert.equal(hash(notifications), baseline.notifications.hash, 'Existing notification contents and read states must match the baseline')
    assert.equal(preferences.length, baseline.preferences.count)
    assert.equal(hash(preferences), baseline.preferences.hash, 'Existing email preferences must be preserved')
    console.log(JSON.stringify({ originalNotificationsPreserved: notifications.length, readStatesAndContentUnchanged: true, originalEmailPreferencesPreserved: preferences.length }))
  } finally { await prisma.$disconnect() }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
