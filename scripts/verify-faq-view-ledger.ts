import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const base = process.argv[2]
assert.ok(base && process.env.NEXTAUTH_SECRET)
type Client = { cookie: string }

async function main() {
  async function snapshot() {
    return {
      faqs: await prisma.faq.findMany({ orderBy: { id: 'asc' } }),
      categories: await prisma.faqCategory.findMany({ orderBy: { id: 'asc' } }),
      views: await prisma.faqView.findMany({ orderBy: { id: 'asc' } }),
      feedback: await prisma.faqFeedback.findMany({ orderBy: { id: 'asc' } }),
    }
  }
  const before = await snapshot()
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin', status: 'active', deletedAt: null } })
  const other = await prisma.user.findFirstOrThrow({ where: { id: { not: admin.id }, status: 'active', deletedAt: null } })
  async function userClient(user: { id: number; email: string }): Promise<Client> {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(user.id), sub: String(user.id), email: user.email }, maxAge: 600 })
    return { cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` }
  }
  const adminClient = await userClient(admin)
  const guest: Client = { cookie: '' }
  let requests = 0
  async function request(client: Client, path: string, expected = 200, method = 'GET', body?: unknown) {
    requests++
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: client.cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.status, expected, `${method} ${path}`)
    const cookie = response.headers.get('set-cookie')
    if (cookie?.startsWith('nexibase-faq-voter=')) {
      assert.match(cookie, /HttpOnly/i)
      assert.match(cookie, /Max-Age=31536000/i)
      client.cookie = cookie.split(';')[0]
    }
    return response.status === 204 ? null : response.json()
  }
  const name = `view-ledger-check-${Date.now()}`
  let categoryId: number | undefined
  const ids: number[] = []
  try {
    categoryId = (await request(adminClient, '/api/admin/faqs', 201, 'POST', { type: 'category', name, slug: name })).id
    for (let i = 0; i < 3; i++) ids.push((await request(adminClient, '/api/admin/faqs', 201, 'POST', { type: 'faq', question: `${name}-${i}`, answer: '<p>Temporary durable view verification</p>', categoryId, published: i < 2 })).id)
    await prisma.faq.update({ where: { id: ids[0] }, data: { views: 50 } })
    const view = (client: Client, id: number, path = '/api/faqs', expected = 200) => request(client, path, expected, 'PATCH', { type: 'view', id })
    const first = await view({ cookie: adminClient.cookie + `; nexibase-faq-viewed-${ids[0]}=1` }, ids[0])
    assert.equal(first.views, 51, 'Preserve the pre-existing count and add exactly one')
    assert.equal(first.alreadyViewed, false)
    const anotherBrowserSameAccount = await userClient(admin)
    for (const path of ['/api/faqs', '/api/faq', '/api/faq-accordion']) {
      const repeated = await view(anotherBrowserSameAccount, ids[0], path)
      assert.equal(repeated.views, 51)
      assert.equal(repeated.alreadyViewed, true)
    }
    assert.ok((await request(anotherBrowserSameAccount, '/api/faqs?type=activity')).viewedIds.includes(ids[0]))
    assert.equal((await view({ cookie: '' }, ids[0], '/api/faqs', 400)).error, 'visitor_required')
    await request(guest, '/api/faqs?type=activity')
    assert.equal((await view(guest, ids[0])).views, 52)
    const reloadedGuest = { cookie: guest.cookie }
    const repeats = await Promise.all(Array.from({ length: 12 }, (_, i) => view(reloadedGuest, ids[0], ['/api/faqs', '/api/faq', '/api/faq-accordion'][i % 3])))
    for (const result of repeats) {
      assert.equal(result.views, 52)
      assert.equal(result.alreadyViewed, true)
    }
    assert.ok((await request(reloadedGuest, '/api/faqs?type=activity')).viewedIds.includes(ids[0]))
    const otherClient = await userClient(other)
    const simultaneous = await Promise.all(Array.from({ length: 10 }, (_, i) => view(otherClient, ids[0], ['/api/faqs', '/api/faq', '/api/faq-accordion'][i % 3])))
    assert.equal(simultaneous.filter(result => !result.alreadyViewed).length, 1)
    for (const result of simultaneous) assert.equal(result.views, 53)
    // View and feedback initialization use the same identity, but each action
    // has its own ledger. Concurrent first actions must not deadlock.
    const [independentView, feedback] = await Promise.all([
      view(adminClient, ids[1]),
      request(adminClient, '/api/faqs', 200, 'PATCH', { type: 'feedback', id: ids[1], helpful: true }),
    ])
    assert.equal(independentView.views, 1)
    assert.equal(feedback.helpful, 1)
    assert.equal((await view(guest, ids[1])).views, 2)
    assert.equal((await view(adminClient, ids[1])).views, 2)
    await view(guest, ids[2], '/api/faqs', 404)
    await view({ cookie: 'nexibase-faq-voter=forged' }, ids[0], '/api/faqs', 400)
    await request(guest, '/api/faqs', 400, 'PATCH', { type: 'view', id: 'invalid' })
    assert.equal(await prisma.faqView.count({ where: { faqId: ids[0] } }), 3)
    assert.equal(await prisma.faqView.count({ where: { faqId: ids[1] } }), 2)
    assert.equal(await prisma.faqView.count({ where: { faqId: ids[0], userId: admin.id } }), 1)
    assert.equal((await prisma.faq.findUniqueOrThrow({ where: { id: ids[0] } })).views, 53)
  } finally {
    for (const id of ids) {
      const faq = await prisma.faq.findUnique({ where: { id } })
      if (faq) {
        assert.equal(faq.categoryId, categoryId)
        assert.ok(faq.question.startsWith(name))
        await request(adminClient, `/api/admin/faqs?type=faq&id=${id}`, 204, 'DELETE')
      }
    }
    if (categoryId) {
      assert.equal((await prisma.faqCategory.findUniqueOrThrow({ where: { id: categoryId } })).slug, name)
      await request(adminClient, `/api/admin/faqs?type=category&id=${categoryId}`, 204, 'DELETE')
    }
  }
  assert.deepEqual(await snapshot(), before, 'Verification changed existing FAQ data')
  console.log(JSON.stringify({ base, requestsPassed: requests, accountDeduplicatedAcrossBrowsers: true, guestDeduplicatedAfterReload: true, simultaneousFirstViewsDeduplicated: true, legacyAliasesVerified: true, existingCountPreserved: true, databaseRecordsVerified: true, temporaryRecordsCleaned: true, existingDataUnchanged: true }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
