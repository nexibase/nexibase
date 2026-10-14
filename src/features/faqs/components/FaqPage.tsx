import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FaqAccordion } from './FaqAccordion'
import { loadFaqPageData } from '../lib/page-data'
import { faqCategoryPath } from '../lib/urls'
import { stripHtml } from '../lib/sanitize'

export async function faqPageMetadata(slug?: string): Promise<Metadata> {
  const [{ category }, t] = await Promise.all([loadFaqPageData(slug), getTranslations('faqs')])
  const title = category ? t('categoryTitle', { category: category.name }) : t('title')
  return {
    title, description: title,
    alternates: { canonical: faqCategoryPath(category?.slug) },
    openGraph: { title, description: title, url: faqCategoryPath(category?.slug) },
  }
}

export async function FaqPage({ slug }: { slug?: string }) {
  const [{ category, categories, faqs, topFaqs }, t] = await Promise.all([loadFaqPageData(slug), getTranslations('faqs')])
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question', name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(faq.answer) },
    })),
  }
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">{category ? t('categoryTitle', { category: category.name }) : t('title')}</h1>
      <FaqAccordion key={category?.slug ?? 'all'} categories={categories} faqs={faqs} topFaqs={topFaqs} activeCategory={category} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </div>
  )
}
