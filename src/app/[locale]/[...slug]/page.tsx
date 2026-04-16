import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import WidgetRenderer from '@/lib/widgets/renderer'
import { getTemplateZones } from '@/lib/widgets/layout-templates'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ locale: string; slug: string[] }>
}

async function getWidgetPage(slug: string) {
  return prisma.widgetPage.findUnique({
    where: { slug },
    include: {
      widgets: {
        where: { isActive: true },
        orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug: segments } = await params
  const slug = segments.join('/')
  const page = await getWidgetPage(slug)

  if (!page || !page.isActive) return {}

  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || undefined,
    openGraph: {
      title: page.seoOgTitle || page.seoTitle || page.title,
      description: page.seoOgDescription || page.seoDescription || undefined,
      images: page.seoOgImage ? [page.seoOgImage] : undefined,
    },
    robots: {
      index: !page.seoNoIndex,
      follow: !page.seoNoFollow,
    },
    alternates: page.seoCanonical ? { canonical: page.seoCanonical } : undefined,
  }
}

export default async function CustomPage({ params }: PageProps) {
  const { slug: segments } = await params
  const slug = segments.join('/')
  const page = await getWidgetPage(slug)

  if (!page || !page.isActive) notFound()

  const zones = getTemplateZones(page.layoutTemplate)
  const allWidgets = page.widgets

  // Full-width: top / main / bottom (no sidebar)
  if (page.layoutTemplate === 'full-width') {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <div className="space-y-6">
          {zones.map(zone => (
            <WidgetRenderer key={zone} zone={zone} widgets={allWidgets} />
          ))}
        </div>
      </div>
    )
  }

  // Minimal: single main zone, narrower max-width
  if (page.layoutTemplate === 'minimal') {
    return (
      <div className="max-w-3xl mx-auto px-2 sm:px-4 py-2 sm:py-6">
        <WidgetRenderer zone="main" widgets={allWidgets} />
      </div>
    )
  }

  // With-sidebar: left | top+center+bottom | right (matches editor grid)
  const leftWidgets = allWidgets.filter(w => w.zone === 'left')
  const rightWidgets = allWidgets.filter(w => w.zone === 'right')
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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {hasLeft && (
          <aside className={colSpanClass[leftCols]}>
            <WidgetRenderer zone="left" widgets={allWidgets} />
          </aside>
        )}
        <main className={`${colSpanClass[centerCols]} space-y-6`}>
          <WidgetRenderer zone="top" widgets={allWidgets} />
          <WidgetRenderer zone="center" widgets={allWidgets} />
          <WidgetRenderer zone="bottom" widgets={allWidgets} />
        </main>
        {hasRight && (
          <aside className={colSpanClass[rightCols]}>
            <WidgetRenderer zone="right" widgets={allWidgets} />
          </aside>
        )}
      </div>
    </div>
  )
}
