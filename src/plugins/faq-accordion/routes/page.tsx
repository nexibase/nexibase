import { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { prisma } from '@/lib/prisma'
import { FaqAccordion } from './components/FaqAccordion'
import { stripHtml } from '@/plugins/faq-accordion/lib/sanitize'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('faqAccordion')
  return {
    title: t('title'),
    description: t('title'),
  }
}

export default async function FaqPage() {
  const t = await getTranslations('faqAccordion')

  const [categories, faqs, topFaqs] = await Promise.all([
    prisma.faqCategory.findMany({
      include: { _count: { select: { faqs: { where: { published: true } } } } },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.faq.findMany({
      where: { published: true },
      include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    }),
    prisma.faq.findMany({
      where: { published: true },
      include: { category: true },
      orderBy: { views: 'desc' },
      take: 3,
    }),
  ])

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer) },
    })),
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold mb-6">{t('title')}</h1>
      <FaqAccordion categories={categories} faqs={faqs} topFaqs={topFaqs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
    </div>
  )
}
