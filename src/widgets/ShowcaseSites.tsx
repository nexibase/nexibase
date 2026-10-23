"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ArrowRight, Plus } from 'lucide-react'
import ShowcaseCard, { type ShowcasePost } from '@/features/boards/components/ShowcaseCard'

interface ShowcaseData { available: boolean; posts: ShowcasePost[] }
interface Settings { limit?: number; initialShowcase?: ShowcaseData }

export default function ShowcaseSites({ settings }: { settings?: Settings }) {
  const t = useTranslations('boards.showcase')
  const [data, setData] = useState<ShowcaseData | null>(settings?.initialShowcase ?? null)
  const [failed, setFailed] = useState(false)
  const limit = Math.min(6, Math.max(1, Math.floor(Number(settings?.limit)) || 6))
  useEffect(() => {
    if (settings?.initialShowcase) { setData(settings.initialShowcase); return }
    const controller = new AbortController()
    fetch('/api/showcase', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Showcase unavailable')
      setData(await response.json())
    }).catch(error => { if (error.name !== 'AbortError') setFailed(true) })
    return () => controller.abort()
  }, [settings?.initialShowcase])
  if (data && !data.available) return null
  return (
    <section aria-labelledby="showcase-sites-title" className="rounded-xl border bg-card p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-primary">{t('label')}</p>
          <h2 id="showcase-sites-title" className="text-xl font-bold">{t('heading')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('intro')}</p>
        </div>
        <Link href="/boards/showcase" className="inline-flex shrink-0 items-center gap-1 py-1 text-sm text-primary hover:underline">{t('all')}<ArrowRight className="h-4 w-4" /></Link>
      </div>
      {!data ? <p className="py-6 text-sm text-muted-foreground" role="status">{failed ? t('unavailable') : t('loading')}</p>
        : data.posts.length > 0 ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.posts.slice(0, limit).map(post => <ShowcaseCard key={post.id} post={post} />)}</div>
        : <p className="rounded-lg bg-muted/50 px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-sm text-muted-foreground">{t('invite')}</p>
        <Link href="/boards/showcase/create" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted"><Plus className="h-4 w-4" />{t('submit')}</Link>
      </div>
    </section>
  )
}
