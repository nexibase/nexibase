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

  return (
    <>
      {zoneWidgets.map((widget) => {
        const definition = widgetRegistry[widget.widgetKey]
        if (!definition) {
          console.warn(`위젯 레지스트리에 없는 키: ${widget.widgetKey}`)
          return null
        }

        const Component = definition.component
        let settings: Record<string, unknown> = {}
        try {
          settings = widget.settings ? JSON.parse(widget.settings) : {}
        } catch {
          settings = {}
        }

        // Determine grid classes based on colSpan/rowSpan
        const colClass = widget.colSpan === 2 ? 'md:col-span-2' :
                         widget.colSpan === 3 ? 'md:col-span-3' :
                         widget.colSpan === 4 ? 'col-span-full' : ''
        const rowClass = widget.rowSpan === 2 ? 'lg:row-span-2' :
                         widget.rowSpan === 3 ? 'lg:row-span-3' : ''

        return (
          <div key={widget.id} className={`${colClass} ${rowClass}`}>
            <Component settings={settings} />
          </div>
        )
      })}
    </>
  )
}
