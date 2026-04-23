"use client"

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MiniEditor } from '@/components/editors/MiniEditor'
import { stripHtml } from '@/plugins/faq-accordion/lib/sanitize'

interface Category { id: number; name: string }
interface Faq {
  id: number
  question: string
  answer: string
  categoryId: number
  published: boolean
}

interface Props {
  open: boolean
  initial: Faq | null
  categories: Category[]
  onClose: () => void
  onSaved: () => void
}

export function FaqDialog({ open, initial, categories, onClose, onSaved }: Props) {
  const t = useTranslations('faqAccordion.admin')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [published, setPublished] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setQuestion(initial?.question ?? '')
      setAnswer(initial?.answer ?? '')
      setCategoryId(initial?.categoryId ?? categories[0]?.id ?? null)
      setPublished(initial?.published ?? true)
    }
  }, [open, initial, categories])

  async function handleSave() {
    if (!question.trim() || !stripHtml(answer) || !categoryId) return
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
      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? t('editFaq') : t('addFaq')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>{t('question')}</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
          </div>
          <div>
            <Label>{t('answer')}</Label>
            <MiniEditor content={answer} onChange={setAnswer} />
          </div>
          <div>
            <Label>{t('category')}</Label>
            <Select
              value={categoryId?.toString() ?? ''}
              onValueChange={(v) => setCategoryId(parseInt(v, 10))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={published} onCheckedChange={setPublished} id="published" />
            <Label htmlFor="published">{published ? t('published') : t('draft')}</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{t('save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
