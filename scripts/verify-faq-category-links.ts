import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'
import { faqCategoryPath } from '../src/features/faqs/lib/urls'

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
function publicQuestions(html: string): string[] {
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  const data = scripts.map(match => JSON.parse(match[1])).find(item => item['@type'] === 'FAQPage')
  assert.ok(data, 'FAQ structured data is missing')
  return data.mainEntity.map((item: { name: string }) => item.name).sort()
}
async function main() {
  const before = await fingerprint()
  const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active', deletedAt: null } })
  assert.ok(admin)
  const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(admin.id), sub: String(admin.id), email: admin.email }, maxAge: 600 })
  const cookie = `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
  let requests = 0
  async function request(path: string, expected = 200, method = 'GET', body?: unknown, redirect: RequestRedirect = 'follow') {
    requests++
    const response = await fetch(base + path, { method, redirect, headers: { 'Content-Type': 'application/json', ...(path.startsWith('/api/admin/') ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}`)
    const text = await response.text()
    return { response, text, data: response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : null }
  }
  async function checkCategory(category: { id: number; slug: string }) {
    const path = faqCategoryPath(category.slug)
    const expected = (await prisma.faq.findMany({ where: { categoryId: category.id, published: true }, select: { question: true } })).map(faq => faq.question).sort()
    const { text } = await request(path)
    assert.deepEqual(publicQuestions(text), expected, 'Only published FAQs from the selected category may be rendered')
    const canonical = text.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/)
    assert.ok(canonical)
    assert.equal(new URL(canonical[1], base).pathname, path)
    assert.ok(text.includes(`href="${path}"`) && text.includes('aria-selected="true"'))
    return path
  }
  const categories = await prisma.faqCategory.findMany({ orderBy: { id: 'asc' } })
  for (const category of categories) {
    const path = await checkCategory(category)
    for (const alias of ['/faq/', '/faq-accordion/']) {
      const response = (await request(alias + category.slug + '?keep=1', 308, 'GET', undefined, 'manual')).response
      const destination = new URL(response.headers.get('location')!, base)
      assert.equal(destination.pathname, path)
      assert.equal(destination.searchParams.get('keep'), '1')
    }
  }
  await request('/faqs/unknown-category-verification-918273', 404)
  const all = await prisma.faq.findMany({ where: { published: true }, select: { question: true } })
  assert.deepEqual(publicQuestions((await request('/faqs')).text), all.map(faq => faq.question).sort())
  if (crud) {
    const prefix = `category-link-check-${Date.now()}`
    const createdCategories: Array<{ id: number; slug: string }> = []
    const faqIds: number[] = []
    try {
      for (const suffix of ['a', 'b', 'empty']) {
        createdCategories.push((await request('/api/admin/faqs', 201, 'POST', { type: 'category', name: prefix + '-' + suffix, slug: prefix + '-' + suffix })).data)
      }
      for (const [index, category] of createdCategories.slice(0, 2).entries()) {
        const faq = (await request('/api/admin/faqs', 201, 'POST', { type: 'faq', question: prefix + '-question-' + index, answer: '<p>Temporary category verification</p>', categoryId: category.id, published: true })).data
        faqIds.push(faq.id)
      }
      faqIds.push((await request('/api/admin/faqs', 201, 'POST', { type: 'faq', question: prefix + '-draft', answer: '<p>Private verification</p>', categoryId: createdCategories[0].id, published: false })).data.id)
      for (const category of createdCategories) await checkCategory(category)
      const html = (await request('/faqs')).text
      assert.ok(html.includes(prefix + '-question-0') && html.includes(prefix + '-question-1'))
      assert.ok(!html.includes(prefix + '-draft'))
    } finally {
      for (const id of faqIds) {
        const faq = await prisma.faq.findUnique({ where: { id } })
        if (faq) {
          assert.ok(createdCategories.some(category => category.id === faq.categoryId))
          await request(`/api/admin/faqs?type=faq&id=${id}`, 204, 'DELETE')
        }
      }
      for (const category of createdCategories) {
        assert.ok(category.slug.startsWith(prefix))
        assert.equal((await prisma.faqCategory.findUnique({ where: { id: category.id } }))?.slug, category.slug)
        await request(`/api/admin/faqs?type=category&id=${category.id}`, 204, 'DELETE')
      }
    }
  }
  assert.deepEqual(await fingerprint(), before, 'Existing data changed during category link verification')
  console.log(JSON.stringify({ base, requestsPassed: requests, crudVerified: crud, existingDataUnchanged: true, categories: categories.map(category => ({ name: category.name, slug: category.slug, path: faqCategoryPath(category.slug) })) }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
