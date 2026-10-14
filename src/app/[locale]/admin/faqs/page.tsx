"use client"

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CategoryList } from '@/features/faqs/components/admin/CategoryList'
import { FaqList } from '@/features/faqs/components/admin/FaqList'

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
  const t = useTranslations('faqs.admin')
  const [categories, setCategories] = useState<Category[]>([])
  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    const [catRes, faqRes] = await Promise.all([
      fetch('/api/admin/faqs?type=categories'),
      fetch('/api/admin/faqs?type=faqs'),
    ])
    if (catRes.ok) setCategories(await catRes.json())
    if (faqRes.ok) setFaqs(await faqRes.json())
  }, [])

  useEffect(() => {
    refetch().finally(() => setLoading(false))
  }, [refetch])

  return (
    <div className="w-full p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <a href="/faqs" target="_blank" rel="noopener noreferrer" aria-label={t('openPublicFaq')} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          {t('publicFaq')} <ExternalLink className="h-4 w-4" />
        </a>
      </div>
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
