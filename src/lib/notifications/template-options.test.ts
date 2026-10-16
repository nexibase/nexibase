import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { aligoTemplateLabel, projectAligoTemplates, usableAligoTemplate } from './template-options'

const row = { templtCode: 'TPL_APPROVED', templtName: '배송 안내', templtContent: '#{고객명}님\r\n배송이 시작되었습니다.', status: 'A', inspStatus: 'APR',
  senderKey: 'private-profile-key', buttons: [{ ordering: '1', name: '배송 조회', linkType: 'WL', linkMo: 'https://example.invalid/#{주문번호}', senderKey: 'private-profile-key' }] }

test('template projection preserves the approved body and converts only sending button fields without credentials', () => {
  const [template] = projectAligoTemplates([row])
  assert.equal(template.name, '배송 안내')
  assert.equal(template.content, row.templtContent)
  assert.deepEqual(template.buttons, { button: [{ name: '배송 조회', linkType: 'WL', linkMo: 'https://example.invalid/#{주문번호}' }] })
  assert.ok(!JSON.stringify(template).includes('private-profile-key'))
  assert.ok(!JSON.stringify(template).includes('senderKey'))
  assert.equal(usableAligoTemplate(template), true)
  assert.equal(aligoTemplateLabel(template), '배송 안내')
})

test('approved templates are selectable in waiting or suspended status while preserving their status labels', () => {
  for (const status of ['R', 'S']) {
    const [template] = projectAligoTemplates([{ ...row, status, inspStatus: 'APR' }])
    assert.equal(usableAligoTemplate(template), true)
    assert.ok(aligoTemplateLabel(template).includes('승인됨'))
    assert.ok(aligoTemplateLabel(template).includes(status === 'R' ? '대기' : '중단'))
  }
})

test('unreviewed and rejected templates cannot be selected even with a normal usage status', () => {
  for (const inspStatus of ['REG', 'REQ', 'REJ']) {
    const [template] = projectAligoTemplates([{ ...row, status: 'A', inspStatus }])
    assert.equal(usableAligoTemplate(template), false)
    assert.ok(aligoTemplateLabel(template).startsWith('배송 안내 ('))
  }
})

test('templates without buttons clear old button data and malformed template rows are excluded', () => {
  const [template] = projectAligoTemplates([{ ...row, buttons: [] }, { ...row, templtCode: '../bad' }, { ...row, templtContent: null }])
  assert.equal(template.buttons, null)
  assert.equal(projectAligoTemplates([{ ...row, buttons: [] }]).length, 1)
  assert.equal(projectAligoTemplates([{ ...row, templtCode: '../bad' }, { ...row, templtContent: null }]).length, 0)
})

const require = createRequire(import.meta.url)
const { NextRequest } = require('next/server')
function setup() {
  const state = { admin: true, configured: true, calls: [] as Record<string, string>[], result: { code: 0, list: [row] } as unknown }
  const dependencies: Record<string, unknown> = {
    'next/server': require('next/server'),
    '@/lib/notifications/admin': { notificationAdmin: async () => state.admin ? { id: 1 } : null },
    '@/lib/notifications/config': { getNotificationConfig: async () => ({ settings: { aligoUserId: 'test-user' }, secrets: state.configured ? { aligoKey: 'private-api-key', senderKey: 'private-profile-key' } : {} }) },
    '@/lib/notifications/providers': { aligoRequest: async (_channel: string, endpoint: string, _settings: unknown, _secrets: unknown, params: Record<string, string>) => { assert.equal(endpoint, 'akv10/template/list'); state.calls.push(params); return state.result } },
    '@/lib/notifications/template-options': { projectAligoTemplates },
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(process.cwd(), 'src/app/api/admin/notifications/templates/route.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} as { GET: (request: unknown) => Promise<Response> } }
  new Function('require', 'module', 'exports', source)((id: string) => { assert.ok(id in dependencies); return dependencies[id] }, module, module.exports)
  return { state, get: (query = '') => module.exports.GET(new NextRequest('https://dev.example.invalid/api/admin/notifications/templates' + query)) }
}

test('template list endpoint allows all-template name lookup while retaining the optional code filter', async () => {
  const { state, get } = setup()
  const response = await get()
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Cache-Control')!, /no-store/)
  assert.deepEqual(state.calls[0], { senderkey: 'private-profile-key' })
  const body = await response.json()
  assert.equal(body.templates[0].name, '배송 안내')
  assert.ok(!JSON.stringify(body).includes('private-profile-key'))
  assert.equal((await get('?code=TPL_APPROVED')).status, 200)
  assert.equal(state.calls[1].tpl_code, 'TPL_APPROVED')
})

test('unauthorized, incomplete and invalid template queries never call the provider', async () => {
  const { state, get } = setup()
  state.admin = false; assert.equal((await get()).status, 401)
  state.admin = true; state.configured = false; assert.equal((await get()).status, 400)
  state.configured = true; assert.equal((await get('?code=../bad')).status, 400)
  assert.equal(state.calls.length, 0)
})

test('template list endpoint rejects malformed success and failure responses without returning raw data', async () => {
  const { state, get } = setup()
  for (const result of [{ code: null, list: [] }, { code: '', list: [] }, { code: -99, message: 'private-api-key' }, { code: 0, list: null }]) {
    state.result = result
    const response = await get()
    assert.equal(response.status, 502)
    assert.ok(!(await response.text()).includes('private-api-key'))
  }
})
