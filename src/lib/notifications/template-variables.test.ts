import test from 'node:test'
import assert from 'node:assert/strict'
import { changeVariableMapping, readVariableMapping, templateVariables, variableSources } from './template-variables'
import { renderTemplate } from './policy'

test('variables are discovered across Alimtalk, SMS and buttons, with shared names shown once', () => {
  assert.deepEqual(templateVariables({ alimtalkTemplate: '#{고객명}님 #{내용} #{고객명}', smsTemplate: '#{고객명}: #{내용}',
    buttonsText: '{"linkMo":"#{link}?name=#{고객명}"}', variableMapping: { 예전변수: 'customPluginValue' } }), [
    { name: '고객명', uses: ['alimtalk', 'sms', 'buttons'] }, { name: '내용', uses: ['alimtalk', 'sms'] },
    { name: 'link', uses: ['buttons'] }, { name: '예전변수', uses: [] },
  ])
})
test('source choices expose actual shared fields and restrict order fields to shop events', () => {
  assert.ok(variableSources('comment_reply').some(source => source.key === 'name'))
  assert.ok(!variableSources('comment_reply').some(source => String(source.key) === 'orderNo'))
  for (const type of ['shop.new_order_admin', 'shop.order_completed', 'shop.order_status']) {
    assert.ok(variableSources(type).some(source => source.key === 'orderNo'))
    assert.ok(variableSources(type).some(source => source.key === 'customerName'))
  }
})
test('saved custom connections survive editing another row and clearing a row restores implicit built-in substitution', () => {
  const original = readVariableMapping({ 고객명: 'name', 이전변수: 'pluginValue', title: 'message' })
  const changed = changeVariableMapping(original, '내용', 'message')
  assert.deepEqual(changed, { 고객명: 'name', 이전변수: 'pluginValue', title: 'message', 내용: 'message' })
  const cleared = changeVariableMapping(changed, 'title', '')
  assert.equal(Object.hasOwn(cleared, 'title'), false)
  assert.equal(original.title, 'message'); assert.equal(original.내용, undefined)
  assert.equal(renderTemplate('#{title}', { title: '원래 알림 제목' }), '원래 알림 제목')
})
test('the mapping form produces the same saved object contract used by both message renderers', () => {
  let mapping = changeVariableMapping({}, '고객명', 'name')
  mapping = changeVariableMapping(mapping, '내용', 'message')
  const posted = JSON.parse(JSON.stringify({ variableMapping: mapping }))
  assert.deepEqual(posted.variableMapping, { 고객명: 'name', 내용: 'message' })
  const values: Record<string, string> = { name: '홍길동', message: '댓글이 등록되었습니다.' }
  for (const [alias, source] of Object.entries(mapping)) values[alias] = values[source]
  assert.equal(renderTemplate('#{고객명}님, #{내용}', values), '홍길동님, 댓글이 등록되었습니다.')
  assert.equal(renderTemplate('[문자] #{고객명}: #{내용}', values), '[문자] 홍길동: 댓글이 등록되었습니다.')
})
test('empty templates need no mapping and invalid non-object saved data does not break the editor', () => {
  for (const value of [null, [], 'invalid']) assert.deepEqual(readVariableMapping(value), {})
  assert.deepEqual(templateVariables({ alimtalkTemplate: '고정 본문', smsTemplate: '', buttonsText: '', variableMapping: {} }), [])
})
