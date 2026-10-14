import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const loadFaqPageData = cache(async (slug?: string) => {
  const category = slug ? await prisma.faqCategory.findUnique({ where: { slug } }) : null
  if (slug && !category) notFound()
  const where = { published: true, ...(category ? { categoryId: category.id } : {}) }
  const [categories, faqs, topFaqs] = await Promise.all([
    prisma.faqCategory.findMany({
      include: { _count: { select: { faqs: { where: { published: true } } } } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    }),
    prisma.faq.findMany({
      where, include: { category: true },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    }),
    prisma.faq.findMany({ where, include: { category: true }, orderBy: { views: 'desc' }, take: 3 }),
  ])
  return { category, categories, faqs, topFaqs }
})
