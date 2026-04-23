"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Eye, ArrowRight } from 'lucide-react'
import { Accordion, AccordionItem } from '@/plugins/faq-accordion/routes/components/Accordion'
import { sanitizeHtml } from '@/plugins/faq-accordion/lib/sanitize'

interface Faq {
  id: number
  question: string
  answer: string
  views: number
}

interface Props {
  settings?: { limit?: number }
}

export default function FaqWidget({ settings }: Props) {
  const t = useTranslations('faqAccordion')
  const limit = Math.min(10, Math.max(1, settings?.limit ?? 5))

  const [faqs, setFaqs] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/faq-accordion?type=random&limit=${limit}`)
        if (cancelled) return
        if (!res.ok) {
          setFaqs([])
          return
        }
        const data: { faqs: Faq[] } = await res.json()
        setFaqs(data.faqs)
        setViewCounts(Object.fromEntries(data.faqs.map((f) => [f.id, f.views])))
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

  async function onToggle(id: number) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next !== null) {
      try {
        const res = await fetch('/api/faq-accordion', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'view', id }),
        })
        if (res.ok) {
          const d: { views: number } = await res.json()
          setViewCounts((prev) => ({ ...prev, [id]: d.views }))
        }
      } catch {
        // ignore — widget keeps working without the count update
      }
    }
  }

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
          <Accordion>
            {faqs.map((faq) => {
              const expanded = faq.id === expandedId
              const views = viewCounts[faq.id] ?? faq.views
              return (
                <AccordionItem
                  key={faq.id}
                  id={`faq-widget-item-${faq.id}`}
                  expanded={expanded}
                  onToggle={() => onToggle(faq.id)}
                  trigger={
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-sm">{faq.question}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Eye className="h-3 w-3" /> {views}
                      </span>
                    </div>
                  }
                >
                  <div
                    className="prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(faq.answer) }}
                  />
                </AccordionItem>
              )
            })}
          </Accordion>
        )}

        <div className="pt-1">
          <Link
            href="/faq-accordion"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t('widget.viewAll')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
