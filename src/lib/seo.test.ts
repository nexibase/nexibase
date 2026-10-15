import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isNexibaseProfile, isNoIndexPath, jsonLd, nexibaseSeo, pageMetadata, plainDescription, publicBaseUrl } from './seo'

test('canonical origin follows the configured site or current installation without a branded fallback', () => {
  assert.equal(publicBaseUrl('', 'https://dev.nexibase.com/').origin, 'https://dev.nexibase.com')
  assert.equal(publicBaseUrl('https://example.org/?q=1#x', 'https://dev.nexibase.com').href, 'https://example.org/')
  for (const unsafe of ['javascript:alert(1)', 'ftp://example.org', 'https://user:password@example.org', 'invalid']) {
    assert.equal(publicBaseUrl(unsafe, 'https://own-domain.example').origin, 'https://own-domain.example')
  }
})

test('individual pages carry their own canonical and social metadata', () => {
  const metadata = pageMetadata('Post title', 'Post description', '/boards/free/123', { article: true })
  assert.equal(metadata.alternates?.canonical, '/boards/free/123')
  assert.equal(metadata.openGraph?.url, '/boards/free/123')
  assert.equal(metadata.description, 'Post description')
  assert.deepEqual(pageMetadata('Private', '', '/boards/private/123', { noIndex: true }).robots, { index: false, follow: false })
})

test('structured data cannot terminate its script element, including malicious user titles', () => {
  const input = { headline: '</script><img src=x onerror=alert(1)>', description: '줄바꿈\u2028테스트\u2029' }
  const output = jsonLd(input)
  assert.ok(!output.includes('<'))
  assert.ok(!output.includes('\u2028'))
  assert.deepEqual(JSON.parse(output), input)
})

test('search descriptions remove markup, scripts and repeated whitespace', () => {
  assert.equal(plainDescription('<script>private()</script><h1>Next.js</h1><p>게시판 &amp; 쇼핑몰&nbsp; CMS</p>'), 'Next.js 게시판 & 쇼핑몰 CMS')
  assert.equal(plainDescription('abcdefgh', 5), 'abcde')
})

test('admin, account, search, write forms and commerce transactions are not search results', () => {
  for (const path of ['/admin', '/admin/settings', '/api/boards', '/mypage/messages', '/login', '/search', '/boards/free/create', '/boards/free/1/edit', '/shop/cart', '/shop/orders/1']) assert.ok(isNoIndexPath(path), path)
  for (const path of ['/', '/boards', '/boards/free/1', '/contents/about', '/shop/products/1', '/administrator-news']) assert.ok(!isNoIndexPath(path), path)
})

test('NexiBase product SEO is opt-in for general CMS installations and automatic for marketing widgets', () => {
  assert.ok(!isNexibaseProfile('auto', ['welcome-banner', 'latest-posts']))
  assert.ok(isNexibaseProfile('auto', ['nexibase-landing-hero']))
  assert.ok(isNexibaseProfile('nexibase', []))
  assert.ok(!isNexibaseProfile('custom', ['nexibase-landing-hero']))
  for (const locale of ['ko', 'en']) {
    const copy = nexibaseSeo(locale)
    assert.match(copy.title, /Next\.js/)
    assert.match(copy.title, /JavaScript/)
    assert.match(copy.description, /CMS/)
  }
})
