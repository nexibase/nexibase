import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLatestReleaseLoader } from './latest'

const release = (version = 'v0.33.1') => ({ tag_name: version, draft: false, prerelease: false })
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })

test('latest version comes from a published release, with a trusted release link', async () => {
  const load = createLatestReleaseLoader({ fetcher: async (url, init) => {
    assert.equal(url, 'https://api.github.com/repos/nexibase/nexibase/releases/latest')
    assert.equal(init?.cache, 'no-store')
    return json({ ...release(), html_url: 'https://untrusted.example/' })
  } })
  assert.deepEqual(await load(), { version: '0.33.1', url: 'https://github.com/nexibase/nexibase/releases/tag/v0.33.1' })
})
test('requests share a short cache and concurrent lookups, then refresh newly published releases', async () => {
  let time = 0, calls = 0
  let resolve!: (value: Response) => void
  const load = createLatestReleaseLoader({ now: () => time, ttlMs: 300_000, fetcher: async () => {
    calls++
    if (calls === 1) return new Promise<Response>(done => { resolve = done })
    return json(release('v0.33.2'))
  } })
  const first = load(), concurrent = load()
  assert.equal(calls, 1)
  resolve(json(release()))
  assert.deepEqual(await first, await concurrent)
  assert.equal((await load())?.version, '0.33.1')
  assert.equal(calls, 1)
  time = 300_001
  assert.equal((await load())?.version, '0.33.2')
  assert.equal(calls, 2)
})
test('drafts, prereleases and invalid API payloads never become stable updates', async () => {
  for (const payload of [null, [], {}, { ...release(), draft: true }, { ...release(), prerelease: true },
    release('v0.34.0-beta.1'), release('latest'), { tag_name: 'v0.33.2' }]) {
    let calls = 0
    const load = createLatestReleaseLoader({ fetcher: async () => { calls++; return json(payload) } })
    assert.equal(await load(), null)
    assert.equal(calls, 1, 'Never fall back to the first tag on failure.')
  }
})
test('network errors are retried without caching an unavailable status for ten minutes', async () => {
  let time = 0, calls = 0
  const load = createLatestReleaseLoader({ now: () => time, fetcher: async () => {
    calls++
    if (calls === 1) throw new Error('offline')
    return json(release())
  } })
  assert.equal(await load(), null)
  assert.equal(await load(), null)
  assert.equal(calls, 1)
  time = 30_001
  assert.equal((await load())?.version, '0.33.1')
  assert.equal(calls, 2)
})
test('failed refreshes do not present stale data as a confirmed latest release', async () => {
  let time = 0, calls = 0
  const load = createLatestReleaseLoader({ now: () => time, ttlMs: 10, fetcher: async () => {
    calls++; return calls === 1 ? json(release()) : json({ message: 'rate limited' }, 403)
  } })
  assert.equal((await load())?.version, '0.33.1')
  time = 11
  assert.equal(await load(), null)
})
test('invalid JSON is an unavailable result rather than an update or an exception', async () => {
  const load = createLatestReleaseLoader({ fetcher: async () => new Response('not json') })
  assert.equal(await load(), null)
})
