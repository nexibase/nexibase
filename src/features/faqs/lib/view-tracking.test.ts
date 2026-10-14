import assert from 'node:assert/strict'
import { test } from 'node:test'
import { trackFaqView } from './view-tracking'

test('first open counts once across concurrent page/widget calls and repeated opens', async () => {
  const originalFetch = globalThis.fetch
  let requests = 0
  globalThis.fetch = async () => { requests++; return Response.json({ views: 7 }) }
  try {
    assert.deepEqual(await Promise.all([trackFaqView(10001), trackFaqView(10001)]), [7, 7])
    assert.equal(await trackFaqView(10001), undefined)
    assert.equal(requests, 1)
    assert.equal(await trackFaqView(10002), 7)
    assert.equal(requests, 2)
  } finally { globalThis.fetch = originalFetch }
})

test('session storage prevents another request after page reload', async () => {
  const originalFetch = globalThis.fetch
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  let requests = 0
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => '1' } })
  globalThis.fetch = async () => { requests++; return Response.json({ views: 1 }) }
  try {
    assert.equal(await trackFaqView(10003), undefined)
    assert.equal(requests, 0)
  } finally {
    globalThis.fetch = originalFetch
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})

test('failed requests can retry and unavailable storage still suppresses repeats', async () => {
  const originalFetch = globalThis.fetch
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  let requests = 0
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage disabled') } })
  globalThis.fetch = async () => { requests++; return requests === 1 ? new Response(null, { status: 500 }) : Response.json({ views: 3 }) }
  try {
    assert.equal(await trackFaqView(10004), undefined)
    assert.equal(await trackFaqView(10004), 3)
    assert.equal(await trackFaqView(10004), undefined)
    assert.equal(requests, 2)
  } finally {
    globalThis.fetch = originalFetch
    if (descriptor) Object.defineProperty(globalThis, 'sessionStorage', descriptor)
    else Reflect.deleteProperty(globalThis, 'sessionStorage')
  }
})
