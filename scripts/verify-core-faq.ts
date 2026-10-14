import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const base = process.argv[2]
const crud = process.argv[3] === 'crud'
assert.ok(base && process.env.NEXTAUTH_SECRET)
async function fingerprint() {
  const result: Record<string, string> = {}
  for (const table of ['faq_categories', 'faqs', 'boards', 'posts', 'comments', 'reactions', 'contents', 'policies', 'menus', 'page_widgets', 'widget_pages', 'users', 'settings']) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM \`${table}\` ORDER BY \`${table === 'settings' ? 'key' : 'id'}\``)
    result[table] = createHash('sha256').update(JSON.stringify(rows, (_, value) => typeof value === 'bigint' ? String(value) : value)).digest('hex')
  }
  return result
}
async function main() {
  const before = await fingerprint()
  const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active', deletedAt: null } })
  assert.ok(admin)
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(admin.id), sub: String(admin.id), email: admin.email }, maxAge: 600 })
  const cookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
  let requests = 0
  async function request(path: string, expected = 200, method = 'GET', body?: unknown, auth = true, redirect: RequestRedirect = 'follow') {
    requests++
    const response = await fetch(base + path, { method, redirect, headers: { 'Content-Type': 'application/json', ...(auth ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}`)
    const text = await response.text()
    return { response, text, data: response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : null }
  }
  const plugins = (await request('/api/admin/plugins')).data.plugins
  assert.equal(plugins.length, 5)
  for (const folder of ['boards', 'contents', 'policies', 'faqs', 'faq', 'faq-accordion']) assert.ok(!plugins.some((plugin: { folder: string }) => plugin.folder === folder))
  for (const slug of ['faqs', 'faq', 'faq-accordion']) await request('/api/admin/pages', 400, 'POST', { title: 'Reserved FAQ verification', slug })
  for (const path of ['/faqs', '/admin/faqs', '/admin/faqs/new']) await request(path)
  for (const prefix of ['', '/ko', '/en']) {
    for (const [oldPath, newPath] of [['/faq', '/faqs'], ['/faq-accordion', '/faqs'], ['/admin/faq', '/admin/faqs'], ['/admin/faq-accordion', '/admin/faqs'], ['/admin/faq-accordion/123/edit', '/admin/faqs/123/edit']]) {
      const response = (await request(prefix + oldPath + '?keep=1', 308, 'GET', undefined, true, 'manual')).response
      const destination = new URL(response.headers.get('location')!, base)
      assert.equal(destination.pathname, prefix + newPath)
      assert.equal(destination.searchParams.get('keep'), '1')
    }
  }
  await request('/faq-accordion')
  const canonical = (await request('/api/faqs?type=random&limit=1')).data
  assert.deepEqual((await request('/api/faq-accordion?type=random&limit=1')).data, canonical)
  assert.deepEqual((await request('/api/faq?type=random&limit=1')).data, canonical)
  for (const type of ['faqs', 'categories']) {
    const expected = (await request(`/api/admin/faqs?type=${type}`)).data
    assert.deepEqual((await request(`/api/admin/faq-accordion?type=${type}`)).data, expected)
    assert.deepEqual((await request(`/api/admin/faq?type=${type}`)).data, expected)
    await request(`/api/admin/faqs?type=${type}`, 401, 'GET', undefined, false)
    await request(`/api/admin/faq-accordion?type=${type}`, 401, 'GET', undefined, false)
  }
  const sitemap = (await request('/sitemap.xml')).text
  assert.ok(sitemap.includes('/faqs</loc>') && !sitemap.includes('/faq-accordion</loc>'))
  if (crud) {
    const slug = `faq-migration-check-${Date.now()}`
    let categoryId: number | undefined
    const faqIds: number[] = []
    try {
      const category = (await request('/api/admin/faq-accordion', 201, 'POST', { type: 'category', name: slug, slug })).data
      categoryId = category.id
      await request('/api/admin/faqs', 200, 'PATCH', { type: 'category', id: categoryId, name: 'Temporary FAQ category' })
      const faq = (await request('/api/admin/faqs', 201, 'POST', { type: 'faq', question: slug, answer: '<p>Temporary FAQ answer</p>', categoryId, published: true })).data
      faqIds.push(faq.id)
      const draft = (await request('/api/admin/faqs', 201, 'POST', { type: 'faq', question: slug + '-draft', answer: '<p>Draft answer</p>', categoryId, published: false })).data
      faqIds.push(draft.id)
      await request('/api/admin/faq-accordion', 200, 'PATCH', { type: 'faq', id: faq.id, answer: '<p>Updated FAQ answer</p>' })
      const page = (await request('/faqs')).text
      assert.ok(page.includes(slug), 'Created FAQ must be visible in server-rendered page')
      assert.ok(!page.includes(slug + '-draft'), 'Unpublished FAQ must be absent from the public page')
      const random = (await request('/api/faqs?type=random&limit=10')).data.faqs
      assert.ok(Array.isArray(random))
      assert.ok(!random.some((item: { id: number }) => item.id === draft.id))
      assert.equal((await request('/api/faq-accordion', 200, 'PATCH', { type: 'view', id: faq.id }, false)).data.views, 0)
      assert.equal((await request('/api/faqs', 200, 'PATCH', { type: 'feedback', id: faq.id, helpful: true }, false)).data.helpful, 1)
      assert.equal((await request('/api/faq', 200, 'PATCH', { type: 'feedback', id: faq.id, helpful: false }, false)).data.notHelpful, 1)
      await request('/api/faqs', 404, 'PATCH', { type: 'view', id: draft.id }, false)
      await request('/api/admin/faqs', 401, 'PATCH', { type: 'faq', id: faq.id, question: 'Must not save' }, false)
      await request('/api/admin/faq-accordion', 200, 'PATCH', { type: 'reorder-faqs', items: faqIds.map((id, sortOrder) => ({ id, sortOrder })) })
      await request(`/api/admin/faqs?type=category&id=${categoryId}`, 400, 'DELETE')
      for (const id of faqIds) {
        assert.equal((await prisma.faq.findUnique({ where: { id } }))?.categoryId, categoryId)
        await request(`/api/admin/faq-accordion?type=faq&id=${id}`, 204, 'DELETE')
      }
      faqIds.length = 0
      await request(`/api/admin/faqs?type=category&id=${categoryId}`, 204, 'DELETE')
      categoryId = undefined
    } finally {
      if (categoryId) {
        assert.equal((await prisma.faqCategory.findUnique({ where: { id: categoryId } }))?.slug, slug)
        for (const id of faqIds) {
          const faq = await prisma.faq.findUnique({ where: { id } })
          if (faq) {
            assert.equal(faq.categoryId, categoryId)
            await request(`/api/admin/faqs?type=faq&id=${id}`, 204, 'DELETE')
          }
        }
        await request(`/api/admin/faqs?type=category&id=${categoryId}`, 204, 'DELETE')
      }
    }
  }
  assert.deepEqual(await fingerprint(), before, 'Existing rows changed during FAQ verification')
  console.log(JSON.stringify({ base, requestsPassed: requests, crudVerified: crud, pluginCount: plugins.length, existingDataUnchanged: true }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
