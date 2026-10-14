import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const [base, mode = 'verify', statePath = '/tmp/nexibase-member-edit-fixture.json'] = process.argv.slice(2)
assert.ok(base && process.env.NEXTAUTH_SECRET)
assert.ok(['verify', 'prepare', 'check', 'cleanup'].includes(mode))
type Fixture = { id: number; uuid: string; email: string; passwordDigest: string }
const digest = (value: unknown) => createHash('sha256').update(String(value)).digest('hex')

async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin', status: 'active', deletedAt: null } })
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(admin.id), sub: String(admin.id), email: admin.email }, maxAge: 600 })
  const cookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
  let requests = 0
  async function request(path: string, expected = 200, method = 'GET', body?: unknown, actorCookie = cookie) {
    requests++
    const response = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Cookie: actorCookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    assert.equal(response.status, expected, `${method} ${path}`)
    return response.json()
  }
  let fixture: Fixture | undefined
  async function cleanup() {
    if (!fixture) return
    assert.ok(fixture.email.startsWith('member-edit-check-') && fixture.email.endsWith('@example.invalid'))
    assert.equal(await prisma.user.count({ where: { id: fixture.id, email: fixture.email } }), 1)
    await prisma.user.deleteMany({ where: { id: fixture.id, email: fixture.email } })
    assert.equal(await prisma.user.count({ where: { id: fixture.id } }), 0)
  }
  if (mode === 'check' || mode === 'cleanup') {
    fixture = JSON.parse(await readFile(statePath, 'utf8'))
    assert.ok(fixture)
    if (mode === 'cleanup') {
      await cleanup()
      await unlink(statePath)
      console.log(JSON.stringify({ temporaryAccountRemoved: true }))
      return
    }
    const user = (await request(`/api/admin/users/${fixture.id}`)).user
    assert.equal(user.level, 4)
    assert.equal(user.adminNote, '회원 수정 브라우저 저장 확인')
    assert.equal(digest((await prisma.user.findUniqueOrThrow({ where: { id: fixture.id } })).password), fixture.passwordDigest)
    console.log(JSON.stringify({ browserSavePersistedInDatabase: true, passwordUnchanged: true }))
    return
  }

  try {
    const marker = Date.now()
    const created = (await request('/api/admin/users', 200, 'POST', {
      email: `member-edit-check-${marker}@example.invalid`,
      nickname: `회원검증${marker}`,
      password: randomUUID(), role: 'user', status: 'active', adminNote: 'Temporary member editor verification',
    })).user
    assert.ok(created?.id)
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: created.id } })
    fixture = { id: stored.id, uuid: stored.uuid, email: stored.email, passwordDigest: digest(stored.password) }
    const path = `/api/admin/users/${fixture.id}`
    const numeric = await request(path)
    const byUuid = await request(`/api/admin/users/${fixture.uuid}`)
    assert.equal(numeric.user.id, byUuid.user.id)
    assert.ok(!('password' in numeric.user) && !('password' in byUuid.user))
    const list = await request(`/api/admin/users?search=${encodeURIComponent(stored.nickname)}`)
    assert.ok(list.users.some((user: { id: number }) => user.id === fixture!.id))
    const ordinaryToken = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(fixture.id), sub: String(fixture.id), email: fixture.email }, maxAge: 600 })
    const ordinaryCookie = `next-auth.session-token=${ordinaryToken}; __Secure-next-auth.session-token=${ordinaryToken}`
    for (const actor of ['', ordinaryCookie]) {
      await request(path, 401, 'GET', undefined, actor)
      await request(path, 401, 'PUT', { nickname: '변경불가' }, actor)
    }
    for (const reference of [`${fixture.id}invalid`, '0', '-1', 'invalid']) {
      await request(`/api/admin/users/${reference}`, 400)
    }
    await request('/api/admin/users/2147483647', 404)
    const update = { email: fixture.email, nickname: stored.nickname, role: 'user', status: 'active', level: 3, password: '', adminNote: 'API 저장 확인' }
    await request(path, 200, 'PUT', update)
    const saved = (await request(path)).user
    assert.equal(saved.level, 3)
    assert.equal(saved.adminNote, update.adminNote)
    assert.equal(digest((await prisma.user.findUniqueOrThrow({ where: { id: fixture.id } })).password), fixture.passwordDigest)
    await request(path, 400, 'PUT', { ...update, nickname: 'admin-invalid' })
    assert.equal((await request(path)).user.nickname, stored.nickname)
    await prisma.user.update({ where: { id: fixture.id }, data: { deletedAt: new Date() } })
    await request(path, 404)
    await prisma.user.update({ where: { id: fixture.id }, data: { deletedAt: null } })
    if (mode === 'prepare') {
      await writeFile(statePath, JSON.stringify(fixture), { mode: 0o600, flag: 'wx' })
      console.log(JSON.stringify({ base, requestsPassed: requests, numericId: fixture.id, uuid: fixture.uuid, adminOnly: true, passwordUnchanged: true, fixtureReadyForBrowser: true }))
      fixture = undefined // The explicit cleanup step removes this fixture after browser verification.
    } else {
      console.log(JSON.stringify({ base, requestsPassed: requests, numericAndUuidLookup: true, adminOnly: true, updatePersisted: true, passwordUnchanged: true }))
    }
  } finally {
    await cleanup()
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
