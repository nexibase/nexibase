import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const base = process.argv[2]
const writeTests = process.argv[3] === 'crud'
assert.ok(base && process.env.NEXTAUTH_SECRET)
const tables = ['boards', 'posts', 'post_attachments', 'comments', 'reactions', 'contents', 'policies', 'menus', 'page_widgets', 'widget_pages', 'users', 'settings']
async function fingerprint() {
  const result: Record<string, { count: number; hash: string }> = {}
  for (const table of tables) {
    const rows = await prisma.$queryRawUnsafe<unknown[]>(`SELECT * FROM \`${table}\` ORDER BY \`${table === 'settings' ? 'key' : 'id'}\``)
    result[table] = { count: rows.length, hash: createHash('sha256').update(JSON.stringify(rows, (_, value) => typeof value === 'bigint' ? String(value) : value)).digest('hex') }
  }
  return result
}

async function main() {
  const before = await fingerprint()
  const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active', deletedAt: null } })
  assert.ok(admin, 'An existing administrator is required')
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(admin.id), sub: String(admin.id), email: admin.email }, maxAge: 600 })
  const cookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
  let requests = 0
  async function request(path: string, expected = 200, method = 'GET', body?: unknown, authenticated = true, extraCookie = '') {
    requests++
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie + extraCookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}`)
    const text = await response.text()
    return { response, data: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : null, text }
  }
  const plugins = (await request('/api/admin/plugins')).data.plugins
  for (const feature of ['boards', 'contents', 'policies']) assert.ok(!plugins.some((plugin: { folder: string }) => plugin.folder === feature))
  assert.equal(plugins.length, 6)
  const settings = (await request('/api/settings')).data
  for (const feature of ['boards', 'contents', 'policies']) assert.ok(!settings.enabledPlugins.includes(feature))
  for (const path of ['/api/admin/boards', '/api/admin/contents', '/api/admin/policies']) {
    await request(path)
    await request(path, 401, 'GET', undefined, false)
  }
  for (const slug of ['boards', 'contents', 'policies']) {
    await request('/api/admin/pages', 400, 'POST', { title: 'Core reserved path verification', slug })
  }
  const dashboard = (await request('/api/admin/dashboard')).data
  assert.ok(Array.isArray(dashboard.recentPosts) && Array.isArray(dashboard.recentComments))
  const menus = (await request('/api/admin/menus')).data
  for (const menu of [...menus.header, ...menus.footer]) {
    if (/^\/(boards|contents|policies)(\/|$)/.test(menu.url)) {
      assert.equal(menu.pluginFolder, null)
      assert.equal(menu.pluginEnabled, true)
    }
  }
  await request('/api/home-widgets')
  await request('/')
  await request('/boards')
  for (const board of await prisma.board.findMany({ where: { isActive: true } })) {
    await request(`/boards/${board.slug}`)
    await request(`/api/boards/${board.slug}/posts`)
    await request(`/admin/boards/${board.id}`)
    for (const post of await prisma.post.findMany({ where: { boardId: board.id, status: 'published', isSecret: false } })) {
      const detail = await request(`/api/boards/${board.slug}/posts/${post.id}`, 200, 'GET', undefined, true, `; viewed_posts=${board.slug}:${post.id}`)
      assert.equal(detail.data.post.id, post.id)
      assert.equal(detail.data.post.content, post.content)
      await request(`/boards/${board.slug}/${post.id}`)
    }
  }
  for (const content of await prisma.content.findMany({ where: { isPublic: true } })) {
    const data = (await request(`/api/contents/${content.slug}`)).data.content
    assert.equal(data.id, content.id)
    assert.equal(data.content, content.content)
    await request(`/contents/${content.slug}`)
  }
  for (const policy of await prisma.policy.findMany()) {
    const data = (await request(`/api/policies/${policy.slug}?v=${policy.version}`)).data.policy
    assert.equal(data.id, policy.id)
    assert.equal(data.content, policy.content)
    if (policy.isActive) await request(`/api/policies/${policy.slug}`)
    await request(`/policies/${policy.slug}?v=${policy.version}`)
  }
  for (const feature of ['boards', 'contents', 'policies']) await request(`/admin/${feature}`)
  await request('/admin/plugins')

  if (writeTests) {
    const prefix = `core-migration-check-${Date.now()}`
    let boardId: number | undefined, contentId: number | undefined
    const policyIds: number[] = []
    try {
      const board = (await request('/api/admin/boards', 201, 'POST', { slug: prefix, name: 'Temporary core migration verification', useComment: true, useReaction: true })).data.board
      boardId = board.id
      const post = (await request(`/api/boards/${prefix}/posts`, 201, 'POST', { title: 'Temporary verification post', content: '<p>Core create verification</p>' })).data.post
      await request(`/api/boards/${prefix}/posts`, 401, 'POST', { title: 'Unauthorized', content: 'Rejected' }, false)
      await request(`/api/boards/${prefix}/posts/${post.id}`, 200, 'PUT', { title: 'Temporary updated post', content: '<p>Core edit verification</p>' })
      const comment = (await request(`/api/boards/${prefix}/posts/${post.id}/comments`, 201, 'POST', { content: 'Temporary verification comment' })).data.comment
      await request(`/api/boards/${prefix}/posts/${post.id}/comments/${comment.id}`, 200, 'PUT', { content: 'Temporary updated comment' })
      await request(`/api/boards/${prefix}/posts/${post.id}/reaction`, 200, 'POST', { type: 'like' })
      await request(`/api/boards/${prefix}/posts/${post.id}/reaction`, 200, 'POST', { type: 'like' })
      await request(`/api/boards/${prefix}/posts/${post.id}/comments/${comment.id}`, 200, 'DELETE')
      await request(`/api/boards/${prefix}/posts/${post.id}`, 200, 'DELETE')
      const content = (await request('/api/admin/contents', 201, 'POST', { slug: prefix, title: 'Temporary content', content: '<p>Create verification</p>', isPublic: true })).data.content
      contentId = content.id
      await request(`/api/admin/contents/${contentId}`, 200, 'PUT', { title: 'Temporary updated content', content: '<p>Edit verification</p>', isPublic: true })
      assert.equal((await request(`/api/contents/${prefix}`)).data.content.title, 'Temporary updated content')
      for (const version of ['1.0', '2.0']) {
        const policy = (await request('/api/admin/policies', 201, 'POST', { slug: prefix, version, title: 'Temporary policy', content: `<p>Version ${version}</p>` })).data.policy
        policyIds.push(policy.id)
        await request(`/api/admin/policies/${policy.id}/activate`, 200, 'POST')
      }
      assert.equal((await request(`/api/policies/${prefix}`)).data.policy.version, '2.0')
      assert.equal((await request(`/api/policies/${prefix}?v=1.0`)).data.policy.version, '1.0')
    } finally {
      // Only IDs created by this verification, with the unique test slug, can be removed.
      if (boardId) {
        assert.equal((await prisma.board.findUnique({ where: { id: boardId } }))?.slug, prefix)
        await request(`/api/admin/boards/${boardId}`, 200, 'DELETE')
      }
      if (contentId) {
        assert.equal((await prisma.content.findUnique({ where: { id: contentId } }))?.slug, prefix)
        await request(`/api/admin/contents/${contentId}`, 200, 'DELETE')
      }
      for (const id of policyIds) {
        assert.equal((await prisma.policy.findUnique({ where: { id } }))?.slug, prefix)
        await request(`/api/admin/policies/${id}`, 200, 'DELETE')
      }
    }
  }
  assert.deepEqual(await fingerprint(), before, 'Existing database rows changed during verification')
  console.log(JSON.stringify({ base, requestsPassed: requests, crudVerified: writeTests, pluginCount: plugins.length, existingDataUnchanged: true, counts: Object.fromEntries(Object.entries(before).map(([key, value]) => [key, value.count])) }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
