"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Eye, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Accordion, AccordionItem } from './Accordion'
import { trackFaqView } from '@/features/faqs/lib/view-tracking'
import { sanitizeHtml, stripHtml } from '@/features/faqs/lib/sanitize'

interface Category { id: number; name: string; slug: string; _count?: { faqs: number } }
interface Faq {
  id: number
  question: string
  answer: string
  categoryId: number
  views: number
  helpful: number
  notHelpful: number
  category: Category
}

interface Props {
  categories: Category[]
  faqs: Faq[]
  topFaqs: Faq[]
}

export function FaqAccordion({ categories, faqs, topFaqs }: Props) {
  const t = useTranslations('faqs')

  const [selectedCat, setSelectedCat] = useState<string>('all')
  const totalFaqs = categories.reduce((total, category) => total + (category._count?.faqs ?? 0), 0)
  const [rawSearch, setRawSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [viewCounts, setViewCounts] = useState<Record<number, number>>({})
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set())

  const [feedbackReady, setFeedbackReady] = useState(false)
  const [pendingVotes, setPendingVotes] = useState<Set<number>>(new Set())
  const votingIds = useRef(new Set<number>())
  const guestVoter = useRef(false)

  useEffect(() => {
    let cancelled = false
    async function loadFeedback() {
      try {
        const response = await fetch('/api/faqs?type=feedback', { cache: 'no-store' })
        if (!response.ok) return
        const data: { votes: { faqId: number; helpful: boolean }[]; guest: boolean } = await response.json()
        const ids = new Set(data.votes.map(vote => vote.faqId))
        // Keep receipts for legacy anonymous evaluations whose identity was
        // never stored in the database. Logged-in accounts use server records.
        if (data.guest) {
          try {
            for (const key of Object.keys(localStorage)) {
              if (key.startsWith('faq-voted:')) {
                const id = Number(key.slice('faq-voted:'.length))
                if (Number.isInteger(id)) ids.add(id)
              }
            }
          } catch {}
        }
        if (!cancelled) {
          guestVoter.current = data.guest
          setVotedIds(ids)
          setFeedbackReady(true)
        }
      } catch {}
    }
    void loadFeedback()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(rawSearch), 300)
    return () => clearTimeout(handle)
  }, [rawSearch])

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase()
    let list = faqs
    if (q) {
      list = list.filter((f) => f.question.toLowerCase().includes(q) || stripHtml(f.answer).toLowerCase().includes(q))
    } else if (selectedCat !== 'all') {
      list = list.filter(faq => faq.categoryId.toString() === selectedCat)
    }
    return list
  }, [faqs, debouncedSearch, selectedCat])

  const showMostViewed = selectedCat === 'all' && debouncedSearch.trim() === '' && topFaqs.length > 0

  function scrollToFaq(id: number) {
    setExpandedId(id)
    recordView(id)
    const el = document.getElementById(`faq-item-${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function recordView(id: number) {
    void trackFaqView(id).then(views => {
      if (views !== undefined) setViewCounts(current => ({ ...current, [id]: views }))
    })
  }

  function onToggle(id: number) {
    if (expandedId !== id) recordView(id)
    setExpandedId(current => current === id ? null : id)
  }

  async function vote(id: number, helpful: boolean) {
    if (!feedbackReady || votedIds.has(id) || votingIds.current.has(id)) return
    votingIds.current.add(id)
    setPendingVotes(current => new Set(current).add(id))
    try {
      const res = await fetch('/api/faqs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'feedback', id, helpful }),
      })
      if (res.ok) {
        if (guestVoter.current) {
          try { localStorage.setItem(`faq-voted:${id}`, helpful ? 'y' : 'n') } catch {}
        }
        setVotedIds((prev) => {
          const n = new Set(prev)
          n.add(id)
          return n
        })
      } else {
        alert(t('feedbackFailed'))
      }
    } catch {
      alert(t('feedbackFailed'))
    } finally {
      votingIds.current.delete(id)
      setPendingVotes(current => { const next = new Set(current); next.delete(id); return next })
    }
  }

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('search')}
          aria-label={t('search')}
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {showMostViewed && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h2 className="text-sm font-semibold mb-2">{t('mostViewed')}</h2>
          <ol className="space-y-1">
            {topFaqs.map((f, i) => (
              <li key={f.id}>
                <button
                  type="button"
                  className="text-left hover:underline text-sm flex items-center gap-2 w-full"
                  onClick={() => scrollToFaq(f.id)}
                >
                  <span className="text-muted-foreground w-4">{i + 1}.</span>
                  <span className="flex-1 truncate">{f.question}</span>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" /> {viewCounts[f.id] ?? f.views}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {debouncedSearch.trim() === '' && (
        <Tabs value={selectedCat} onValueChange={setSelectedCat}>
          <TabsList className="flex-wrap h-auto bg-transparent p-0 gap-2">
            <TabsTrigger
              value="all"
              className="rounded-full border px-3 h-8 flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              {t('all')}
              <Badge variant="secondary" className="ml-1.5">{totalFaqs}</Badge>
            </TabsTrigger>
            {categories.filter(category => (category._count?.faqs ?? 0) > 0).map(category => (
              <TabsTrigger
                key={category.id}
                value={category.id.toString()}
                className="rounded-full border px-3 h-8 flex-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-none"
              >
                {category.name}
                <Badge variant="secondary" className="ml-1.5">{category._count?.faqs ?? 0}</Badge>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {filtered.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">{t(faqs.length === 0 ? 'empty' : 'noResults')}</div>
      ) : (
        <Accordion>
          {filtered.map((faq) => {
            const expanded = faq.id === expandedId
            const voted = votedIds.has(faq.id)
            const views = viewCounts[faq.id] ?? faq.views
            return (
              <AccordionItem
                key={faq.id}
                id={`faq-item-${faq.id}`}
                expanded={expanded}
                onToggle={() => onToggle(faq.id)}
                trigger={
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{faq.question}</span>
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
                <div className="mt-4 pt-3 border-t flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {voted ? t('thanksForFeedback') : t('helpful')}
                  </span>
                  {!voted && (
                    <>
                      <Button size="sm" variant="outline" disabled={!feedbackReady || pendingVotes.has(faq.id)} onClick={() => vote(faq.id, true)}>
                        <ThumbsUp className="h-4 w-4 mr-1" /> {t('yes')}
                      </Button>
                      <Button size="sm" variant="outline" disabled={!feedbackReady || pendingVotes.has(faq.id)} onClick={() => vote(faq.id, false)}>
                        <ThumbsDown className="h-4 w-4 mr-1" /> {t('no')}
                      </Button>
                    </>
                  )}
                </div>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}
