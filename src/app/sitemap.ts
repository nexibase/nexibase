import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { resolveSiteUrl } from '@/lib/site-settings'

// Request-scoped origin prevents one installation's URLs leaking into another.
export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await resolveSiteUrl()
  const url = (path: string) => new URL(path, base).toString()
  const [boards, posts, contents, policies, pages] = await Promise.all([
    prisma.board.findMany({ where: { isActive: true, listMemberOnly: false, readMemberOnly: false }, select: { slug: true, updatedAt: true } }),
    prisma.post.findMany({
      where: { status: 'published', isSecret: false, board: { isActive: true, listMemberOnly: false, readMemberOnly: false } },
      select: { id: true, updatedAt: true, board: { select: { slug: true } } },
      orderBy: { updatedAt: 'desc' }, take: 40000,
    }),
    prisma.content.findMany({ where: { isPublic: true }, select: { slug: true, updatedAt: true } }),
    prisma.policy.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
    prisma.widgetPage.findMany({ select: { slug: true, isActive: true, seoNoIndex: true, seoCanonical: true, updatedAt: true } }),
  ])
  const entries: MetadataRoute.Sitemap = [
    { url: url('/boards'), changeFrequency: 'daily', priority: 0.8 },
    { url: url('/faqs'), changeFrequency: 'weekly', priority: 0.7 },
    ...pages.filter(page => page.isActive && !page.seoNoIndex && (!page.seoCanonical || url(page.seoCanonical) === url(`/${page.slug}`))).map(page => ({ url: url(`/${page.slug}`), lastModified: page.updatedAt, changeFrequency: 'weekly' as const, priority: page.slug === '' ? 1 : 0.7 })),
    ...boards.map(board => ({ url: url(`/boards/${encodeURIComponent(board.slug)}`), lastModified: board.updatedAt, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...posts.map(post => ({ url: url(`/boards/${encodeURIComponent(post.board.slug)}/${post.id}`), lastModified: post.updatedAt, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...contents.map(content => ({ url: url(`/contents/${encodeURIComponent(content.slug)}`), lastModified: content.updatedAt, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...policies.map(policy => ({ url: url(`/policies/${encodeURIComponent(policy.slug)}`), lastModified: policy.updatedAt, changeFrequency: 'monthly' as const, priority: 0.3 })),
  ]
  if (!pages.some(page => page.slug === '')) entries.unshift({ url: url('/'), priority: 1 })
  return Array.from(new Map(entries.map(entry => [entry.url, entry])).values()).slice(0, 50000)
}
