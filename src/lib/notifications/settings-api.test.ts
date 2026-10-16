import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { validPhone } from './policy'

const require = createRequire(import.meta.url)
type Handler = (request: Request) => Promise<Response>
function setup(aligo = true) {
  const state = {
    admin: true, sameOrigin: true, writes: 0,
    settings: { emailEnabled: true, smsEnabled: false, alimtalkEnabled: false, liveEnabled: false, smtpSecure: true,
      smtpHost: 'smtp.example.invalid', smtpPort: 465, smtpUser: 'account', smtpFrom: 'account@example.invalid',
      testRecipients: ['recipient@example.invalid'], aligoUserId: 'original', sender: '01012345678' },
    secrets: { smtpPass: 'smtp-secret', aligoKey: 'aligo-secret', senderKey: 'sender-secret' },
    beforeTransaction: () => {},
  }
  const config = {
    getNotificationConfig: async () => ({ settings: structuredClone(state.settings), secrets: structuredClone(state.secrets) }),
    publicNotificationConfig: async () => ({ settings: structuredClone(state.settings), encryptionReady: true,
      configuredSecrets: { smtpPass: !!state.secrets.smtpPass, aligoKey: !!state.secrets.aligoKey, senderKey: !!state.secrets.senderKey } }),
    saveNotificationConfig: async (settings: typeof state.settings, patch: Partial<typeof state.secrets>) => {
      state.writes++; state.settings = structuredClone(settings)
      for (const key of ['smtpPass', 'aligoKey', 'senderKey'] as const) if (patch[key]) state.secrets[key] = patch[key]!
    },
  }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'),
    '@prisma/client': { Prisma: { DbNull: null } },
    '@/lib/prisma': { prisma: { notificationRule: { findMany: async () => [] }, $transaction: async (fn: (tx: unknown) => Promise<void>) => { state.beforeTransaction(); await fn({}) } } },
    '@/lib/notifications/admin': { notificationAdmin: async () => state.admin ? { id: 1 } : null, sameOrigin: () => state.sameOrigin },
    '@/lib/notifications/config': config,
    '@/lib/notifications/policy': { validPhone },
    '@/lib/notifications/service': { ensureCoreRules: async () => {} },
  }
  const file = path.join(process.cwd(), 'src/app/api/admin/notifications/settings', aligo ? 'aligo/route.ts' : 'route.ts')
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as { GET: () => Promise<Response>; PUT: Handler } }
  new Function('require', 'module', 'exports', source)((id: string) => {
    assert.ok(id in dependencies, `Unexpected route dependency: ${id}`)
    return dependencies[id]
  }, module, module.exports)
  const put = (body: unknown) => module.exports.PUT(new Request('https://dev.example.invalid/api/admin/notifications/settings', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
  return { state, put, get: module.exports.GET }
}

test('Aligo configuration reads and writes require an administrator and writes require the same origin', async () => {
  const { state, get, put } = setup()
  state.admin = false
  assert.equal((await get()).status, 401)
  assert.equal((await put({})).status, 401)
  state.admin = true; state.sameOrigin = false
  assert.equal((await put({})).status, 403)
  assert.equal(state.writes, 0)
})

test('Aligo configuration responses expose only connection fields and secret availability', async () => {
  const { get } = setup()
  const response = await get()
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.deepEqual(body.settings, { aligoUserId: 'original', sender: '01012345678' })
  assert.deepEqual(body.configuredSecrets, { aligoKey: true, senderKey: true })
  assert.ok(!JSON.stringify(body).includes('secret'))
})

test('saving Aligo connection details preserves SMTP, channels, allowlist and unrelated credentials', async () => {
  const { state, put } = setup()
  const before = structuredClone(state.settings)
  const response = await put({ settings: { aligoUserId: ' updated ', sender: '010-9876-5432', emailEnabled: false, smtpHost: 'ignored' },
    secrets: { aligoKey: 'new-aligo-key', senderKey: '', smtpPass: 'ignored' } })
  assert.equal(response.status, 200)
  assert.deepEqual(state.settings, { ...before, aligoUserId: 'updated', sender: '010-9876-5432' })
  assert.deepEqual(state.secrets, { smtpPass: 'smtp-secret', aligoKey: 'new-aligo-key', senderKey: 'sender-secret' })
  assert.equal(state.writes, 1)
})

test('invalid Aligo input never changes saved configuration', async () => {
  for (const body of [
    { settings: [] },
    { settings: { aligoUserId: 'bad\nvalue', sender: '' } },
    { settings: { aligoUserId: 'account', sender: '123' } },
    { settings: { aligoUserId: 'account', sender: '' }, secrets: [] },
    { settings: { aligoUserId: 'account', sender: '' }, secrets: { aligoKey: 123 } },
    { settings: { aligoUserId: 'account', sender: '' }, secrets: { senderKey: 'x'.repeat(2049) } },
  ]) {
    const { state, put } = setup()
    const before = structuredClone(state.settings)
    assert.equal((await put(body)).status, 400)
    assert.deepEqual(state.settings, before)
    assert.equal(state.writes, 0)
  }
})

test('general settings from an older page preserve Aligo changes saved before the transaction', async () => {
  const { state, put } = setup(false)
  const stale = structuredClone(state.settings)
  state.beforeTransaction = () => { state.settings.aligoUserId = 'newer-account'; state.settings.sender = '01098765432'; state.secrets.aligoKey = 'newer-key' }
  const response = await put({ scope: 'general', settings: { ...stale, smtpHost: 'updated.example.invalid' },
    secrets: { smtpPass: 'new-smtp-secret', aligoKey: 'stale-key', senderKey: 'stale-key' }, rules: [] })
  assert.equal(response.status, 200)
  assert.equal(state.settings.smtpHost, 'updated.example.invalid')
  assert.equal(state.settings.aligoUserId, 'newer-account')
  assert.equal(state.settings.sender, '01098765432')
  assert.deepEqual(state.secrets, { smtpPass: 'new-smtp-secret', aligoKey: 'newer-key', senderKey: 'sender-secret' })
})
