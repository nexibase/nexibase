"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { faqSharePath } from '@/features/faqs/lib/share'

interface Faq {
  id: number
  question: string
}

interface Props {
  settings?: { limit?: number }
}

export default function FaqWidget({ settings }: Props) {
  const t = useTranslations('faqs')
  const limit = Math.min(10, Math.max(1, settings?.limit ?? 5))

  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/faqs?type=random&limit=${limit}`)
        if (cancelled) return
        if (!res.ok) {
          setFaqs([])
          return
        }
        const data: { faqs: Faq[] } = await res.json()
        setFaqs(data.faqs)
      } catch {
        if (!cancelled) setFaqs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [limit])

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <h2 className="text-lg font-semibold">{t('title')}</h2>

        {loading ? (
          <div className="space-y-2">
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
            <div className="h-10 rounded bg-muted animate-pulse" />
          </div>
        ) : faqs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <ul className="divide-y rounded-md border">
            {faqs.map(faq => <li key={faq.id}>
              <Link href={faqSharePath(faq.id)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                <span className="font-medium text-sm">{faq.question}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>)}
          </ul>
        )}

        <div className="pt-1">
          <Link
            href="/faqs"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('widget.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
