import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { FaqAccordion } from './FaqAccordion'
import { loadFaqPageData } from '../lib/page-data'
import { stripHtml } from '../lib/sanitize'

export async function faqPageMetadata(): Promise<Metadata> {
  const t = await getTranslations('faqs')
  const title = t('title')
  return {
    title, description: title,
    alternates: { canonical: '/faqs' },
    openGraph: { title, description: title, url: '/faqs' },
  }
}

export async function FaqPage() {
  const [{ categories, faqs, topFaqs }, t] = await Promise.all([loadFaqPageData(), getTranslations('faqs')])
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question', name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(faq.answer) },
    })),
  }
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <FaqAccordion categories={categories} faqs={faqs} topFaqs={topFaqs} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </div>
  )
}
