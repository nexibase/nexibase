"use client"

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

interface Category {
  id: number
  name: string
  slug: string
}

interface Props {
  open: boolean
  initial: Category | null
  onClose: () => void
  onSaved: () => void
}

export function CategoryDialog({ open, initial, onClose, onSaved }: Props) {
  const t = useTranslations('faqAccordion.admin')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? '')
      setSlug(initial?.slug ?? '')
    }
  }, [open, initial])

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const isEdit = !!initial
      const res = await fetch('/api/admin/faq-accordion', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'category',
          id: initial?.id,
          name: name.trim(),
          slug: slug.trim() || undefined,
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? t('editCategory') : t('addCategory')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="category-name">{t('categoryName')}</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="category-slug">{t('categorySlug')}</Label>
            <Input
              id="category-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              maxLength={100}
              placeholder="auto"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>{t('save')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
