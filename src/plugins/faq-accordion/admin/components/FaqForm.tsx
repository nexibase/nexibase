"use client"

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TiptapEditor } from '@/components/editors/TiptapEditor'
import { ArrowLeft, Eye, ThumbsUp, ThumbsDown } from 'lucide-react'
import { stripHtml } from '@/plugins/faq-accordion/lib/sanitize'

interface Category { id: number; name: string }
interface Faq {
  id: number
  question: string
  answer: string
  categoryId: number
  published: boolean
}
interface Stats { views: number; helpful: number; notHelpful: number }

interface Props {
  initial: Faq | null
  categories: Category[]
  stats?: Stats
}

export function FaqForm({ initial, categories, stats }: Props) {
  const t = useTranslations('faqAccordion.admin')
  const router = useRouter()

  const [question, setQuestion] = useState(initial?.question ?? '')
  const [answer, setAnswer] = useState(initial?.answer ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(
    initial?.categoryId ?? categories[0]?.id ?? null,
  )
  const [published, setPublished] = useState(initial?.published ?? true)
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const dirtyRef = useRef(isDirty)
  dirtyRef.current = isDirty

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const canSave =
    !!question.trim() && !!stripHtml(answer) && categoryId !== null && !saving

  async function handleSave() {
    if (!canSave || categoryId === null) return
    setSaving(true)
    try {
      const isEdit = !!initial
      const res = await fetch('/api/admin/faq-accordion', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'faq',
          id: initial?.id,
          question: question.trim(),
          answer,
          categoryId,
          published,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Save failed')
        return
      }
      setIsDirty(false)
      router.push('/admin/faq-accordion')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    if (isDirty && !confirm(t('unsavedConfirm'))) return
    router.push('/admin/faq-accordion')
  }

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v)
      setIsDirty(true)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <Link
          href="/admin/faq-accordion"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
      </div>

      <h1 className="text-2xl font-bold">
        {initial ? t('editFaq') : t('addFaq')}
      </h1>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <Label htmlFor="faq-question">{t('question')}</Label>
            <Input
              id="faq-question"
              value={question}
              onChange={(e) => markDirty(setQuestion)(e.target.value)}
              maxLength={500}
            />
          </div>

          <div>
            <Label htmlFor="faq-answer">{t('answer')}</Label>
            <div id="faq-answer">
              <TiptapEditor content={answer} onChange={markDirty(setAnswer)} />
            </div>
          </div>

          <div>
            <Label htmlFor="faq-category">{t('category')}</Label>
            <Select
              value={categoryId?.toString() ?? ''}
              onValueChange={(v) => markDirty(setCategoryId)(parseInt(v, 10))}
            >
              <SelectTrigger id="faq-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="published"
              checked={published}
              onCheckedChange={markDirty(setPublished)}
            />
            <Label htmlFor="published">
              {published ? t('published') : t('draft')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {stats && (
        <Card>
          <CardContent className="p-6">
            <div className="text-sm font-medium mb-3">{t('statsTitle')}</div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {t('statsViews')}: {stats.views}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-4 w-4" />
                {t('statsHelpful')}: {stats.helpful}
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsDown className="h-4 w-4" />
                {t('statsNotHelpful')}: {stats.notHelpful}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleCancel} disabled={saving}>
          {t('cancel')}
        </Button>
        <Button onClick={handleSave} disabled={!canSave}>
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
