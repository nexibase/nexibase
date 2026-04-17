'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

export default function ImageBannerRenderer({ settings }: { settings?: Record<string, unknown> }) {
  const src = (settings?.src as string) ?? ''
  const alt = (settings?.alt as string) ?? ''
  const href = (settings?.href as string) ?? ''
  const height = (settings?.height as number) ?? 300
  const [loaded, setLoaded] = useState(false)

  if (!src) return null

  const img = (
    <div className="relative w-full overflow-hidden rounded-lg bg-muted" style={{ height }}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted/60" aria-hidden />}
      <Image
        src={src}
        alt={alt}
        fill
        className={`object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        sizes="100vw"
        onLoad={() => setLoaded(true)}
      />
    </div>
  )
  if (href) return <Link href={href}>{img}</Link>
  return img
}
