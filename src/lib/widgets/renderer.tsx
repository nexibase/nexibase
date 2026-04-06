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

  // 위젯이 모두 colSpan 12(전체 너비)이면 단순 스택
  const allFullWidth = zoneWidgets.every(w => w.colSpan >= 12)

  if (allFullWidth) {
    return (
      <div className="space-y-4">
        {zoneWidgets.map((widget) => renderWidget(widget))}
      </div>
    )
  }

  // 혼합 너비 → 12컬럼 그리드
  return (
    <div className="grid grid-cols-12 gap-4">
      {zoneWidgets.map((widget) => {
        const span = Math.min(widget.colSpan || 12, 12)
        return (
          <div key={widget.id} style={{ gridColumn: `span ${span}` }}>
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

  return <Component settings={settings} />
}
