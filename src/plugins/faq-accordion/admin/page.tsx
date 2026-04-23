"use client"

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoryList } from './components/CategoryList'
import { FaqList } from './components/FaqList'

interface Category {
  id: number
  name: string
  slug: string
  sortOrder: number
  _count: { faqs: number }
}

interface Faq {
  id: number
  question: string
  answer: string
  categoryId: number
  category: { id: number; name: string; slug: string }
  sortOrder: number
  views: number
  helpful: number
  notHelpful: number
  published: boolean
}

export default function FaqAdminPage() {
  const t = useTranslations('faqAccordion.admin')
  const [categories, setCategories] = useState<Category[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [catRes, faqRes] = await Promise.all([
      fetch('/api/admin/faq-accordion?type=categories'),
      fetch('/api/admin/faq-accordion?type=faqs'),
    ])
    if (catRes.ok) setCategories(await catRes.json())
    if (faqRes.ok) setFaqs(await faqRes.json())
  }, [])

  useEffect(() => {
    refetch().finally(() => setLoading(false))
  }, [refetch])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <Tabs defaultValue="faqs">
        <TabsList>
          <TabsTrigger value="faqs">{t('tabs.faqs')}</TabsTrigger>
          <TabsTrigger value="categories">{t('tabs.categories')}</TabsTrigger>
        </TabsList>
        <TabsContent value="faqs" className="mt-4">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <FaqList faqs={faqs} categories={categories} onChanged={refetch} />
          )}
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <CategoryList categories={categories} onChanged={refetch} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
