"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { ExternalLink, Eye, Globe, MessageSquare } from 'lucide-react'
import type { ShowcasePreview } from '@/lib/showcase-preview'

export interface ShowcasePost extends ShowcasePreview {
  id: string | number
  title: string
  viewCount: number
  commentCount: number
  author: { nickname: string | null }
}

export default function ShowcaseCard({ post, onOpen }: { post: ShowcasePost; onOpen?: React.MouseEventHandler<HTMLAnchorElement> }) {
  const t = useTranslations('boards.showcase')
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const domain = post.siteUrl ? new URL(post.siteUrl).hostname.replace(/^www\./, '') : null
  return (
    <article className="group min-w-0 overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <Link href={`/boards/showcase/${post.id}`} onClick={onOpen} className="block rounded-t-xl focus-visible:outline-2 focus-visible:outline-primary">
        <div className="relative aspect-video overflow-hidden border-b bg-muted">
          {post.thumbnail && failedImage !== post.thumbnail ? (
            <img src={post.thumbnail} alt={t('screenshot', { title: post.title })}
              loading="lazy" decoding="async" referrerPolicy="no-referrer"
              onError={() => setFailedImage(post.thumbnail)}
              className="h-full w-full object-cover object-top transition-transform duration-200 motion-safe:group-hover:scale-[1.02]" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-primary/10 to-muted text-muted-foreground">
              <Globe className="h-9 w-9 text-primary/50" aria-hidden="true" />
              <span className="max-w-full truncate px-4 text-xs">{domain || t('madeWith')}</span>
            </div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <h3 className="line-clamp-2 break-words text-base font-semibold leading-snug group-hover:text-primary">{post.title}</h3>
          <p className="line-clamp-2 min-h-10 break-words text-sm leading-5 text-muted-foreground">{post.excerpt || t('readStory')}</p>
        </div>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-4 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{post.author.nickname || t('member')}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1" aria-label={t('views', { count: post.viewCount })}><Eye className="h-3.5 w-3.5" aria-hidden="true" />{post.viewCount}</span>
          {post.commentCount > 0 && <span className="flex items-center gap-1" aria-label={t('comments', { count: post.commentCount })}><MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />{post.commentCount}</span>}
        </div>
        {post.siteUrl && <a href={post.siteUrl} target="_blank" rel="noopener noreferrer nofollow ugc"
          className="flex w-full items-center gap-1.5 border-t pt-3 text-primary hover:underline">
          <span className="min-w-0 truncate">{t('visit')} · {domain}</span><ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>}
      </div>
    </article>
  )
}
