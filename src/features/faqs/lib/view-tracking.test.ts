import assert from 'node:assert/strict'
import { test } from 'node:test'
import { trackFaqView } from './view-tracking'
import { loadFaqActivityStatus } from './activity-status'

test('page feedback and concurrent widget/page opens share guest initialization', async () => {
  const originalFetch = globalThis.fetch
  let statusRequests = 0, viewRequests = 0
  globalThis.fetch = async input => {
    if (String(input).includes('type=activity')) {
      statusRequests++
      return Response.json({ votes: [], viewedIds: [], guest: true })
    }
    viewRequests++
    return Response.json({ views: 7 })
  }
  try {
    const [status, first, simultaneous] = await Promise.all([loadFaqActivityStatus(), trackFaqView(10001), trackFaqView(10001)])
    assert.equal(status.guest, true)
    assert.deepEqual([first, simultaneous], [7, 7])
    assert.equal(statusRequests, 1)
    assert.equal(viewRequests, 1)
    // A later open rechecks the server's account/cookie instead of trusting an
    // old browser receipt; the API returns the same total for that identity.
    assert.equal(await trackFaqView(10001), 7)
    assert.equal(viewRequests, 2)
  } finally { globalThis.fetch = originalFetch }
})

test('failed view requests can retry instead of being marked as counted', async () => {
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = async () => { requests++; return requests === 1 ? new Response(null, { status: 500 }) : Response.json({ views: 3 }) }
  try {
    assert.equal(await trackFaqView(10002), undefined)
    assert.equal(await trackFaqView(10002), 3)
    assert.equal(requests, 2)
  } finally { globalThis.fetch = originalFetch }
})

test('cookie loss initializes a new guest before retrying a view', async () => {
  const originalFetch = globalThis.fetch
  let statusRequests = 0, viewRequests = 0
  globalThis.fetch = async input => {
    if (String(input).includes('type=activity')) {
      statusRequests++
      return Response.json({ votes: [], viewedIds: [], guest: true })
    }
    viewRequests++
    return viewRequests === 1 ? Response.json({ error: 'visitor_required' }, { status: 400 }) : Response.json({ views: 4 })
  }
  try {
    assert.equal(await trackFaqView(10003), 4)
    assert.equal(statusRequests, 1)
    assert.equal(viewRequests, 2)
  } finally { globalThis.fetch = originalFetch }
})
