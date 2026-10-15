import 'server-only'
import { prisma } from '@/lib/prisma'

// Use the same public fields and filters as the existing widget APIs. This
// data is request scoped; authenticated or private data is never cached here.
export async function prepareHomeData<T extends { widgetKey: string; settings: string | null }>(widgets: T[]): Promise<T[]> {
  const readBoards = () => prisma.board.findMany({
    where: { isActive: true, listMemberOnly: false }, orderBy: { createdAt: 'asc' }, take: 50,
    select: { id: true, slug: true, name: true, description: true, postCount: true },
  })
  let boards: ReturnType<typeof readBoards> | undefined
  return Promise.all(widgets.map(async widget => {
    let settings: Record<string, unknown>
    try { settings = JSON.parse(widget.settings || '{}') } catch { return widget }
    try {
      const limit = Math.min(50, Math.max(1, Number(settings.limit) || 6))
      if (widget.widgetKey === 'latest-posts') {
        const posts = await prisma.post.findMany({
          where: { status: 'published', isSecret: false, board: { isActive: true, listMemberOnly: false, readMemberOnly: false } }, orderBy: { createdAt: 'desc' }, take: limit,
          select: { id: true, title: true, viewCount: true, commentCount: true, createdAt: true,
            board: { select: { slug: true, name: true } },
            author: { select: { id: true, nickname: true } },
          },
        })
        settings.initialPosts = posts.map(p => ({ ...p, createdAt: p.createdAt.toISOString() }))
      }
      if (['board-cards', 'popular-boards', 'welcome-banner'].includes(widget.widgetKey)) {
        boards ??= readBoards()
        const items = await boards
        settings.initialBoards = items.slice(0, limit)
        if (widget.widgetKey === 'welcome-banner') {
          const rows = await prisma.setting.findMany({ where: { key: { in: ['site_name', 'site_description'] } } })
          const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
          settings.initialWelcome = { siteName: values.site_name || 'NexiBase', siteDescription: values.site_description || '', firstBoardSlug: items[0]?.slug || '' }
        }
      }
    } catch {
      // Keep the existing client fetch and skeleton when public data is unavailable.
    }
    return { ...widget, settings: JSON.stringify(settings) }
  }))
}
