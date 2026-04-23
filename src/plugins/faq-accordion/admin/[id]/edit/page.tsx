"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { FaqForm } from '../../components/FaqForm'

interface Category { id: number; name: string }
interface Faq {
  id: number
  question: string
  answer: string
  categoryId: number
  published: boolean
  views: number
  helpful: number
  notHelpful: number
}

export default function EditFaqPage() {
  const t = useTranslations('faqAccordion.admin')
  const params = useParams()
  const router = useRouter()
  const id = parseInt(String(params.id), 10)

  const [faq, setFaq] = useState<Faq | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (Number.isNaN(id)) {
      router.replace('/admin/faq-accordion')
      return
    }
    let cancelled = false
    async function load() {
      const [catRes, faqRes] = await Promise.all([
        fetch('/api/admin/faq-accordion?type=categories'),
        fetch('/api/admin/faq-accordion?type=faqs'),
      ])
      if (cancelled) return
      const cats: Category[] = catRes.ok ? await catRes.json() : []
      const faqs: Faq[] = faqRes.ok ? await faqRes.json() : []
      const target = faqs.find((f) => f.id === id) ?? null
      if (!target) {
        alert(t('notFound'))
        router.replace('/admin/faq-accordion')
        return
      }
      setCategories(cats)
      setFaq(target)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, router, t])

  if (loading || !faq) {
    return <div className="p-6 text-muted-foreground">Loading…</div>
  }

  return (
    <FaqForm
      initial={faq}
      categories={categories}
      stats={{
        views: faq.views,
        helpful: faq.helpful,
        notHelpful: faq.notHelpful,
      }}
    />
  )
}
