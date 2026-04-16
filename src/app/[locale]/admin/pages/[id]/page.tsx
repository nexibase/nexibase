"use client"

import { use, useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  closestCenter,
  DragOverlay,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Sidebar } from "@/components/admin/Sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Loader2,
  ArrowLeft,
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Plus,
  ExternalLink,
  Save,
} from "lucide-react"
import { getTemplateZones, LAYOUT_TEMPLATES } from "@/lib/widgets/layout-templates"
import { CONTENT_WIDGET_TYPES } from "@/lib/widgets/content-renderers"
import { contentEditors } from "@/components/admin/widget-editors"
import { widgetMetadata } from "@/lib/widgets/_generated-metadata"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WidgetData {
  id: number
  widgetKey: string
  widgetType: string
  zone: string
  title: string
  settings: string | null
  colSpan: number
  rowSpan: number
  isActive: boolean
  sortOrder: number
}

interface PageData {
  id: number
  title: string
  slug: string
  layoutTemplate: string
  isActive: boolean
  widgets: WidgetData[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanizeKey(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getWidgetLabel(widgetKey: string): string {
  return widgetMetadata[widgetKey]?.label ?? humanizeKey(widgetKey)
}

function parseSettings(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return {}
  }
}

// ---------------------------------------------------------------------------
// SortableWidget — a single draggable widget card in the preview panel
// ---------------------------------------------------------------------------

interface SortableWidgetProps {
  widget: WidgetData
  isSelected: boolean
  onSelect: () => void
}

function SortableWidget({ widget, isSelected, onSelect }: SortableWidgetProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer text-sm transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border bg-card hover:bg-muted/50"
      } ${!widget.isActive ? "opacity-50" : ""}`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate font-medium">
        {widget.title || getWidgetLabel(widget.widgetKey)}
      </span>
      <Badge variant="outline" className="text-xs shrink-0">
        {widget.widgetType === "content" ? widget.widgetKey : getWidgetLabel(widget.widgetKey)}
      </Badge>
      {!widget.isActive && (
        <EyeOff className="h-3 w-3 text-muted-foreground shrink-0" />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ZonePanel — one droppable zone with its sortable widgets
// ---------------------------------------------------------------------------

interface ZonePanelProps {
  zone: string
  widgets: WidgetData[]
  selectedId: number | null
  onSelect: (id: number) => void
}

function ZonePanel({ zone, widgets, selectedId, onSelect }: ZonePanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `zone-${zone}` })

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {zone}
        </span>
        <span className="text-xs text-muted-foreground">({widgets.length})</span>
      </div>
      <div
        ref={setNodeRef}
        className={`min-h-[48px] rounded-md border border-dashed p-2 space-y-1 transition-colors ${
          isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30'
        }`}
      >
        {widgets.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            {isOver ? 'Drop here' : 'Empty zone'}
          </p>
        ) : (
          <SortableContext
            items={widgets.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {widgets.map((w) => (
              <SortableWidget
                key={w.id}
                widget={w}
                isSelected={selectedId === w.id}
                onSelect={() => onSelect(w.id)}
              />
            ))}
          </SortableContext>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SettingsSchemaForm — render settingsSchema keys as inputs
// ---------------------------------------------------------------------------

interface SettingsSchemaFormProps {
  schema: Record<string, unknown>
  settings: Record<string, unknown>
  onChange: (settings: Record<string, unknown>) => void
}

function SettingsSchemaForm({ schema, settings, onChange }: SettingsSchemaFormProps) {
  const keys = Object.keys(schema)
  if (keys.length === 0) return null

  return (
    <div className="space-y-3 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Widget Settings
      </p>
      {keys.map((key) => {
        const val = settings[key] ?? schema[key]
        const isNumber = typeof schema[key] === "number"
        return (
          <div key={key} className="space-y-1">
            <Label htmlFor={`schema-${key}`} className="text-sm">
              {humanizeKey(key)}
            </Label>
            <Input
              id={`schema-${key}`}
              type={isNumber ? "number" : "text"}
              value={String(val ?? "")}
              onChange={(e) => {
                const newVal = isNumber ? Number(e.target.value) : e.target.value
                onChange({ ...settings, [key]: newVal })
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddWidgetDropdown — registry widgets popup
// ---------------------------------------------------------------------------

interface AddWidgetDropdownProps {
  onAdd: (key: string) => void
  disabled: boolean
}

function AddWidgetDropdown({ onAdd, disabled }: AddWidgetDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const keys = Object.keys(widgetMetadata)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4 mr-1" />
        Widget
      </Button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {keys.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">No registry widgets</p>
          ) : (
            keys.map((key) => (
              <button
                key={key}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onAdd(key)
                  setOpen(false)
                }}
              >
                <span className="font-medium">{widgetMetadata[key]?.label ?? humanizeKey(key)}</span>
                {widgetMetadata[key]?.description && (
                  <span className="block text-xs text-muted-foreground truncate">
                    {widgetMetadata[key].description}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AddContentDropdown — content widget types popup
// ---------------------------------------------------------------------------

interface AddContentDropdownProps {
  onAdd: (key: string) => void
  disabled: boolean
}

function AddContentDropdown({ onAdd, disabled }: AddContentDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <Plus className="h-4 w-4 mr-1" />
        Content
      </Button>
      {open && (
        <div className="absolute bottom-full mb-1 left-0 z-50 w-64 rounded-md border bg-popover shadow-md">
          {CONTENT_WIDGET_TYPES.map((type) => (
            <button
              key={type.key}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
              onClick={() => {
                onAdd(type.key)
                setOpen(false)
              }}
            >
              <span className="font-medium">{type.label}</span>
              <span className="block text-xs text-muted-foreground">{type.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function PageEditor({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: rawId } = use(params)
  const pageId = Number(rawId)
  const router = useRouter()

  // Core state
  const [page, setPage] = useState<PageData | null>(null)
  const [widgets, setWidgets] = useState<WidgetData[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Drag state
  const [activeWidget, setActiveWidget] = useState<WidgetData | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ---------------------------------------------------------------------------
  // Load page
  // ---------------------------------------------------------------------------

  const loadPage = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/pages/${pageId}`)
      if (!res.ok) throw new Error("Failed to load page")
      const data = (await res.json()) as { page: PageData }
      setPage(data.page)
      setWidgets(data.page.widgets)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [pageId])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  // ---------------------------------------------------------------------------
  // Derived: grouped by zone
  // ---------------------------------------------------------------------------

  const zones = page ? getTemplateZones(page.layoutTemplate) : []

  const widgetsByZone = (zone: string): WidgetData[] =>
    widgets.filter((w) => w.zone === zone).sort((a, b) => a.sortOrder - b.sortOrder)

  const selectedWidget = widgets.find((w) => w.id === selectedId) ?? null

  // ---------------------------------------------------------------------------
  // Widget mutation helpers
  // ---------------------------------------------------------------------------

  function markDirty() {
    setDirty(true)
    setSaveError(null)
  }

  function updateWidget(id: number, patch: Partial<WidgetData>) {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
    markDirty()
  }

  function updateSelectedSettings(settings: Record<string, unknown>) {
    if (!selectedId) return
    updateWidget(selectedId, { settings: JSON.stringify(settings) })
  }

  // ---------------------------------------------------------------------------
  // Drag and drop
  // ---------------------------------------------------------------------------

  function handleDragStart(event: DragStartEvent) {
    const w = widgets.find((x) => x.id === event.active.id)
    setActiveWidget(w ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveWidget(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const activeWidget = widgets.find((w) => w.id === active.id)
    if (!activeWidget) return

    // Check if dropped over a zone header (zone-<name>) or another widget
    const overId = String(over.id)
    const overZone = overId.startsWith("zone-") ? overId.replace("zone-", "") : null
    const overWidget = widgets.find((w) => w.id === over.id)

    const targetZone = overZone ?? overWidget?.zone ?? activeWidget.zone

    if (targetZone !== activeWidget.zone) {
      // Zone-to-zone transfer: move widget to new zone at the end
      setWidgets((prev) => {
        const zoneWidgets = prev
          .filter((w) => w.zone === targetZone)
          .sort((a, b) => a.sortOrder - b.sortOrder)
        const newSortOrder = zoneWidgets.length > 0 ? zoneWidgets[zoneWidgets.length - 1].sortOrder + 1 : 0

        return prev.map((w) =>
          w.id === activeWidget.id ? { ...w, zone: targetZone, sortOrder: newSortOrder } : w
        )
      })
      markDirty()
    } else {
      // Same zone reorder
      const zoneWidgets = widgetsByZone(activeWidget.zone)
      const oldIndex = zoneWidgets.findIndex((w) => w.id === active.id)
      const newIndex = zoneWidgets.findIndex((w) => w.id === over.id)
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

      const reordered = arrayMove(zoneWidgets, oldIndex, newIndex)
      const updated = reordered.map((w, i) => ({ ...w, sortOrder: i }))

      setWidgets((prev) => {
        const otherZones = prev.filter((w) => w.zone !== activeWidget.zone)
        return [...otherZones, ...updated]
      })
      markDirty()
    }
  }

  // ---------------------------------------------------------------------------
  // Add widget (registry)
  // ---------------------------------------------------------------------------

  async function handleAddRegistryWidget(key: string) {
    if (!page) return
    const firstZone = zones[0] ?? "main"
    const meta = widgetMetadata[key]
    const title = meta?.label ?? humanizeKey(key)

    try {
      const res = await fetch(`/api/admin/pages/${pageId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey: key,
          widgetType: "registry",
          zone: firstZone,
          title,
          settings: meta?.settingsSchema ? JSON.stringify(meta.settingsSchema) : null,
        }),
      })
      if (!res.ok) throw new Error("Failed to add widget")
      const data = (await res.json()) as { widget: WidgetData }
      setWidgets((prev) => [...prev, data.widget])
      setSelectedId(data.widget.id)
      markDirty()
    } catch (err) {
      console.error(err)
      alert("Failed to add widget.")
    }
  }

  // ---------------------------------------------------------------------------
  // Add widget (content)
  // ---------------------------------------------------------------------------

  async function handleAddContentWidget(key: string) {
    if (!page) return
    const firstZone = zones[0] ?? "main"
    const typeInfo = CONTENT_WIDGET_TYPES.find((t) => t.key === key)
    const title = typeInfo?.label ?? humanizeKey(key)

    const defaultSettings: Record<string, unknown> =
      key === "spacer" ? { height: 40 } : key === "video-embed" ? { aspectRatio: "16:9" } : {}

    try {
      const res = await fetch(`/api/admin/pages/${pageId}/widgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey: key,
          widgetType: "content",
          zone: firstZone,
          title,
          settings: JSON.stringify(defaultSettings),
        }),
      })
      if (!res.ok) throw new Error("Failed to add content widget")
      const data = (await res.json()) as { widget: WidgetData }
      setWidgets((prev) => [...prev, data.widget])
      setSelectedId(data.widget.id)
      markDirty()
    } catch (err) {
      console.error(err)
      alert("Failed to add content widget.")
    }
  }

  // ---------------------------------------------------------------------------
  // Remove widget (immediate API call)
  // ---------------------------------------------------------------------------

  async function handleRemoveWidget(id: number) {
    if (!confirm("Remove this widget? This cannot be undone.")) return
    try {
      const res = await fetch(`/api/admin/pages/${pageId}/widgets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      setWidgets((prev) => prev.filter((w) => w.id !== id))
      if (selectedId === id) setSelectedId(null)
      markDirty()
    } catch (err) {
      console.error(err)
      alert("Failed to remove widget.")
    }
  }

  // ---------------------------------------------------------------------------
  // Duplicate widget (local state only, not persisted until save)
  // ---------------------------------------------------------------------------

  function handleDuplicateWidget(widget: WidgetData) {
    const zoneWidgets = widgetsByZone(widget.zone)
    const maxSort = zoneWidgets.reduce((max, w) => Math.max(max, w.sortOrder), 0)
    // Use a negative temp id to distinguish from real ids
    const tempId = -(Date.now())
    const clone: WidgetData = {
      ...widget,
      id: tempId,
      title: `${widget.title} (copy)`,
      sortOrder: maxSort + 1,
    }
    setWidgets((prev) => [...prev, clone])
    setSelectedId(tempId)
    markDirty()
  }

  // ---------------------------------------------------------------------------
  // Save layout
  // ---------------------------------------------------------------------------

  async function handleSaveLayout() {
    setSaving(true)
    setSaveError(null)
    try {
      // Filter out temp (negative) ids — they have not been created yet, persist first
      const tempWidgets = widgets.filter((w) => w.id < 0)
      const realWidgets = widgets.filter((w) => w.id > 0)

      // Create temp widgets via API
      const created: WidgetData[] = []
      for (const tw of tempWidgets) {
        const res = await fetch(`/api/admin/pages/${pageId}/widgets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            widgetKey: tw.widgetKey,
            widgetType: tw.widgetType,
            zone: tw.zone,
            title: tw.title,
            settings: tw.settings,
          }),
        })
        if (!res.ok) throw new Error("Failed to create duplicated widget")
        const data = (await res.json()) as { widget: WidgetData }
        created.push({ ...tw, id: data.widget.id })
      }

      const allWidgets = [
        ...realWidgets,
        ...created,
      ]

      const items = allWidgets.map((w) => ({
        id: w.id,
        zone: w.zone,
        sortOrder: w.sortOrder,
        colSpan: w.colSpan,
        rowSpan: w.rowSpan,
        isActive: w.isActive,
        title: w.title,
        settings: w.settings,
      }))

      const res = await fetch(`/api/admin/pages/${pageId}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) throw new Error("Failed to save layout")

      // Update local state: replace temp ids with real ones
      setWidgets(allWidgets)
      setDirty(false)
    } catch (err) {
      console.error(err)
      setSaveError("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Settings panel content
  // ---------------------------------------------------------------------------

  function renderSettingsPanel() {
    if (!selectedWidget) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6">
          <p className="text-muted-foreground text-sm">
            Select a widget to edit its settings.
          </p>
        </div>
      )
    }

    const settings = parseSettings(selectedWidget.settings)
    const schema = widgetMetadata[selectedWidget.widgetKey]?.settingsSchema ?? null
    const EditorComponent = contentEditors[selectedWidget.widgetKey] ?? null

    return (
      <div className="p-4 space-y-4">
        {/* Widget identity */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
            {selectedWidget.widgetType === "content" ? "Content Widget" : "Registry Widget"}
          </p>
          <p className="text-sm font-medium">
            {getWidgetLabel(selectedWidget.widgetKey)}
          </p>
        </div>

        {/* Common fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="w-title" className="text-sm">Title</Label>
            <Input
              id="w-title"
              value={selectedWidget.title}
              onChange={(e) => updateWidget(selectedWidget.id, { title: e.target.value })}
              placeholder="Widget title"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="w-zone" className="text-sm">Zone</Label>
            <Select
              value={selectedWidget.zone}
              onValueChange={(val) => updateWidget(selectedWidget.id, { zone: val })}
            >
              <SelectTrigger id="w-zone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="w-colspan" className="text-sm">Col Span</Label>
              <Input
                id="w-colspan"
                type="number"
                min={1}
                max={12}
                value={selectedWidget.colSpan}
                onChange={(e) =>
                  updateWidget(selectedWidget.id, { colSpan: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="w-rowspan" className="text-sm">Row Span</Label>
              <Input
                id="w-rowspan"
                type="number"
                min={1}
                value={selectedWidget.rowSpan}
                onChange={(e) =>
                  updateWidget(selectedWidget.id, { rowSpan: Math.max(1, Number(e.target.value)) })
                }
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="w-active"
              checked={selectedWidget.isActive}
              onCheckedChange={(val) => updateWidget(selectedWidget.id, { isActive: val })}
            />
            <Label htmlFor="w-active" className="text-sm cursor-pointer">
              Active
            </Label>
            {selectedWidget.isActive ? (
              <Eye className="h-3 w-3 text-muted-foreground" />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Content editor */}
        {selectedWidget.widgetType === "content" && EditorComponent && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Content
            </p>
            <EditorComponent
              settings={settings}
              onChange={(s) => updateSelectedSettings(s)}
            />
          </div>
        )}

        {/* Registry settings schema */}
        {selectedWidget.widgetType === "registry" && schema && (
          <SettingsSchemaForm
            schema={schema}
            settings={settings}
            onChange={(s) => updateSelectedSettings(s)}
          />
        )}

        {/* Actions */}
        <div className="border-t pt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => handleDuplicateWidget(selectedWidget)}
          >
            <Copy className="h-3 w-3 mr-1" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive hover:text-destructive"
            onClick={() => handleRemoveWidget(selectedWidget.id)}
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Remove
          </Button>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const previewUrl = page ? (page.slug === "" ? "/" : `/${page.slug}`) : "/"
  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!page) {
    return (
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">Page not found.</p>
          <Button variant="outline" onClick={() => router.push("/admin/pages")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pages
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* ---------------------------------------------------------------- */}
        {/* TOP TOOLBAR                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/admin/pages")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-bold truncate">{page.title}</span>
            <Badge variant="secondary" className="font-mono text-xs shrink-0">
              {page.slug === "" ? "/" : `/${page.slug}`}
            </Badge>
            <Select
              value={page.layoutTemplate}
              onValueChange={async (val) => {
                try {
                  const res = await fetch(`/api/admin/pages/${page.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ layoutTemplate: val }),
                  })
                  if (res.ok) {
                    setPage({ ...page, layoutTemplate: val })
                    markDirty()
                  }
                } catch {}
              }}
            >
              <SelectTrigger className="h-7 w-[140px] text-xs shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYOUT_TEMPLATES).map(([key, tmpl]) => (
                  <SelectItem key={key} value={key}>
                    {tmpl.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(previewUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Preview
            </Button>

            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={handleSaveLayout}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Layout
            </Button>
          </div>
        </div>

        {/* Save error */}
        {saveError && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b shrink-0">
            {saveError}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* MAIN AREA: split view                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: Live Preview Panel */}
          <div className="flex-1 overflow-y-auto p-4 border-r">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              {page.layoutTemplate === "with-sidebar" ? (
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-3">
                    <ZonePanel zone="left" widgets={widgetsByZone("left")} selectedId={selectedId} onSelect={setSelectedId} />
                  </div>
                  <div className="col-span-6 space-y-2">
                    <ZonePanel zone="top" widgets={widgetsByZone("top")} selectedId={selectedId} onSelect={setSelectedId} />
                    <ZonePanel zone="center" widgets={widgetsByZone("center")} selectedId={selectedId} onSelect={setSelectedId} />
                    <ZonePanel zone="bottom" widgets={widgetsByZone("bottom")} selectedId={selectedId} onSelect={setSelectedId} />
                  </div>
                  <div className="col-span-3">
                    <ZonePanel zone="right" widgets={widgetsByZone("right")} selectedId={selectedId} onSelect={setSelectedId} />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {zones.map((zone) => (
                    <ZonePanel
                      key={zone}
                      zone={zone}
                      widgets={widgetsByZone(zone)}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                    />
                  ))}
                </div>
              )}

              <DragOverlay>
                {activeWidget ? (
                  <div className="flex items-center gap-2 rounded-md border border-primary bg-card px-3 py-2 text-sm shadow-lg">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {activeWidget.title || getWidgetLabel(activeWidget.widgetKey)}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>

            {/* Add buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t">
              <AddWidgetDropdown
                onAdd={handleAddRegistryWidget}
                disabled={saving}
              />
              <AddContentDropdown
                onAdd={handleAddContentWidget}
                disabled={saving}
              />
            </div>
          </div>

          {/* RIGHT: Settings Panel */}
          <div className="w-80 shrink-0 overflow-y-auto bg-card">
            <div className="p-3 border-b">
              <CardTitle className="text-sm font-semibold">
                {selectedWidget
                  ? selectedWidget.title || getWidgetLabel(selectedWidget.widgetKey)
                  : "Settings"}
              </CardTitle>
            </div>
            {renderSettingsPanel()}
          </div>
        </div>
      </div>
    </div>
  )
}
