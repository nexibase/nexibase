"use client"

import { useEffect, useState } from 'react'
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
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { CategoryDialog } from './CategoryDialog'

interface Category {
  id: number
  name: string
  slug: string
  sortOrder: number
  _count: { faqs: number }
}

function Row({ cat, onEdit, onDelete }: { cat: Category; onEdit: () => void; onDelete: () => void }) {
  const t = useTranslations('faqAccordion.admin')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: cat.id })
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
      <div className="flex-1">
        <div className="font-medium">{cat.name}</div>
        <div className="text-xs text-muted-foreground">/{cat.slug}</div>
      </div>
      <Badge variant="secondary">{cat._count.faqs}</Badge>
      <Button size="sm" variant="ghost" onClick={onEdit} aria-label={t('editCategory')}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={onDelete} aria-label={t('delete')}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  )
}

export function CategoryList({ categories, onChanged }: { categories: Category[]; onChanged: () => void }) {
  const t = useTranslations('faqAccordion.admin')
  const [items, setItems] = useState(categories)
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)

  // Sync props into state when parent refetches
  useEffect(() => { setItems(categories) }, [categories])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  async function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered) // optimistic
    const payload = reordered.map((c, i) => ({ id: c.id, sortOrder: i }))
    const res = await fetch('/api/admin/faq-accordion', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'reorder-categories', items: payload }),
    })
    if (!res.ok) {
      alert(t('reorderFailed'))
      setItems(items) // revert
    } else {
      onChanged()
    }
  }

  async function handleDelete(cat: Category) {
    if (!confirm(t('confirmDeleteCategory'))) return
    const url = `/api/admin/faq-accordion?type=category&id=${cat.id}`
    let res = await fetch(url, { method: 'DELETE' })
    if (res.status === 400) {
      const d = await res.json().catch(() => ({}))
      if (d.error === 'has_faqs') {
        if (!confirm(t('categoryHasFaqs', { count: d.faqCount }))) return
        res = await fetch(url + '&force=true', { method: 'DELETE' })
      }
    }
    if (res.ok || res.status === 204) {
      onChanged()
    } else {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Delete failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4 mr-1" /> {t('addCategory')}</Button>
      </div>
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">{t('emptyCategories')}</div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {items.map((cat) => (
                <Row key={cat.id} cat={cat} onEdit={() => setEditing(cat)} onDelete={() => handleDelete(cat)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      <CategoryDialog
        open={creating || editing !== null}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null) }}
        onSaved={onChanged}
      />
    </div>
  )
}
