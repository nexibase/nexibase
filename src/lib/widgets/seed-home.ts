import type { Prisma } from '@prisma/client'

export type HomeWidgetSeed = Pick<Prisma.PageWidgetCreateManyInput,
  'widgetKey' | 'zone' | 'title' | 'colSpan' | 'rowSpan' | 'sortOrder' | 'settings'>

// HomeWidget was replaced by widgets scoped to the home page (slug="").
export async function seedHomeWidgets(
  tx: Prisma.TransactionClient,
  widgets: HomeWidgetSeed[],
  onlyIfEmpty = false,
): Promise<number> {
  if (widgets.length === 0) return 0
  const page = await tx.widgetPage.upsert({
    where: { slug: '' },
    create: { slug: '', title: 'Home', layoutTemplate: 'with-sidebar' },
    update: {},
  })
  // Serialize seed requests before checking for existing home-page widgets.
  await tx.$queryRaw`SELECT id FROM widget_pages WHERE id = ${page.id} FOR UPDATE`
  const existing = await tx.pageWidget.findMany({
    where: { pageId: page.id }, select: { widgetKey: true },
  })
  if (onlyIfEmpty && existing.length > 0) return 0
  const keys = new Set(existing.map(widget => widget.widgetKey))
  let created = 0
  for (const widget of widgets) {
    if (keys.has(widget.widgetKey)) continue
    await tx.pageWidget.create({
      data: { ...widget, pageId: page.id, widgetType: 'registry', isActive: true },
    })
    keys.add(widget.widgetKey)
    created++
  }
  return created
}
