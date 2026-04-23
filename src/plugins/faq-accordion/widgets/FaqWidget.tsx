"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { Accordion, AccordionItem } from '@/plugins/faq-accordion/routes/components/Accordion'
import { sanitizeHtml } from '@/plugins/faq-accordion/lib/sanitize'

interface Faq {
  id: number
  question: string
  answer: string
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

  function onToggle(id: number) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next !== null) {
      // Fire-and-forget view tracking; widget doesn't display the count.
      fetch('/api/faq-accordion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'view', id }),
      }).catch(() => {})
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
              return (
                <AccordionItem
                  key={faq.id}
                  id={`faq-widget-item-${faq.id}`}
                  expanded={expanded}
                  onToggle={() => onToggle(faq.id)}
                  trigger={<span className="font-medium text-sm">{faq.question}</span>}
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
