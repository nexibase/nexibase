"use client"

import { useState, useEffect } from "react"
import { getLayoutComponent } from "@/lib/layout-loader"
import WidgetRenderer from "@/lib/widgets/renderer"

interface UserLayoutProps {
  children: React.ReactNode
}

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

// Tailwind은 동적 클래스를 지원하지 않으므로 정적 매핑
const colSpanClass: Record<number, string> = {
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  6: 'md:col-span-6',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  12: 'md:col-span-12',
}

export function UserLayout({ children }: UserLayoutProps) {
  const [layoutFolder, setLayoutFolder] = useState('default')
  const [sidebarWidgets, setSidebarWidgets] = useState<WidgetData[]>([])

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.settings?.layout_folder) {
          setLayoutFolder(data.settings.layout_folder)
        }
      })
      .catch(() => {})

    fetch('/api/home-widgets')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.widgets) {
          const all: WidgetData[] = []
          for (const zone of Object.keys(data.widgets)) {
            for (const w of data.widgets[zone]) {
              all.push(w)
            }
          }
          setSidebarWidgets(all.filter(w => w.zone === 'left' || w.zone === 'right' || w.zone === 'sidebar'))
        }
      })
      .catch(() => {})
  }, [])

  const HeaderComponent = getLayoutComponent(layoutFolder, 'Header')
  const FooterComponent = getLayoutComponent(layoutFolder, 'Footer')

  const leftWidgets = sidebarWidgets.filter(w => w.zone === 'left')
  const rightWidgets = sidebarWidgets.filter(w => w.zone === 'right' || w.zone === 'sidebar')
  const hasLeft = leftWidgets.length > 0
  const hasRight = rightWidgets.length > 0

  // 12컬럼 자동 비율
  const leftCols = hasLeft ? 3 : 0
  const rightCols = hasRight ? 3 : 0
  const centerCols = 12 - leftCols - rightCols

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderComponent />
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {hasLeft || hasRight ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {hasLeft && (
                <aside className={colSpanClass[leftCols]}>
                  <WidgetRenderer zone="left" widgets={sidebarWidgets} />
                </aside>
              )}
              <main className={colSpanClass[centerCols]}>
                {children}
              </main>
              {hasRight && (
                <aside className={colSpanClass[rightCols]}>
                  <WidgetRenderer zone="right" widgets={sidebarWidgets} />
                  <WidgetRenderer zone="sidebar" widgets={sidebarWidgets} />
                </aside>
              )}
            </div>
          ) : (
            <main>{children}</main>
          )}
        </div>
      </div>
      <FooterComponent />
    </div>
  )
}
