import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const loadFaqPageData = cache(async () => {
  const where = { published: true }
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
  return { categories, faqs, topFaqs }
})
