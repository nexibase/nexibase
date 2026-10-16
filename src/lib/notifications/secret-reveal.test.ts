import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function setup() {
  const state = { admin: true, sameOrigin: true, reads: 0, fail: false,
    secrets: { smtpPass: 'test-smtp-secret', aligoKey: 'test-aligo-secret', senderKey: 'test-sender-secret' } }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'),
    '@/lib/notifications/admin': { notificationAdmin: async () => state.admin ? { id: 1 } : null, sameOrigin: () => state.sameOrigin },
    '@/lib/notifications/config': { getNotificationConfig: async () => {
      state.reads++
      if (state.fail) throw new Error('internal error containing test-smtp-secret')
      return { secrets: state.secrets }
    } },
  }
  const file = path.join(process.cwd(), 'src/app/api/admin/notifications/secrets/route.ts')
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as { POST: (request: Request) => Promise<Response>; GET?: unknown } }
  new Function('require', 'module', 'exports', source)((id: string) => {
    assert.ok(id in dependencies)
    return dependencies[id]
  }, module, module.exports)
  const post = (body: unknown, raw = false) => module.exports.POST(new Request('https://dev.example.invalid/api/admin/notifications/secrets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ? String(body) : JSON.stringify(body),
  }))
  return { state, post, route: module.exports }
}

test('secret reveal denies unauthenticated and cross-origin requests before decrypting credentials', async () => {
  const { state, post, route } = setup()
  assert.equal(route.GET, undefined)
  state.admin = false
  const unauthorized = await post({ key: 'smtpPass' })
  assert.equal(unauthorized.status, 401)
  assert.match(unauthorized.headers.get('Cache-Control')!, /no-store/)
  state.admin = true; state.sameOrigin = false
  assert.equal((await post({ key: 'smtpPass' })).status, 403)
  assert.equal(state.reads, 0)
})

test('secret reveal returns only the explicitly requested field without caching', async () => {
  for (const key of ['smtpPass', 'aligoKey', 'senderKey'] as const) {
    const { state, post } = setup()
    const response = await post({ key })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { value: state.secrets[key] })
    assert.equal(response.headers.get('Cache-Control'), 'no-store, private')
    assert.equal(response.headers.get('Pragma'), 'no-cache')
  }
})

test('invalid or bulk secret queries and malformed JSON never read credentials', async () => {
  const { state, post } = setup()
  for (const body of [null, {}, { key: 'all' }, { key: '__proto__' }, { key: ['smtpPass', 'aligoKey'] }]) {
    assert.equal((await post(body)).status, 400)
  }
  assert.equal((await post('{invalid', true)).status, 400)
  assert.equal(state.reads, 0)
})

test('missing values and decryption failures do not disclose secrets or internal error details', async () => {
  const { state, post } = setup()
  state.secrets.senderKey = ''
  assert.equal((await post({ key: 'senderKey' })).status, 404)
  state.fail = true
  const response = await post({ key: 'smtpPass' })
  assert.equal(response.status, 500)
  const text = await response.text()
  assert.ok(!text.includes('test-smtp-secret'))
  assert.ok(!text.includes('internal error'))
})
