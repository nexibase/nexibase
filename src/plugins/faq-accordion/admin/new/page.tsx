"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FaqForm } from '../components/FaqForm'

interface Category { id: number; name: string }

export default function NewFaqPage() {
  const t = useTranslations('faqAccordion.admin')
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch('/api/admin/faq-accordion?type=categories')
      if (cancelled) return
      if (res.ok) {
        const data: Category[] = await res.json()
        if (data.length === 0) {
          alert(t('emptyCategories'))
          router.replace('/admin/faq-accordion')
          return
        }
        setCategories(data)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [router, t])

  if (loading) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  return <FaqForm initial={null} categories={categories} />
}
