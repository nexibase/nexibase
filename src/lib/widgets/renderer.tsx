"use client"

import { widgetRegistry } from './registry'
import { contentRenderers } from './content-renderers'

interface WidgetData {
  id: number
  widgetKey: string
  widgetType?: string
  zone: string
  title: string
  settings: string | null
  colSpan: number
  rowSpan: number
  isActive: boolean
  sortOrder: number
}

interface WidgetRendererProps {
  zone: string
  widgets: WidgetData[]
}

export default function WidgetRenderer({ zone, widgets }: WidgetRendererProps) {
  const zoneWidgets = widgets
    .filter(w => w.zone === zone && w.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  if (zoneWidgets.length === 0) return null

  const isSidebar = zone === 'left' || zone === 'right' || zone === 'sidebar'
  const allFullWidth = isSidebar || zoneWidgets.every(w => w.colSpan >= 12)

  if (allFullWidth) {
    return (
      <div className="space-y-4">
        {zoneWidgets.map((widget) => (
          <div key={widget.id} className={slotMinHeightClass(widget, isSidebar)}>
            {renderWidgetContent(widget)}
          </div>
        ))}
      </div>
    )
  }

  const MD_SPAN_CLASS: Record<number, string> = {
    1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3',
    4: 'md:col-span-4', 5: 'md:col-span-5', 6: 'md:col-span-6',
    7: 'md:col-span-7', 8: 'md:col-span-8', 9: 'md:col-span-9',
    10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
  }

  return (
    <div className="grid grid-cols-12 gap-4">
      {zoneWidgets.map((widget) => {
        const span = Math.min(Math.max(widget.colSpan || 12, 1), 12)
        return (
          <div
            key={widget.id}
            className={`col-span-12 ${MD_SPAN_CLASS[span]} ${slotMinHeightClass(widget, false)}`}
          >
            {renderWidgetContent(widget)}
          </div>
        )
      })}
    </div>
  )
}

// Reserve space per widget type to prevent layout shift while client-side
// widgets fetch their data. Content widgets either size themselves from
// settings (video via aspect-ratio, spacer via explicit height) or render
// instantly, so they don't need a reservation. Sidebar widgets are compact
// by nature — reserving 140px creates excessive vertical gaps.
function slotMinHeightClass(widget: WidgetData, isSidebar: boolean): string {
  if (widget.widgetType === 'content') return ''
  if (isSidebar) return ''
  return 'min-h-[140px]'
}

function renderWidgetContent(widget: WidgetData) {
  let settings: Record<string, unknown> = {}
  try {
    settings = widget.settings ? JSON.parse(widget.settings) : {}
  } catch {
    settings = {}
  }

  if (widget.widgetType === 'content') {
    const Renderer = contentRenderers[widget.widgetKey]
    if (!Renderer) {
      console.warn(`unknown content widget type: ${widget.widgetKey}`)
      return null
    }
    return <Renderer settings={settings} />
  }

  const definition = widgetRegistry[widget.widgetKey]
  if (!definition) {
    console.warn(`widget key not in the registry: ${widget.widgetKey}`)
    return null
  }
  return <definition.component settings={settings} />
}
