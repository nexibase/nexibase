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
    categories: await prisma.faqCategory.findMany({ orderBy: { id: 'asc' } }),
    votes: await prisma.faqFeedback.findMany({ orderBy: { id: 'asc' } }),
  }
  const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active', deletedAt: null } })
  assert.ok(admin)
  const other = await prisma.user.findFirst({ where: { id: { not: admin.id }, status: 'active', deletedAt: null } })
  assert.ok(other)
  async function userClient(user: { id: number; email: string }): Promise<Client> {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(user.id), sub: String(user.id), email: user.email }, maxAge: 600 })
    return { cookie: `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}` }
  }
  const adminClient = await userClient(admin)
  const guest: Client = { cookie: '' }
  let requests = 0
  async function request(client: Client, path: string, expected = 200, method = 'GET', body?: unknown) {
    requests++
    const response = await fetch(base + path, {
      method, headers: { 'Content-Type': 'application/json', Cookie: client.cookie },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    assert.equal(response.status, expected, `${method} ${path}`)
    const setCookie = response.headers.get('set-cookie')
    if (setCookie?.startsWith('nexibase-faq-voter=')) {
      assert.match(setCookie, /HttpOnly/i)
      assert.match(setCookie, /SameSite=lax/i)
      assert.match(setCookie, /Max-Age=31536000/i)
      client.cookie = setCookie.split(';')[0]
    }
    return response.status === 204 ? null : response.json()
  }
  const name = `feedback-once-check-${Date.now()}`
  let categoryId: number | undefined
  const ids: number[] = []
  try {
    categoryId = (await request(adminClient, '/api/admin/faqs', 201, 'POST', { type: 'category', name, slug: name })).id
    for (let i = 0; i < 3; i++) ids.push((await request(adminClient, '/api/admin/faqs', 201, 'POST', {
      type: 'faq', question: `${name}-${i}`, answer: '<p>Temporary duplicate-feedback verification</p>', categoryId, published: i < 2,
    })).id)
    const vote = (client: Client, id: number, helpful: boolean, path = '/api/faqs', expected = 200) => request(client, path, expected, 'PATCH', { type: 'feedback', id, helpful })
    assert.equal((await vote({ cookie: '' }, ids[0], true, '/api/faqs', 400)).error, 'visitor_required')
    assert.equal(await prisma.faqFeedback.count({ where: { faqId: ids[0] } }), 0)
    await request(guest, '/api/faqs?type=feedback')
    const first = await vote(guest, ids[0], true)
    assert.equal(first.helpful, 1)
    assert.equal(first.notHelpful, 0)
    assert.equal(first.alreadyVoted, false)
    const repeats = await Promise.all(Array.from({ length: 12 }, (_, i) => vote(guest, ids[0], i % 2 === 0, ['/api/faqs', '/api/faq', '/api/faq-accordion'][i % 3])))
    for (const result of repeats) {
      assert.equal(result.helpful, 1)
      assert.equal(result.notHelpful, 0)
      assert.equal(result.choice, true)
      assert.equal(result.alreadyVoted, true)
    }
    assert.ok((await request({ cookie: guest.cookie }, '/api/faqs?type=feedback')).votes.some((item: { faqId: number; helpful: boolean }) => item.faqId === ids[0] && item.helpful))
    assert.equal((await vote(guest, ids[1], false)).notHelpful, 1)
    assert.equal((await vote(guest, ids[1], true)).helpful, 0)
    const logged = await vote(adminClient, ids[0], false)
    assert.equal(logged.notHelpful, 1)
    const anotherBrowserSameAccount = await userClient(admin)
    const sameUser = await vote(anotherBrowserSameAccount, ids[0], true)
    assert.equal(sameUser.helpful, 1)
    assert.equal(sameUser.notHelpful, 1)
    assert.equal(sameUser.choice, false)
    assert.equal(sameUser.alreadyVoted, true)
    assert.ok((await request(anotherBrowserSameAccount, '/api/faqs?type=feedback')).votes.some((item: { faqId: number; helpful: boolean }) => item.faqId === ids[0] && item.helpful === false))
    assert.equal((await vote(await userClient(other), ids[0], true)).helpful, 2)
    // Concurrent first evaluations must insert one row and increment one total.
    const freshUser = await userClient(other)
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, i) => vote(freshUser, ids[1], i % 2 === 0)))
    assert.equal(concurrent.filter(item => !item.alreadyVoted).length, 1)
    assert.equal(await prisma.faqFeedback.count({ where: { faqId: ids[1], userId: other.id } }), 1)
    await vote(guest, ids[2], true, '/api/faqs', 404)
    await vote({ cookie: 'nexibase-faq-voter=forged' }, ids[0], true, '/api/faqs', 400)
    await request(guest, '/api/faqs', 400, 'PATCH', { type: 'feedback', id: ids[0], helpful: 'invalid' })
    assert.equal(await prisma.faqFeedback.count({ where: { faqId: ids[0] } }), 3)
    const totals = await prisma.faq.findUniqueOrThrow({ where: { id: ids[0] } })
    assert.deepEqual([totals.helpful, totals.notHelpful], [2, 1])
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
  assert.deepEqual(await prisma.faq.findMany({ orderBy: { id: 'asc' } }), before.faqs)
  assert.deepEqual(await prisma.faqCategory.findMany({ orderBy: { id: 'asc' } }), before.categories)
  assert.deepEqual(await prisma.faqFeedback.findMany({ orderBy: { id: 'asc' } }), before.votes)
  console.log(JSON.stringify({ base, requestsPassed: requests, loggedInAccountDeduplicated: true, guestCookieDeduplicated: true, refreshRestoresVotes: true, oppositeChoiceIgnored: true, simultaneousFirstVotesDeduplicated: true, temporaryRecordsCleaned: true, existingDataUnchanged: true }))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => prisma.$disconnect())
