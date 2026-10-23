import test from 'node:test'
import assert from 'node:assert/strict'
import { getShowcasePreview } from './showcase-preview'

test('uses an inline screenshot when no attachment exists, and decodes the introduction', () => {
  assert.deepEqual(getShowcasePreview('<p><img src="/uploads/demo.png"></p><p><a href="https://example.com">example.com</a></p><p>Community &amp; stories &#x1f680;</p>'), {
    thumbnail: '/uploads/demo.png', siteUrl: 'https://example.com/', excerpt: 'Community & stories 🚀',
  })
})

test('prefers the attachment thumbnail and permits plain-text posts without links', () => {
  assert.deepEqual(getShowcasePreview('<p>A simple introduction.</p><img src="/uploads/inline.png">', '/uploads/thumb.webp'), {
    thumbnail: '/uploads/thumb.webp', siteUrl: null, excerpt: 'A simple introduction.',
  })
})

test('rejects executable, protocol-relative, credentialed, and traversal URLs', () => {
  for (const url of ['javascript:alert(1)', '//evil.example/x.png', 'https://user:pass@example.com/x.png', '/uploads/../private.png']) {
    const preview = getShowcasePreview(`<p>Safe text</p><img src="${url}">`, url)
    assert.equal(preview.thumbnail, null)
  }
  const preview = getShowcasePreview('<script>alert(1)</script><a href="javascript:alert(1)">Hello</a>')
  assert.equal(preview.siteUrl, null)
  assert.equal(preview.excerpt, 'Hello')
})

test('caps long introductions without returning HTML', () => {
  const result = getShowcasePreview(`<p><strong>${'a'.repeat(300)}</strong></p>`)
  assert.equal(result.excerpt.length, 160)
  assert.ok(!result.excerpt.includes('<'))
})
