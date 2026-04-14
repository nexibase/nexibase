"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { X, ZoomIn, ZoomOut } from "lucide-react"

export function ImageLightbox() {
  const t = useTranslations('image')
  const [src, setSrc] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const backdropRef = useRef<HTMLDivElement>(null)

  const open = useCallback((imgSrc: string) => {
    setSrc(imgSrc)
    setScale(1)
  }, [])

  const close = useCallback(() => {
    setSrc(null)
    setScale(1)
  }, [])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' && target.closest('.prose')) {
        const img = target as HTMLImageElement
        if (img.naturalWidth > 600) {
          e.preventDefault()
          open(img.src)
        }
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    if (src) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [src, close])

  if (!src) return null

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-label={t('viewer')}
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) close() }}
    >
      <img
        src={src}
        alt={t('viewer')}
        className="max-h-[90vh] max-w-[90vw] object-contain transition-transform duration-200"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[51]">
        <button aria-label={t('zoomIn')} title={t('zoomIn')} onClick={() => setScale(s => Math.min(s + 0.25, 3))} className="p-2.5 rounded-full bg-black/70 text-white hover:bg-black/90 backdrop-blur">
          <ZoomIn className="h-5 w-5" />
        </button>
        <button aria-label={t('zoomOut')} title={t('zoomOut')} onClick={() => setScale(s => Math.max(s - 0.25, 0.5))} className="p-2.5 rounded-full bg-black/70 text-white hover:bg-black/90 backdrop-blur">
          <ZoomOut className="h-5 w-5" />
        </button>
        <button aria-label={t('close')} title={t('close')} onClick={close} className="p-2.5 rounded-full bg-black/70 text-white hover:bg-black/90 backdrop-blur">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
