"use client"

import { useState, useEffect } from "react"
import WidgetRenderer from "@/lib/widgets/renderer"

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

export default function HomePage() {
  const [allWidgets, setAllWidgets] = useState<WidgetData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchWidgets = async () => {
      try {
        const res = await fetch('/api/home-widgets')
        if (res.ok) {
          const data = await res.json()
          const widgets: WidgetData[] = []
          for (const zone of Object.keys(data.widgets || {})) {
            for (const w of data.widgets[zone]) {
              widgets.push(w)
            }
          }
          setAllWidgets(widgets)
        }
      } catch (error) {
        console.error('위젯 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchWidgets()
  }, [])

  const topWidgets = allWidgets.filter(w => w.zone === 'top')
  const centerWidgets = allWidgets.filter(w => w.zone === 'center')
  const bottomWidgets = allWidgets.filter(w => w.zone === 'bottom')

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
  }

  return (
    <div className="space-y-6">
      {/* 상단 영역 */}
      {topWidgets.length > 0 && (
        <div className="grid grid-cols-12 gap-4">
          <WidgetRenderer zone="top" widgets={allWidgets} />
        </div>
      )}

      {/* 중앙 영역 */}
      {centerWidgets.length > 0 && (
        <div className="grid grid-cols-12 gap-4 auto-rows-auto">
          <WidgetRenderer zone="center" widgets={allWidgets} />
        </div>
      )}

      {/* 하단 */}
      {bottomWidgets.length > 0 && (
        <div className="grid grid-cols-12 gap-4 auto-rows-auto">
          <WidgetRenderer zone="bottom" widgets={allWidgets} />
        </div>
      )}
    </div>
  )
}
