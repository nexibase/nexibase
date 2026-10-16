import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { DEFAULT_SETTINGS } from './config'
import { validPhone } from './policy'
import { validateNotificationRules } from './rules'

const require = createRequire(import.meta.url)
const initialRule = { eventType: 'post_comment', label: '게시글 댓글', emailEnabled: true, smsEnabled: false, alimtalkEnabled: false,
  smsTemplate: '#{message}', alimtalkCode: '', alimtalkTemplate: '', alimtalkButtons: null, variableMapping: {} }
function setup(events = true) {
  const state = { admin: true, sameOrigin: true, configReads: 0, configWrites: 0, ruleWrites: 0,
    settings: { ...DEFAULT_SETTINGS, smtpHost: 'smtp.example.invalid', aligoUserId: 'account', sender: '01012345678' },
    secrets: { smtpPass: 'smtp-private', aligoKey: 'aligo-private', senderKey: 'profile-private' },
    rule: structuredClone(initialRule) as Record<string, unknown> }
  const prisma = {
    notificationRule: { findMany: async () => [structuredClone(state.rule)] },
    $transaction: async (fn: (tx: unknown) => Promise<void>) => fn({ notificationRule: { update: async ({ data }: { data: Record<string, unknown> }) => { state.ruleWrites++; state.rule = { ...state.rule, ...data } } } }),
  }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'), '@/lib/prisma': { prisma },
    '@/lib/notifications/admin': { notificationAdmin: async () => state.admin ? { id: 1 } : null, sameOrigin: () => state.sameOrigin },
    '@/lib/notifications/config': {
      getNotificationConfig: async () => { state.configReads++; return { settings: structuredClone(state.settings), secrets: structuredClone(state.secrets) } },
      publicNotificationConfig: async () => ({ settings: state.settings }),
      saveNotificationConfig: async (settings: typeof state.settings, secrets: typeof state.secrets) => { state.configWrites++; state.settings = settings; state.secrets = { ...state.secrets, ...secrets } },
    },
    '@/lib/notifications/service': { ensureCoreRules: async () => {} },
    '@/lib/notifications/policy': { validPhone }, '@/lib/notifications/rules': { validateNotificationRules },
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(process.cwd(), events ? 'src/app/api/admin/notifications/rules/route.ts' : 'src/app/api/admin/notifications/settings/route.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as { GET: () => Promise<Response>; PUT: (request: Request) => Promise<Response> } }
  new Function('require', 'module', 'exports', source)((id: string) => { assert.ok(id in dependencies, id); return dependencies[id] }, module, module.exports)
  return { state, get: module.exports.GET, put: (body: unknown) => module.exports.PUT(new Request('https://dev.example.invalid/api/admin/notifications/rules', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })) }
}

test('event saves update only event rules and cannot overwrite SMTP, Aligo credentials or global channel settings', async () => {
  const { state, put } = setup()
  const before = structuredClone({ settings: state.settings, secrets: state.secrets })
  const response = await put({ rules: [{ ...initialRule, emailEnabled: false }], settings: { smtpHost: 'ignored' }, secrets: { smtpPass: 'ignored' } })
  assert.equal(response.status, 200); assert.equal(state.rule.emailEnabled, false)
  assert.equal(state.ruleWrites, 1); assert.equal(state.configWrites, 0); assert.equal(state.configReads, 0)
  assert.deepEqual({ settings: state.settings, secrets: state.secrets }, before)
})

test('base settings saves do not validate or overwrite event rules from an older page', async () => {
  const { state, put } = setup(false)
  const before = structuredClone(state.rule)
  const response = await put({ scope: 'settings', settings: { ...state.settings, smtpHost: 'updated.example.invalid' }, secrets: {}, rules: [{ eventType: 'stale-unknown-event' }] })
  assert.equal(response.status, 200); assert.equal(state.configWrites, 1); assert.equal(state.ruleWrites, 0)
  assert.equal(state.settings.smtpHost, 'updated.example.invalid'); assert.deepEqual(state.rule, before)
})

test('legacy combined settings requests keep their existing save behavior', async () => {
  const { state, put } = setup(false)
  const response = await put({ settings: state.settings, secrets: {}, rules: [{ ...initialRule, emailEnabled: false }] })
  assert.equal(response.status, 200); assert.equal(state.configWrites, 1); assert.equal(state.ruleWrites, 1)
})

test('event endpoints reject unauthorized or cross-origin access before reading or writing configuration', async () => {
  const { state, get, put } = setup()
  state.admin = false; assert.equal((await get()).status, 401); assert.equal((await put({})).status, 401)
  state.admin = true; state.sameOrigin = false; assert.equal((await put({})).status, 403)
  assert.equal(state.configReads, 0); assert.equal(state.ruleWrites, 0); assert.equal(state.configWrites, 0)
})

test('invalid events, templates and JSON fields fail before any event updates', async () => {
  for (const rule of [null, { ...initialRule, eventType: ['post_comment'] }, { ...initialRule, eventType: 'foreign' }, { ...initialRule, emailEnabled: 'true' },
    { ...initialRule, alimtalkEnabled: true }, { ...initialRule, alimtalkButtons: [] }, { ...initialRule, variableMapping: { constructor: 'name' } }]) {
    const { state, put } = setup()
    assert.equal((await put({ rules: [initialRule, rule] })).status, 400)
    assert.equal(state.ruleWrites, 0); assert.equal(state.configWrites, 0)
  }
})

test('event reads return channel availability and template readiness without exposing account credentials', async () => {
  const { get } = setup()
  const response = await get()
  assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control')!, /no-store/)
  const body = await response.json()
  assert.equal(body.canLoadTemplates, true); assert.equal(body.channels.email, DEFAULT_SETTINGS.emailEnabled)
  assert.equal(body.rules.length, 1); assert.equal(body.settings, undefined); assert.equal(body.secrets, undefined)
  assert.ok(!JSON.stringify(body).includes('private'))
})
