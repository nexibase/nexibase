'use client'

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

  const { provider, id } = parseVideoUrl(url)
  if (!provider || !id) return null

  const embedUrl = buildEmbedUrl(provider, id, { autoplay, muted, loop })

  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-muted"
      style={{ aspectRatio: ASPECT_RATIO[aspectRatio] ?? '16 / 9' }}
    >
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center animate-pulse"
      >
        <svg className="h-12 w-12 text-muted-foreground/40" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <iframe
        src={embedUrl}
        width="100%"
        height="100%"
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}
