import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const base = process.argv[2]
assert.ok(base && process.env.NEXTAUTH_SECRET)
type Client = { cookie: string }
async function main() {
  const before = {
    faqs: await prisma.faq.findMany({ orderBy: { id: 'asc' } }),
    views: await prisma.faqView.findMany({ orderBy: { id: 'asc' } }),
    feedback: await prisma.faqFeedback.findMany({ orderBy: { id: 'asc' } }),
  }
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin', status: 'active', deletedAt: null } })
  const member = await prisma.user.findFirstOrThrow({ where: { role: { notIn: ['admin', 'manager'] }, status: 'active', deletedAt: null } })
  async function client(user: { id: number; email: string }): Promise<Client> {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(user.id), sub: String(user.id), email: user.email }, maxAge: 600 })
    return { cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` }
  }
  const administrator = await client(admin), ordinary = await client(member), guest = { cookie: '' }
  let requests = 0
  async function request(actor: Client, path: string, expected = 200, method = 'GET', body?: unknown) {
    requests++
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: actor.cookie }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.status, expected, `${method} ${path}`)
    const cookie = response.headers.get('set-cookie')
    if (cookie?.startsWith('nexibase-faq-voter=')) actor.cookie = cookie.split(';')[0]
    const text = await response.text()
    return { response, data: response.headers.get('content-type')?.includes('application/json') && text ? JSON.parse(text) : null, text }
  }
  const category = await prisma.faqCategory.findFirstOrThrow()
  const question = `details-check-${Date.now()}`
  let faqId: number | undefined
  try {
    faqId = (await request(administrator, '/api/admin/faqs', 201, 'POST', { type: 'faq', question, answer: '<p>Temporary history and sharing verification</p>', categoryId: category.id, published: true })).data.id
    await prisma.faq.update({ where: { id: faqId }, data: { views: 5, helpful: 3, notHelpful: 4 } })
    await request(guest, '/api/faqs?type=activity')
    for (const actor of [administrator, guest]) await request(actor, '/api/faqs', 200, 'PATCH', { type: 'view', id: faqId })
    await request(administrator, '/api/faqs', 200, 'PATCH', { type: 'feedback', id: faqId, helpful: true })
    await request(guest, '/api/faqs', 200, 'PATCH', { type: 'feedback', id: faqId, helpful: false })
    const path = `/api/admin/faqs/${faqId}/activity`
    await request({ cookie: '' }, path, 401)
    await request(ordinary, path, 401)
    const views = await request(administrator, path + '?kind=views')
    assert.match(views.response.headers.get('cache-control')!, /private.*no-store/)
    assert.deepEqual(views.data.totals, { aggregate: 7, recorded: 2, user: 1, guest: 1, historical: 5 })
    assert.equal(views.data.records.length, 2)
    assert.ok(views.data.records.some((row: any) => row.actor.type === 'user' && row.actor.user.id === admin.id))
    const guestRow = views.data.records.find((row: any) => row.actor.type === 'guest')
    assert.match(guestRow.actor.label, /^[a-f0-9]{12}$/)
    for (const forbidden of ['viewerKey', 'voterKey', admin.email, guest.cookie.split('=')[1].split('.')[0]]) assert.ok(!views.text.includes(forbidden))
    for (const audience of ['user', 'guest']) {
      const filtered = (await request(administrator, path + '?kind=views&audience=' + audience)).data
      assert.equal(filtered.records.length, 1)
      assert.equal(filtered.records[0].actor.type, audience)
      assert.equal(filtered.pagination.total, 1)
      assert.deepEqual(filtered.totals, views.data.totals)
    }
    const firstPage = (await request(administrator, path + '?pageSize=1&page=1')).data
    const secondPage = (await request(administrator, path + '?pageSize=1&page=2')).data
    assert.equal(firstPage.pagination.total, 2)
    assert.notEqual(firstPage.records[0].id, secondPage.records[0].id)
    assert.equal((await request(administrator, path + '?pageSize=1&page=3')).data.records.length, 0)
    const helpful = (await request(administrator, path + '?kind=helpful')).data
    assert.deepEqual(helpful.totals, { aggregate: 4, recorded: 1, user: 1, guest: 0, historical: 3 })
    const notHelpful = (await request(administrator, path + '?kind=notHelpful')).data
    assert.deepEqual(notHelpful.totals, { aggregate: 5, recorded: 1, user: 0, guest: 1, historical: 4 })
    assert.equal(notHelpful.records[0].actor.label, guestRow.actor.label)
    assert.equal((await request(administrator, path + '?kind=helpful&audience=guest')).data.records.length, 0)
    for (const query of ['kind=unknown', 'audience=unknown', 'page=0', 'pageSize=101', 'page=1.5']) await request(administrator, path + '?' + query, 400)
    await request(administrator, '/api/admin/faqs/invalid/activity', 400)
    await request(administrator, '/api/admin/faqs/2147483647/activity', 404)
    const html = (await request(guest, `/faqs#faq-${faqId}`)).text
    assert.ok(html.includes(`id="faq-${faqId}"`) && html.includes(`/faqs#faq-${faqId}`))
    assert.deepEqual([(await prisma.faq.findUniqueOrThrow({ where: { id: faqId } })).views, (await prisma.faq.findUniqueOrThrow({ where: { id: faqId } })).helpful, (await prisma.faq.findUniqueOrThrow({ where: { id: faqId } })).notHelpful], [7, 4, 5], 'Reading history must not change totals')
  } finally {
    if (faqId) {
      assert.equal((await prisma.faq.findUniqueOrThrow({ where: { id: faqId } })).question, question)
      await request(administrator, `/api/admin/faqs?type=faq&id=${faqId}`, 204, 'DELETE')
    }
  }
  assert.deepEqual(await prisma.faq.findMany({ orderBy: { id: 'asc' } }), before.faqs)
  assert.deepEqual(await prisma.faqView.findMany({ orderBy: { id: 'asc' } }), before.views)
  assert.deepEqual(await prisma.faqFeedback.findMany({ orderBy: { id: 'asc' } }), before.feedback)
  console.log(JSON.stringify({ base, requestsPassed: requests, adminOnly: true, audiencesAndPaginationVerified: true, historicalCountsExplained: true, guestKeysNotExposed: true, shareAnchorsRendered: true, temporaryRecordsCleaned: true, existingDataUnchanged: true }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
