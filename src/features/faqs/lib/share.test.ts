import assert from 'node:assert/strict'
import { test } from 'node:test'
import { faqHash, faqIdFromHash, faqSharePath } from './share'

test('question links keep the FAQ collection URL and identify a numeric question', () => {
  assert.equal(faqSharePath(42), '/faqs#faq-42')
  assert.equal(faqIdFromHash(faqHash(42)), 42)
  assert.equal(new URL(faqSharePath(42), 'https://example.com').pathname, '/faqs')
})

test('unrelated, malformed and unsafe fragments cannot select a question', () => {
  for (const hash of ['', '#faq-', '#faq-0', '#faq--2', '#faq-3<script>', '#faq-2?x=1', '#faq-9007199254740992', '#category-2']) assert.equal(faqIdFromHash(hash), null)
})
