"use client"

import { useState, useEffect } from "react"
import { Header, Footer } from "@/components/layout"
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
          // Flatten grouped widgets into a single array
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

  const heroWidgets = allWidgets.filter(w => w.zone === 'hero')
  const mainWidgets = allWidgets.filter(w => w.zone === 'main')
  const sidebarWidgets = allWidgets.filter(w => w.zone === 'sidebar')
  const bottomWidgets = allWidgets.filter(w => w.zone === 'bottom')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground">로딩 중...</div>
          ) : (
            <>
              {/* Hero Zone - 4 column grid */}
              {heroWidgets.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <WidgetRenderer zone="hero" widgets={allWidgets} />
                </div>
              )}

              {/* Main + Sidebar Zone */}
              {(mainWidgets.length > 0 || sidebarWidgets.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[minmax(100px,auto)]">
                  {/* Main Zone - takes 3 columns on lg */}
                  <WidgetRenderer zone="main" widgets={allWidgets} />

                  {/* Sidebar Zone - takes 1 column on lg */}
                  <WidgetRenderer zone="sidebar" widgets={allWidgets} />
                </div>
              )}

              {/* Bottom Zone - full width grid */}
              {bottomWidgets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 auto-rows-[minmax(100px,auto)]">
                  <WidgetRenderer zone="bottom" widgets={allWidgets} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
