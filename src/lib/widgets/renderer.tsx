"use client"

import { widgetRegistry } from './registry'

interface WidgetData {
  id: number
  widgetKey: string
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

  // Sidebar zones always stack vertically (colSpan ignored)
  const isSidebar = zone === 'left' || zone === 'right' || zone === 'sidebar'

  // Stack simply when every widget is full-width (colSpan 12) or when we are in a sidebar zone
  const allFullWidth = isSidebar || zoneWidgets.every(w => w.colSpan >= 12)

  if (allFullWidth) {
    return (
      <div className="space-y-4">
        {zoneWidgets.map((widget) => renderWidget(widget))}
      </div>
    )
  }

  // Mixed widths → 12-column grid (mobile: full-width stack; md+: apply configured span)
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
          <div key={widget.id} className={`col-span-12 ${MD_SPAN_CLASS[span]}`}>
            {renderWidgetContent(widget)}
          </div>
        )
      })}
    </div>
  )
}

function renderWidget(widget: WidgetData) {
  return (
    <div key={widget.id}>
      {renderWidgetContent(widget)}
    </div>
  )
}

function renderWidgetContent(widget: WidgetData) {
  const definition = widgetRegistry[widget.widgetKey]
  if (!definition) {
    console.warn(`widget key not in the registry: ${widget.widgetKey}`)
    return null
  }

  const Component = definition.component
  let settings: Record<string, unknown> = {}
  try {
    settings = widget.settings ? JSON.parse(widget.settings) : {}
  } catch {
    settings = {}
  }

  return <Component settings={settings} />
}
