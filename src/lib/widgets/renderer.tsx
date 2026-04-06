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

// colSpan(1~12) → 12컬럼 그리드 매핑
const colSpanTo12: Record<number, string> = {
  1: 'col-span-12 md:col-span-6 lg:col-span-1',
  2: 'col-span-12 md:col-span-6 lg:col-span-2',
  3: 'col-span-12 md:col-span-6 lg:col-span-3',
  4: 'col-span-12 md:col-span-6 lg:col-span-4',
  5: 'col-span-12 md:col-span-6 lg:col-span-5',
  6: 'col-span-12 md:col-span-6',
  7: 'col-span-12 md:col-span-7',
  8: 'col-span-12 md:col-span-8',
  9: 'col-span-12 md:col-span-9',
  10: 'col-span-12 md:col-span-10',
  11: 'col-span-12 md:col-span-11',
  12: 'col-span-12',
}

const rowSpanClass: Record<number, string> = {
  2: 'lg:row-span-2',
  3: 'lg:row-span-3',
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

        const colClass = colSpanTo12[widget.colSpan] || colSpanTo12[1]
        const rowClass = rowSpanClass[widget.rowSpan] || ''

        return (
          <div key={widget.id} className={`${colClass} ${rowClass}`}>
            <Component settings={settings} />
          </div>
        )
      })}
    </>
  )
}
