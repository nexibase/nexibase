"use client"

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Check, Link as LinkIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { faqHash, faqSharePath } from '../lib/share'

export function FaqShareLink({ faqId }: { faqId: number }) {
  const t = useTranslations('faqs')
  const [url, setUrl] = useState(faqSharePath(faqId))
  const [copied, setCopied] = useState(false)
  const [manual, setManual] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const path = window.location.pathname.endsWith('/faqs') ? window.location.pathname : '/faqs'
    setUrl(`${window.location.origin}${path}${faqHash(faqId)}`)
  }, [faqId])
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setManual(false)
    } catch {
      setManual(true)
      input.current?.focus()
      input.current?.select()
    }
  }
  return (
    <div className="mb-4 space-y-2 rounded-md bg-muted/40 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><LinkIcon className="h-3.5 w-3.5" />{t('shareQuestion')}</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input ref={input} readOnly value={url} aria-label={t('shareAddress')} className="h-8 text-xs" onClick={event => event.currentTarget.select()} />
        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={copy}>
          {copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}{t(copied ? 'copied' : 'copyAddress')}
        </Button>
      </div>
      <span role="status" className={manual ? 'text-xs text-muted-foreground' : 'sr-only'}>{manual ? t('copyManual') : copied ? t('copied') : ''}</span>
    </div>
  )
}
