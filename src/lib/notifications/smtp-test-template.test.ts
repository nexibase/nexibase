import test from 'node:test'
import assert from 'node:assert/strict'
import { smtpTestTemplate } from './smtp-test-template'

test('SMTP test identifies its site, canonical origin, environment and Korean request time in text and HTML', () => {
  const result = smtpTestTemplate({ name: '테스트 사이트', url: 'https://dev.example.invalid/path', development: true }, new Date('2026-10-15T07:00:00Z'))
  assert.equal(result.subject, '[테스트 사이트] [dev] SMTP 테스트 메일')
  for (const content of [result.text, result.html]) {
    assert.ok(content.includes('테스트 사이트'))
    assert.ok(content.includes('https://dev.example.invalid'))
    assert.ok(content.includes('개발(dev)'))
    assert.ok(content.includes('KST'))
  }
  assert.ok(result.html.includes('href="https://dev.example.invalid"'))
  assert.ok(!result.html.includes('/path'))
})

test('SMTP test escapes site content and excludes unsafe URLs and URL credentials', () => {
  const result = smtpTestTemplate({ name: '<b>site</b>\r\nname', url: 'javascript:alert(1)', development: false })
  assert.ok(!result.subject.includes('\n'))
  assert.ok(result.html.includes('&lt;b&gt;site&lt;/b&gt;'))
  assert.ok(!result.html.includes('javascript:') && !result.html.includes('<b>site</b>'))
  assert.ok(result.text.includes('환경: 운영'))
  const credentials = smtpTestTemplate({ name: 'Site', url: 'https://private:password@example.invalid/', development: false })
  assert.ok(!credentials.text.includes('password') && !credentials.html.includes('private:'))
})
