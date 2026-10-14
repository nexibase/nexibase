import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SYSTEM_SLUGS } from './system-routes'

test('publishing paths stay reserved after removal from the plugin manifest', () => {
  for (const slug of ['boards', 'contents', 'policies', 'faqs', 'faq', 'faq-accordion']) assert.ok(SYSTEM_SLUGS.includes(slug))
  assert.equal(new Set(SYSTEM_SLUGS).size, SYSTEM_SLUGS.length)
})
