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

  // 사이드바 영역은 항상 세로 스택 (colSpan 무시)
  const isSidebar = zone === 'left' || zone === 'right' || zone === 'sidebar'

  // 위젯이 모두 colSpan 12(전체 너비)이거나 사이드바면 단순 스택
  const allFullWidth = isSidebar || zoneWidgets.every(w => w.colSpan >= 12)

  if (allFullWidth) {
    return (
      <div className="space-y-4">
        {zoneWidgets.map((widget) => renderWidget(widget))}
      </div>
    )
  }

  // 혼합 너비 → 12컬럼 그리드 (모바일: 전부 full-width 스택, md+: 지정된 span 적용)
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
