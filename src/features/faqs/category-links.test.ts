import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextIntlClientProvider } from 'next-intl'
import { CategoryList } from './components/admin/CategoryList'
import { FaqAccordion } from './components/FaqAccordion'
import messages from '@/locales/en.json'

// The CLI transpiler uses the classic runtime for the project's preserved JSX.
Object.assign(globalThis, { React })
function render(element: React.ReactNode) {
  return renderToStaticMarkup(React.createElement(NextIntlClientProvider, { locale: 'en', messages, children: element }))
}

test('admin categories expose navigable public links instead of standalone slugs', () => {
  const html = render(React.createElement(CategoryList, {
    categories: [{ id: 1, name: 'General', slug: 'general', sortOrder: 0, _count: { faqs: 1 } }],
    onChanged() {},
  }))
  const link = html.match(/<a\b[^>]*href="\/faqs\/general"[^>]*>[\s\S]*?<\/a>/)?.[0]
  assert.ok(link)
  assert.ok(link.includes('target="_blank"') && link.includes('noopener noreferrer'))
  assert.ok(link.includes('/faqs/general'))
})

test('empty category tabs keep their direct link and a slug named all cannot select the root tab', () => {
  const category = { id: 17, name: 'All topics', slug: 'all', _count: { faqs: 0 } }
  const html = render(React.createElement(FaqAccordion, { categories: [category], faqs: [], topFaqs: [], activeCategory: category }))
  const anchors = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? []
  const categoryTab = anchors.find(link => link.includes('href="/faqs/all"'))
  const rootTab = anchors.find(link => link.includes('href="/faqs"'))
  assert.ok(categoryTab?.includes('aria-selected="true"'))
  assert.ok(rootTab?.includes('aria-selected="false"'))
  assert.ok(html.includes(messages.faqs.empty))
})
