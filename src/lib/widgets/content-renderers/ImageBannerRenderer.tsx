'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function ImageBannerRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const src = (settings?.src as string) ?? ''
  const alt = (settings?.alt as string) ?? ''
  const href = (settings?.href as string) ?? ''
  const height = (settings?.height as number) ?? 300

  if (!src) return null

  const img = (
    <div className="relative w-full overflow-hidden rounded-lg bg-muted" style={{ height }}>
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover"
        sizes={(settings?.sizes as string) || '(min-width: 1152px) 1120px, 100vw'}
        unoptimized={!src.startsWith('/uploads/')}
      />
    </div>
  )
  if (href) return <Link href={href}>{img}</Link>
  return img
}
