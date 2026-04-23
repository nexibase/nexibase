"use client"

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoryList } from './components/CategoryList'

interface Category {
  id: number
  name: string
  slug: string
  sortOrder: number
  _count: { faqs: number }
}

export default function FaqAdminPage() {
  const t = useTranslations('faqAccordion.admin')
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  const refetchCategories = useCallback(async () => {
    const res = await fetch('/api/admin/faq-accordion?type=categories')
    if (res.ok) setCategories(await res.json())
  }, [])

  useEffect(() => {
    refetchCategories().finally(() => setLoading(false))
  }, [refetchCategories])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <Tabs defaultValue="faqs">
        <TabsList>
          <TabsTrigger value="faqs">{t('tabs.faqs')}</TabsTrigger>
          <TabsTrigger value="categories">{t('tabs.categories')}</TabsTrigger>
        </TabsList>
        <TabsContent value="faqs" className="mt-4">
          <div className="text-muted-foreground">FAQs tab — wired in next task.</div>
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : (
            <CategoryList categories={categories} onChanged={refetchCategories} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
