import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { DEFAULT_SETTINGS } from './config'
import * as policy from './policy'
import { encrypt, decrypt, encryptionReady } from './crypto'
import { sendViaProvider, type DeliveryPayload, type ProviderResult } from './providers'

process.env.NOTIFICATION_ENCRYPTION_KEY = '43'.repeat(32)
process.env.NOTIFICATION_ENVIRONMENT = 'development'
const require = createRequire(import.meta.url)
type Row = Record<string, any>
function load(file: string, dependencies: Record<string, unknown>): any {
  const source = ts.transpileModule(fs.readFileSync(path.join(process.cwd(), 'src/lib/notifications', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', source)((id: string) => {
    if (id in dependencies) return dependencies[id]
    if (id === 'node:crypto' || id === '@prisma/client') return require(id)
    throw new Error(`Unmocked dependency: ${id}`)
  }, module, module.exports)
  return module.exports
}
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'OR') return value.some((clause: Row) => matches(row, clause))
    if (key === 'eventId_channel') return matches(row, value)
    const actual = row[key]
    if (value instanceof Date) return actual instanceof Date && actual.getTime() === value.getTime()
    if (value && typeof value === 'object') return Object.entries(value).every(([operator, target]: [string, any]) => {
      if (operator === 'in') return target.includes(actual)
      if (operator === 'not') return actual !== target
      if (operator === 'lt') return actual != null && actual < target
      if (operator === 'lte') return actual != null && actual <= target
      throw new Error(`Unhandled filter ${operator}`)
    })
    return actual === value
  })
}
function fixture({ sms = true, alimtalk = true, testChannel }: { sms?: boolean; alimtalk?: boolean; testChannel?: 'alimtalk' | 'sms' } = {}) {
  const state = {
    settings: { ...DEFAULT_SETTINGS, emailEnabled: false, smsEnabled: sms, alimtalkEnabled: alimtalk, liveEnabled: true,
      testRecipients: ['01000000000'], aligoUserId: 'test-account', sender: '0212345678' },
    secrets: { aligoKey: 'test-private', senderKey: 'test-profile' },
    user: { id: 1, email: 'member@example.invalid', phone: '01000000000', nickname: '회원', name: '회원', status: 'active', role: 'user', deletedAt: null },
    rule: { eventType: 'direct_message', label: '쪽지', owner: 'core', preferenceType: 'direct_message', emailEnabled: false, smsEnabled: true, alimtalkEnabled: true,
      smsTemplate: '#{title} #{message}', alimtalkTemplate: '#{message}', alimtalkCode: 'TPL_TEST', alimtalkButtons: null, variableMapping: {} },
    pref: { mobilePreferences: { direct_message: { sms: true, alimtalk: true } } },
    jobs: [] as Row[], events: [] as Row[], notes: [] as Row[], requests: [] as { channel: string; params: Record<string, string> }[], queries: [] as string[],
    outcome: 'accepted' as ProviderResult['status'], query: (_channel: string): ProviderResult | null => null,
  }
  const getConfig = async () => ({ settings: structuredClone(state.settings), secrets: state.secrets, updatedAt: undefined })
  const prisma: Row = {
    user: { findUnique: async () => structuredClone(state.user) },
    notificationPreference: { findUnique: async () => structuredClone(state.pref) },
    notificationRule: { upsert: async () => structuredClone(state.rule), findUnique: async () => structuredClone(state.rule) },
    notificationEvent: {
      upsert: async ({ where, create }: Row) => { let event = state.events.find(e => e.dedupeKey === where.dedupeKey); if (!event) { event = create; state.events.push(event) }; return structuredClone(event) },
      findUnique: async ({ where }: Row) => { const event = state.events.find(e => matches(e, where)); return event ? { ...structuredClone(event), user: structuredClone(state.user) } : null },
    },
    notification: {
      create: async ({ data }: Row) => { const note = { id: state.notes.length + 1, ...data }; state.notes.push(note); return structuredClone(note) },
      findUnique: async ({ where }: Row) => structuredClone(state.notes.find(n => matches(n, where))),
    },
    notificationDelivery: {
      create: async ({ data }: Row) => {
        const row = { id: `job-${state.jobs.length}`, attempts: 0, providerId: null, providerCode: null, lockedAt: null, lockToken: null,
          nextAttemptAt: new Date(0), acceptedAt: null, completedAt: null, lastCheckedAt: null, createdAt: new Date(), ...data }
        state.jobs.push(row); return structuredClone(row)
      },
      findUnique: async ({ where }: Row) => { const row = state.jobs.find(j => matches(j, where)); return row ? structuredClone(row) : null },
      findMany: async ({ where, take }: Row) => structuredClone(state.jobs.filter(j => matches(j, where)).slice(0, take)),
      updateMany: async ({ where, data }: Row) => {
        let count = 0
        for (const row of state.jobs.filter(j => matches(j, where))) {
          for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value && typeof value === 'object' && 'increment' in value ? row[key] + (value as Row).increment : value
          count++
        }
        return { count }
      },
    },
  }
  prisma.$transaction = async (fn: (tx: Row) => unknown) => fn(prisma)
  const common = { '@/lib/prisma': { prisma }, '@/lib/plugins': { getAllPlugins: async () => [], isPluginEnabled: async () => true },
    './config': { getNotificationConfig: getConfig, configReadiness: () => ({ email: [], sms: [], alimtalk: [] }) },
    './crypto': { encrypt, decrypt, encryptionReady }, './policy': policy }
  const service = load('service.ts', common)
  const worker = load('worker.ts', { ...common, './service': service, './providers': { sendViaProvider: () => { throw new Error('Network send must be injected') }, queryDelivery: () => { throw new Error('Network query must be injected') } } })
  const send = async (channel: policy.Channel, payload: DeliveryPayload, settings: typeof state.settings, secrets: typeof state.secrets, live: boolean) => {
    return sendViaProvider(channel, payload, settings, secrets, live, async (_input, init) => {
      state.requests.push({ channel, params: Object.fromEntries(init!.body as URLSearchParams) })
      if (state.outcome === 'unknown') throw new DOMException('timeout', 'TimeoutError')
      if (state.outcome === 'failed') return Response.json({ code: -99, message: '접수 거절' })
      return Response.json(channel === 'alimtalk' ? { code: 0, info: { mid: 200, scnt: 1, fcnt: 0 } } : { result_code: 1, msg_id: 300, success_cnt: 1, error_cnt: 0 })
    })
  }
  return { state, enqueue: () => service.emitNotification({ userId: 1, type: testChannel ? 'notification_test' : 'direct_message', eventKey: 'one', title: '제목', message: '본문',
    ...(testChannel ? { test: { channel: testChannel, live: false }, testRule: state.rule } : {}) }),
    run: () => worker.runNotificationWorkerOnce({ getConfig, send, query: async (channel: string) => { state.queries.push(channel); return state.query(channel) } }),
    job: (channel: string) => state.jobs.find(j => j.channel === channel)!,
    expirePoll: () => { for (const job of state.jobs) { job.lastCheckedAt = new Date(0); job.nextAttemptAt = new Date(0) } },
  }
}

