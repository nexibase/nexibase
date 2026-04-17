import { prisma } from '@/lib/prisma'
import WidgetRenderer from '@/lib/widgets/renderer'
import type { Metadata } from 'next'

async function getHomePage() {
  return prisma.widgetPage.findUnique({
    where: { slug: '' },
    include: {
      widgets: {
        where: { isActive: true },
        orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  })
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getHomePage()
  if (!page) return {}

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
  }
}

export default async function HomePage() {
  const page = await getHomePage()
  const allWidgets = page?.widgets ?? []

  // Render sidebars directly from server-side data to avoid layout shift
  // (UserLayout fetches sidebar widgets client-side, which causes the center
  // column to resize after hydration).
  const leftWidgets = allWidgets.filter(w => w.zone === 'left')
  const rightWidgets = allWidgets.filter(w => w.zone === 'right' || w.zone === 'sidebar')
  const hasLeft = leftWidgets.length > 0
  const hasRight = rightWidgets.length > 0
  const leftCols = hasLeft ? 3 : 0
  const rightCols = hasRight ? 3 : 0
  const centerCols = 12 - leftCols - rightCols

  const colSpanClass: Record<number, string> = {
    3: 'md:col-span-3', 6: 'md:col-span-6', 9: 'md:col-span-9', 12: 'md:col-span-12',
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
      {hasLeft || hasRight ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {hasLeft && (
            <aside className={colSpanClass[leftCols]}>
              <WidgetRenderer zone="left" widgets={allWidgets} />
            </aside>
          )}
          <main className={`${colSpanClass[centerCols]} space-y-4`}>
            <WidgetRenderer zone="top" widgets={allWidgets} />
            <WidgetRenderer zone="center" widgets={allWidgets} />
            <WidgetRenderer zone="bottom" widgets={allWidgets} />
          </main>
          {hasRight && (
            <aside className={colSpanClass[rightCols]}>
              <WidgetRenderer zone="right" widgets={allWidgets} />
              <WidgetRenderer zone="sidebar" widgets={allWidgets} />
            </aside>
          )}
        </div>
      ) : (
        <main className="space-y-4">
          <WidgetRenderer zone="top" widgets={allWidgets} />
          <WidgetRenderer zone="center" widgets={allWidgets} />
          <WidgetRenderer zone="bottom" widgets={allWidgets} />
        </main>
      )}
    </div>
  )
}
