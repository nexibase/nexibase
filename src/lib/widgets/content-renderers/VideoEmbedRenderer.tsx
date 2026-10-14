'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'

function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo' | null; id: string } {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return { provider: 'youtube', id: ytMatch[1] }
  const vmMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vmMatch) return { provider: 'vimeo', id: vmMatch[1] }
  return { provider: null, id: '' }
}

const ASPECT_RATIO: Record<string, string> = { '16:9': '16 / 9', '4:3': '4 / 3' }

function buildEmbedUrl(
  provider: 'youtube' | 'vimeo',
  id: string,
  opts: { autoplay: boolean; muted: boolean; loop: boolean },
): string {
  const params: string[] = []
  if (provider === 'youtube') {
    if (opts.autoplay) params.push('autoplay=1')
    if (opts.muted) params.push('mute=1')
    if (opts.loop) params.push('loop=1', `playlist=${id}`)
    const query = params.length ? `?${params.join('&')}` : ''
    return `https://www.youtube.com/embed/${id}${query}`
  }
  if (opts.autoplay) params.push('autoplay=1')
  if (opts.muted) params.push('muted=1')
  if (opts.loop) params.push('loop=1')
  const query = params.length ? `?${params.join('&')}` : ''
  return `https://player.vimeo.com/video/${id}${query}`
}

export default function VideoEmbedRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const url = (settings?.url as string) ?? ''
  const aspectRatio = (settings?.aspectRatio as string) ?? '16:9'
  const autoplay = (settings?.autoplay as boolean) ?? false
  // Browsers block unmuted autoplay — force muted whenever autoplay is on
  const muted = autoplay || ((settings?.muted as boolean) ?? false)
  const loop = (settings?.loop as boolean) ?? false

  const [started, setStarted] = useState(false)
  const locale = useLocale()
  const playLabel = locale === 'ko' ? '동영상 재생' : 'Play video'

  const { provider, id } = parseVideoUrl(url)
  if (!provider || !id) return null

  const embedUrl = buildEmbedUrl(provider, id, { autoplay: autoplay || started, muted, loop })

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-muted"
      style={{ aspectRatio: ASPECT_RATIO[aspectRatio] ?? '16 / 9' }}
    >
      {autoplay || started ? (
      <iframe
        title={(settings?.title as string) || playLabel}
        src={embedUrl}
        width="100%"
        height="100%"
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      ) : (
        <button
          type="button"
          aria-label={playLabel}
          onClick={() => setStarted(true)}
          className="absolute inset-0 flex h-full w-full items-center justify-center bg-black text-white focus-visible:outline-4 focus-visible:outline-primary"
        >
          {provider === 'youtube' && (
            <img
              src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
              alt=""
              width={480}
              height={360}
              loading={settings?.priority ? 'eager' : 'lazy'}
              fetchPriority={settings?.priority ? 'high' : 'auto'}
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <span className="relative flex h-14 w-20 items-center justify-center rounded-xl bg-black/80">
            <svg aria-hidden="true" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="absolute bottom-2 rounded bg-black/80 px-3 py-1 text-sm">{playLabel}</span>
        </button>
      )}
    </div>
  )
}
