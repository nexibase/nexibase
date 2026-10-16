import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { checkAligoConnection } from './aligo-connection'
import { DEFAULT_SETTINGS } from './config'

const settings = { ...DEFAULT_SETTINGS, aligoUserId: 'test-account', sender: '01012345678' }
const secrets = { aligoKey: 'private-api-key', senderKey: 'private-profile-key' }
const profile = { senderKey: secrets.senderKey, status: 'A', profileStat: 'A', alimUseYn: true }
const responses = (sms: unknown, kakao: unknown): typeof fetch => async input => {
  assert.ok(['https://apis.aligo.in/remain/', 'https://kakaoapi.aligo.in/akv10/profile/list/'].includes(String(input)), 'Only documented read-only endpoints may be called')
  return Response.json(String(input).includes('/remain/') ? sms : kakao)
}

test('connection check uses read-only endpoints and channel-specific auth, never sends a message', async () => {
  const calls: string[] = []
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input); calls.push(url)
    const body = init!.body as URLSearchParams
    assert.equal(init!.method, 'POST')
    assert.equal(body.has('receiver'), false); assert.equal(body.has('receiver_1'), false)
    if (url === 'https://apis.aligo.in/remain/') {
      assert.equal(body.get('key'), secrets.aligoKey); assert.equal(body.get('user_id'), settings.aligoUserId)
      return Response.json({ result_code: 1, SMS_CNT: 0, LMS_CNT: '20', MMS_CNT: 2 })
    }
    assert.equal(url, 'https://kakaoapi.aligo.in/akv10/profile/list/')
    assert.equal(body.get('apikey'), secrets.aligoKey); assert.equal(body.get('userid'), settings.aligoUserId)
    assert.equal(body.get('senderkey'), secrets.senderKey)
    return Response.json({ code: 0, list: [profile] })
  }
  const checks = await checkAligoConnection(settings, secrets, fetcher)
  assert.equal(calls.length, 2)
  assert.deepEqual(checks.map(check => check.status), ['ok', 'ok'])
  assert.ok(checks[0].message.includes('SMS 0건'))
  assert.ok(!JSON.stringify(checks).includes(secrets.aligoKey)); assert.ok(!JSON.stringify(checks).includes(secrets.senderKey))
})

test('one API failure does not hide the other API result and errors redact credentials', async () => {
  const checks = await checkAligoConnection(settings, secrets, responses(
    { result_code: -102, message: `인증오류 ${secrets.aligoKey} ${secrets.senderKey}` }, { code: 0, list: [profile] }))
  assert.deepEqual(checks.map(check => check.status), ['error', 'ok'])
  assert.ok(checks[0].message.includes('-102'))
  assert.ok(!JSON.stringify(checks).includes(secrets.aligoKey)); assert.ok(!JSON.stringify(checks).includes(secrets.senderKey))
})

test('profile existence, account status, channel activation and Alimtalk use are checked separately', async () => {
  for (const [rows, status] of [
    [[], 'error'], [[{ ...profile, senderKey: 'another-profile' }], 'error'],
    [[{ ...profile, status: 'S' }], 'error'], [[{ ...profile, profileStat: 'B' }], 'error'],
    [[{ ...profile, alimUseYn: false }], 'warning'],
  ] as const) {
    const checks = await checkAligoConnection(settings, secrets, responses({ result_code: 1 }, { code: 0, list: rows }))
    assert.equal(checks[1].status, status)
  }
  const checks = await checkAligoConnection(settings, { aligoKey: secrets.aligoKey }, responses({ result_code: 1 }, { code: 0, list: [] }))
  assert.equal(checks[1].status, 'warning')
})

test('malformed or uncertain responses never become a successful connection check', async () => {
  for (const kakao of [{}, { code: null }, { code: '' }, { code: 1 }, { code: 0, list: null }]) {
    const checks = await checkAligoConnection(settings, secrets, responses({}, kakao))
    assert.deepEqual(checks.map(check => check.status), ['error', 'error'])
  }
  const checks = await checkAligoConnection(settings, secrets, async () => { throw new Error('private internal error') })
  assert.deepEqual(checks.map(check => check.status), ['error', 'error'])
  assert.ok(!JSON.stringify(checks).includes('private internal error'))
})

const require = createRequire(import.meta.url)
function routeSetup() {
  const state = { admin: true, sameOrigin: true, configured: true, reads: 0, checks: 0 }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'),
    '@/lib/notifications/admin': { notificationAdmin: async () => state.admin ? { id: 1 } : null, sameOrigin: () => state.sameOrigin },
    '@/lib/notifications/config': { getNotificationConfig: async () => { state.reads++; return { settings, secrets: state.configured ? secrets : {} } } },
    '@/lib/notifications/aligo-connection': { checkAligoConnection: async () => { state.checks++; return [{ id: 'sms', status: 'ok', message: '인증 성공' }, { id: 'alimtalk', status: 'warning', message: '프로필 설정 필요' }] } },
  }
  const file = path.join(process.cwd(), 'src/app/api/admin/notifications/aligo/check/route.ts')
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as { POST: (request: Request) => Promise<Response> } }
  new Function('require', 'module', 'exports', source)((id: string) => { assert.ok(id in dependencies); return dependencies[id] }, module, module.exports)
  return { state, post: () => module.exports.POST(new Request('https://dev.example.invalid/api/admin/notifications/aligo/check', { method: 'POST' })) }
}

test('connection endpoint rejects unauthorized, cross-origin and incomplete configurations without external calls', async () => {
  const { state, post } = routeSetup()
  state.admin = false; assert.equal((await post()).status, 401)
  state.admin = true; state.sameOrigin = false; assert.equal((await post()).status, 403)
  assert.equal(state.reads, 0)
  state.sameOrigin = true; state.configured = false; assert.equal((await post()).status, 400)
  assert.equal(state.checks, 0)
})

test('connection endpoint keeps partial results, distinguishes warnings and disables response caching', async () => {
  const { state, post } = routeSetup()
  const response = await post()
  assert.equal(response.status, 200); assert.equal(state.checks, 1)
  assert.match(response.headers.get('Cache-Control')!, /no-store/)
  const body = await response.json()
  assert.equal(body.success, false); assert.equal(body.checks.length, 2)
  assert.ok(!JSON.stringify(body).includes(secrets.aligoKey))
})
