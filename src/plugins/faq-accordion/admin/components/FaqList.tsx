"use client"

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, GripVertical, Eye, Search } from 'lucide-react'
import { FaqDialog } from './FaqDialog'
import { stripHtml } from '@/plugins/faq-accordion/lib/sanitize'

interface Category { id: number; name: string; slug: string }

interface Faq {
  id: number
  question: string
  answer: string
  categoryId: number
  category: Category
  sortOrder: number
  views: number
  published: boolean
}

function Row({ faq, onEdit, onDelete }: { faq: Faq; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations('faqAccordion.admin')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: faq.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <Card ref={setNodeRef} style={style} className="p-3 flex items-center gap-3">
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={t('reorder')}
        className="cursor-grab active:cursor-grabbing text-muted-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{faq.question}</div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Badge variant="outline">{faq.category.name}</Badge>
          <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {faq.views}</span>
          {!faq.published && <Badge variant="secondary">{t('draft')}</Badge>}
        </div>
      </div>
      <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t('editFaq')}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete} aria-label={t('delete')}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  )
}

export function FaqList({
  faqs,
  categories,
  onChanged,
}: {
  faqs: Faq[]
  categories: Category[]
  onChanged: () => void
}) {
  const t = useTranslations('faqAccordion.admin')
  const [selectedCat, setSelectedCat] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Faq | null>(null)
  const [creating, setCreating] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const filtered = useMemo(() => {
    let list = faqs
    if (selectedCat !== 'all') list = list.filter((f) => f.categoryId.toString() === selectedCat)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((f) => f.question.toLowerCase().includes(q) || stripHtml(f.answer).toLowerCase().includes(q))
    }
    return list
  }, [faqs, selectedCat, search])

  const [orderOverride, setOrderOverride] = useState<Faq[] | null>(null)
  const display = orderOverride ?? filtered

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = display.findIndex((i) => i.id === active.id)
    const newIdx = display.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(display, oldIdx, newIdx)
    setOrderOverride(reordered)
    const payload = reordered.map((f, i) => ({ id: f.id, sortOrder: i }))
    const res = await fetch('/api/admin/faq-accordion', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder-faqs', items: payload }),
    })
    if (!res.ok) {
      alert(t('reorderFailed'))
      setOrderOverride(null)
    } else {
      onChanged()
      setOrderOverride(null)
    }
  }

  async function handleDelete(faq: Faq) {
    if (!confirm(t('confirmDeleteFaq'))) return
    const res = await fetch(`/api/admin/faq-accordion?type=faq&id=${faq.id}`, { method: 'DELETE' })
    if (res.ok || res.status === 204) onChanged()
    else alert('Delete failed')
  }

  const canCreate = categories.length > 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedCat} onValueChange={setSelectedCat}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allCategories')}</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchFaqs')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="ml-auto">
          <Button onClick={() => setCreating(true)} disabled={!canCreate}>
            <Plus className="h-4 w-4 mr-1" /> {t('addFaq')}
          </Button>
        </div>
      </div>

      {!canCreate && (
        <div className="text-center text-muted-foreground py-8">{t('emptyCategories')}</div>
      )}
      {canCreate && display.length === 0 && (
        <div className="text-center text-muted-foreground py-8">{t('emptyFaqs')}</div>
      )}

      {display.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={display.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {display.map((faq) => (
                <Row key={faq.id} faq={faq} onEdit={() => setEditing(faq)} onDelete={() => handleDelete(faq)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <FaqDialog
        open={creating || editing !== null}
        initial={editing}
        categories={categories}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSaved={onChanged}
      />
    </div>
  )
}
