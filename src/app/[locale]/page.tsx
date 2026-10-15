import { prisma } from '@/lib/prisma'
import WidgetRenderer from '@/lib/widgets/renderer'
import type { Metadata } from 'next'
import { prepareHomeImages } from '@/lib/widgets/prepare-home-images'
import { prepareHomeData } from '@/lib/widgets/prepare-home-data'
import { cache } from 'react'
import { loadSiteSettings, resolveSiteUrl } from '@/lib/site-settings'
import { isNexibaseProfile, nexibaseSeo, pageMetadata } from '@/lib/seo'
import { NexibaseIntroduction } from '@/components/seo/NexibaseIntroduction'

const getHomePage = cache(async () => {
  return prisma.widgetPage.findUnique({
    where: { slug: '' },
    include: {
      widgets: {
        where: { isActive: true },
        orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      },
    },
  })
})

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getHomePage(), loadSiteSettings()])
  const product = isNexibaseProfile(settings.site_seo_profile, page?.widgets.map(widget => widget.widgetKey) ?? [])
  const copy = nexibaseSeo(settings.site_locale)
  const title = page?.seoTitle || (product ? `${settings.site_name} | ${copy.title}` : settings.site_name)
  const description = page?.seoDescription || (product ? copy.description : settings.site_description)
  const metadata = pageMetadata(title, description, page?.seoCanonical || '/', { noIndex: page?.seoNoIndex || page?.isActive === false, image: page?.seoOgImage || undefined })
  return {
    ...metadata, title: { absolute: title },
    openGraph: { ...metadata.openGraph, title: page?.seoOgTitle || title, description: page?.seoOgDescription || description },
    robots: { index: page?.isActive !== false && !page?.seoNoIndex, follow: !page?.seoNoFollow },
  }
}

export default async function HomePage() {
  const [page, settings] = await Promise.all([getHomePage(), loadSiteSettings()])
  const product = isNexibaseProfile(settings.site_seo_profile, page?.widgets.map(widget => widget.widgetKey) ?? [])
  const introduction = product ? <NexibaseIntroduction locale={settings.site_locale} url={(await resolveSiteUrl(settings.site_url)).toString()} /> : null
  const allWidgets = await prepareHomeImages(await prepareHomeData(page?.widgets ?? []))

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
            {introduction}
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
          {introduction}
        </main>
      )}
    </div>
  )
}
