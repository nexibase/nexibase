import { prisma } from '@/lib/prisma'
import { UserLayout } from '@/components/layout/UserLayout'
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

  return (
    <UserLayout>
      <div className="space-y-6">
        <WidgetRenderer zone="top" widgets={allWidgets} />
        <WidgetRenderer zone="center" widgets={allWidgets} />
        <WidgetRenderer zone="bottom" widgets={allWidgets} />
      </div>
    </UserLayout>
  )
}
