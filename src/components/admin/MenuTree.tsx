"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter,
  useSensor, useSensors, type KeyboardCoordinateGetter,
} from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Pencil, Eye, EyeOff, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MENU_INDENT, menuDragRows, moveMenuTree, projectMenuMove, type MenuItem, type MenuRow } from "@/lib/menus/tree"

const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
    return { ...args.currentCoordinates, x: args.currentCoordinates.x + (event.code === 'ArrowRight' ? MENU_INDENT : -MENU_INDENT) }
  }
  const next = sortableKeyboardCoordinates(event, args)
  return next ? { ...next, x: args.currentCoordinates.x } : undefined
}

interface Props {
  menus: MenuItem[]
  disabled: boolean
  dragDisabled?: boolean
  onReorder: (menus: MenuItem[]) => Promise<void>
  onEdit: (menu: MenuItem) => void
  onToggle: (menu: MenuItem) => void
  onDelete: (id: number) => void
}

function Row({ menu, depth, projectedDepth, disabled, dragDisabled, onEdit, onToggle, onDelete }: MenuRow & {
  projectedDepth?: number
  disabled: boolean
  dragDisabled: boolean
  onEdit: Props['onEdit']
  onToggle: Props['onToggle']
  onDelete: Props['onDelete']
}) {
  const t = useTranslations('admin')
  const pluginDisabled = !!menu.pluginFolder && !menu.pluginEnabled
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: menu.id, disabled: { draggable: disabled || dragDisabled || pluginDisabled, droppable: false },
  })
  return (
    <li
      ref={setNodeRef}
      data-menu-id={menu.id}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : pluginDisabled ? 0.5 : 1,
        paddingLeft: 12 + (projectedDepth ?? depth) * MENU_INDENT }}
      className={`flex items-center gap-2 pr-3 py-2 border-b ${pluginDisabled ? 'opacity-50 bg-muted/30' : 'hover:bg-muted/50'} ${isDragging ? 'bg-primary/10' : ''}`}
    >
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
        disabled={disabled || dragDisabled || pluginDisabled} aria-label={t('menuReorder', { label: menu.label })}
        className="touch-none shrink-0 rounded p-1 text-muted-foreground cursor-grab active:cursor-grabbing disabled:cursor-default disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {menu.icon && <span className="text-sm">{menu.icon}</span>}
          <span className="text-sm font-medium truncate">{menu.label}</span>
          <span className="text-xs text-muted-foreground truncate">{menu.url}</span>
          {menu.groupName && <Badge variant="outline" className="text-xs">{menu.groupName}</Badge>}
          {!!menu.children?.length && <Badge variant="outline" className="text-xs">{t('menuChildCount', { count: menu.children.length })}</Badge>}
          {pluginDisabled && <Badge variant="destructive" className="text-xs">{t('pluginDisabled', { name: menu.pluginName ?? '' })}</Badge>}
          {!menu.isActive && !pluginDisabled && <Badge variant="secondary" className="text-xs">{t('inactive')}</Badge>}
          {menu.visibility !== 'all' && <Badge variant="secondary" className="text-xs">{menu.visibility === 'member' ? t('memberOnly') : t('roleAdmin')}</Badge>}
          {menu.target === '_blank' && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
        </div>
      </div>
      {!pluginDisabled && <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={disabled} onClick={() => onEdit(menu)} aria-label={t('editMenu')}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={disabled} onClick={() => onToggle(menu)} title={menu.isActive ? t('hide') : t('show')}>
          {menu.isActive ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" disabled={disabled} onClick={() => onDelete(menu.id)} aria-label={t('menuDelete', { label: menu.label })}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>}
    </li>
  )
}

export function MenuTree({ menus, disabled, dragDisabled = false, onReorder, onEdit, onToggle, onDelete }: Props) {
  const t = useTranslations('admin')
  const [activeId, setActiveId] = useState<number | null>(null)
  const [overId, setOverId] = useState<number | null>(null)
  const [offsetX, setOffsetX] = useState(0)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  )
  const rows = useMemo(() => menuDragRows(menus, activeId), [menus, activeId])
  const active = rows.find(row => row.menu.id === activeId)?.menu
  const projection = activeId !== null && overId !== null ? projectMenuMove(rows, activeId, overId, offsetX) : null
  const reset = () => { setActiveId(null); setOverId(null); setOffsetX(0) }
  return (
    <DndContext id="admin-menu-tree" sensors={sensors} collisionDetection={closestCenter}
      accessibility={{ screenReaderInstructions: { draggable: t('menuDragKeyboard') } }}
      onDragStart={({ active }) => { setActiveId(Number(active.id)); setOverId(Number(active.id)); setOffsetX(0) }}
      onDragMove={({ delta }) => setOffsetX(delta.x)}
      onDragOver={({ over }) => setOverId(over ? Number(over.id) : null)}
      onDragCancel={reset}
      onDragEnd={({ active, over, delta }) => {
        const next = over ? moveMenuTree(menus, Number(active.id), Number(over.id), delta.x) : null
        reset()
        if (next) void onReorder(next)
      }}>
      <SortableContext items={rows.map(row => row.menu.id)} strategy={verticalListSortingStrategy}>
        <ul aria-label={t('menusTitle')}>
          {rows.map(row => <Row key={row.menu.id} {...row} disabled={disabled} dragDisabled={dragDisabled}
            projectedDepth={row.menu.id === activeId ? projection?.depth : undefined}
            onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />)}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {active && <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 shadow-lg text-sm">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <span>{active.label}</span>
          {!!active.children?.length && <Badge variant="outline">{t('menuChildCount', { count: active.children.length })}</Badge>}
        </div>}
      </DragOverlay>
    </DndContext>
  )
}
