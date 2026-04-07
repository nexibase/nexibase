"use client"

import WidgetRenderer from "@/lib/widgets/renderer"
import { useSite } from "@/lib/SiteContext"

interface UserLayoutProps {
  children: React.ReactNode
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
  const { sidebarWidgets } = useSite()

  const leftWidgets = sidebarWidgets.filter(w => w.zone === 'left')
  const rightWidgets = sidebarWidgets.filter(w => w.zone === 'right' || w.zone === 'sidebar')
  const hasLeft = leftWidgets.length > 0
  const hasRight = rightWidgets.length > 0

  // 12컬럼 자동 비율
  const leftCols = hasLeft ? 3 : 0
  const rightCols = hasRight ? 3 : 0
  const centerCols = 12 - leftCols - rightCols

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-6">
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
  )
}