test('new automatic fallback is one Alimtalk request; provider SMS is tracked by smid without another send', async () => {
  const f = fixture(); await f.enqueue()
  assert.equal(f.job('sms').status, 'waiting')
  assert.equal(decrypt<DeliveryPayload>(f.job('sms').payloadEncrypted).aligoManaged, true)
  f.state.query = channel => channel === 'alimtalk' ? { status: 'failed', fallbackProviderId: '901' } : { status: 'delivered' }
  await f.run(); await f.run(); await f.run()
  assert.deepEqual(f.state.requests.map(r => r.channel), ['alimtalk'])
  assert.equal(f.state.requests[0].params.failover, 'Y'); assert.equal(f.state.requests[0].params.fmessage_1, '제목 본문')
  assert.equal(f.job('alimtalk').status, 'failed'); assert.equal(f.job('sms').status, 'delivered'); assert.equal(f.job('sms').providerId, '901')
})
test('successful Alimtalk cancels the provider-owned SMS placeholder', async () => {
  const f = fixture(); await f.enqueue(); f.state.query = () => ({ status: 'delivered' })
  await f.run(); await f.run()
  assert.equal(f.job('sms').status, 'skipped'); assert.equal(f.state.requests.length, 1)
})
test('single-channel settings keep Alimtalk-only failover=N and standalone SMS working', async () => {
  for (const channel of ['sms', 'alimtalk']) {
    const f = fixture({ sms: channel === 'sms', alimtalk: channel === 'alimtalk' }); await f.enqueue(); await f.run(); await f.run()
    assert.deepEqual(f.state.requests.map(r => r.channel), [channel])
    if (channel === 'alimtalk') assert.equal(f.state.requests[0].params.failover, 'N')
  }
})
test('revoking SMS consent or disabling its global/event switch before dispatch removes failover', async () => {
  for (const condition of ['consent', 'global', 'event']) {
    const f = fixture(); await f.enqueue()
    if (condition === 'consent') f.state.pref.mobilePreferences.direct_message.sms = false
    if (condition === 'global') f.state.settings.smsEnabled = false
    if (condition === 'event') f.state.rule.smsEnabled = false
    f.state.query = () => ({ status: 'failed' })
    await f.run(); await f.run()
    assert.equal(f.state.requests[0].params.failover, 'N'); assert.equal(f.job('sms').status, 'skipped')
    assert.equal(f.state.requests.length, 1)
  }
})
test('uncertain acceptance or API rejection never starts an independent fallback SMS', async () => {
  for (const outcome of ['unknown', 'failed'] as const) {
    const f = fixture(); await f.enqueue(); f.state.outcome = outcome
    await f.run(); await f.run()
    assert.equal(f.state.requests.length, 1)
    assert.equal(f.job('sms').status, outcome === 'unknown' ? 'unknown' : 'skipped')
  }
})
test('a late fallback ID is polled and attached after Alimtalk failure, never released into the SMS send queue', async () => {
  const f = fixture(); await f.enqueue(); f.state.query = () => ({ status: 'failed' })
  await f.run(); assert.equal(f.job('sms').status, 'waiting')
  f.expirePoll(); f.state.query = () => ({ status: 'failed', fallbackProviderId: '902' })
  await f.run(); assert.equal(f.job('sms').status, 'accepted'); assert.equal(f.job('sms').providerId, '902')
  assert.equal(f.state.requests.length, 1)
})
test('a provider-owned SMS accidentally marked pending is blocked, including concurrent workers', async () => {
  const f = fixture(); await f.enqueue(); f.job('sms').status = 'pending'
  await Promise.all([f.run(), f.run()]); await f.run()
  assert.ok(f.state.requests.every(r => r.channel === 'alimtalk'))
  assert.equal(f.state.requests.length, 1); assert.equal(f.job('sms').status, 'waiting')
})
test('persisted fallback IDs recover tracking after a process stops before settling the SMS row', async () => {
  const f = fixture(); await f.enqueue()
  f.job('alimtalk').status = 'failed'; f.job('alimtalk').providerId = '200'
  f.job('alimtalk').payloadEncrypted = encrypt({ ...decrypt<DeliveryPayload>(f.job('alimtalk').payloadEncrypted), aligoFallbackId: '903' })
  await f.run(); assert.equal(f.job('sms').providerId, '903'); assert.equal(f.job('sms').status, 'accepted'); assert.equal(f.state.requests.length, 0)
})
test('pre-transition jobs retain their failover=N path and send only one legacy SMS after failure', async () => {
  const f = fixture(); await f.enqueue()
  for (const channel of ['sms', 'alimtalk']) {
    const payload = decrypt<DeliveryPayload>(f.job(channel).payloadEncrypted)
    delete payload.aligoManaged; delete payload.aligoFailoverSms; f.job(channel).payloadEncrypted = encrypt(payload)
  }
  f.state.query = channel => ({ status: channel === 'alimtalk' ? 'failed' : 'delivered' })
  await f.run(); await f.run(); await f.run()
  assert.deepEqual(f.state.requests.map(r => r.channel), ['alimtalk', 'sms']); assert.equal(f.state.requests[0].params.failover, 'N')
})
test('single-channel admin tests never enable provider fallback even when both global channels are on', async () => {
  const f = fixture({ testChannel: 'alimtalk' }); await f.enqueue(); await f.run()
  assert.equal(f.state.requests.length, 1); assert.equal(f.state.requests[0].params.failover, 'N'); assert.equal(f.state.requests[0].params.testMode, 'Y')
})
test('unresolved provider fallback expires to attention-required without resending', async () => {
  const f = fixture(); await f.enqueue(); f.state.query = () => ({ status: 'failed' }); await f.run()
  f.job('alimtalk').acceptedAt = new Date(Date.now() - 25 * 60 * 60000)
  await f.run(); assert.equal(f.job('sms').status, 'unknown'); assert.equal(f.state.requests.length, 1)
})
