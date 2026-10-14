import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import FaqAdminPage from '@/app/[locale]/admin/faqs/page'
import { CategoryList } from './components/admin/CategoryList'
import { FaqAccordion } from './components/FaqAccordion'
import messages from '@/locales/en.json'

Object.assign(globalThis, { React })
function render(element: React.ReactNode) {
  return renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale: 'en', messages, children: element }))
}

test('FAQ admin heading and public link both use FAQ, not FAQ Management', () => {
  const html = render(React.createElement(FaqAdminPage))
  assert.match(html, /<h1[^>]*>FAQ<\/h1>/)
  const link = html.match(/<a\b[^>]*href="\/faqs"[^>]*>[\s\S]*?<\/a>/)?.[0]
  assert.ok(link?.includes('target="_blank"') && link.includes('>FAQ '))
  assert.equal(messages.admin.faqs, 'FAQ')
})

test('categories are local tabs and admin rows no longer expose category page URLs', () => {
  const category = { id: 17, name: 'General', slug: 'general', sortOrder: 0, _count: { faqs: 1 } }
  const faq = { id: 19, question: 'Question', answer: '<p>Answer</p>', categoryId: 17, views: 4, helpful: 0, notHelpful: 0, category }
  const page = render(React.createElement(FaqAccordion, { categories: [category], faqs: [faq], topFaqs: [] }))
  assert.ok(page.includes('role="tab"') && page.includes('>General'))
  assert.ok(!page.includes('/faqs/general'))
  assert.match(page, />\s*4<\/span>/)
  const admin = render(React.createElement(CategoryList, { categories: [category], onChanged() {} }))
  assert.ok(!admin.includes('/faqs/general'))
})
