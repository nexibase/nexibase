import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { loadSiteSettings } from '@/lib/site-settings'

const FALLBACK_BASE = 'https://nexibase.com'

function cleanBase(url: string): string {
  return url.replace(/\/$/, '')
}

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await loadSiteSettings()
  const base = cleanBase(settings.site_url || FALLBACK_BASE)
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/boards`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/faq-accordion`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/posts/latest`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/posts/popular`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/search`, lastModified: now, changeFrequency: 'weekly', priority: 0.4 },
  ]

  const [boards, posts, contents, policies] = await Promise.all([
    prisma.board.findMany({
      where: { readMemberOnly: false },
      select: { slug: true, updatedAt: true },
    }),
    prisma.post.findMany({
      where: {
        status: 'published',
        isSecret: false,
        board: { readMemberOnly: false },
      },
      select: {
        id: true,
        updatedAt: true,
        board: { select: { slug: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.content.findMany({
      where: { isPublic: true },
      select: { slug: true, updatedAt: true },
    }),
    prisma.policy.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
    }),
  ])

  const boardEntries: MetadataRoute.Sitemap = boards.map((b) => ({
    url: `${base}/boards/${b.slug}`,
    lastModified: b.updatedAt,
    changeFrequency: 'daily',
    priority: 0.8,
  }))

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/boards/${p.board.slug}/${p.id}`,
    lastModified: p.updatedAt,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const contentEntries: MetadataRoute.Sitemap = contents.map((c) => ({
    url: `${base}/contents/${c.slug}`,
    lastModified: c.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const policyEntries: MetadataRoute.Sitemap = policies.map((p) => ({
    url: `${base}/policies/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.4,
  }))

  return [
    ...staticEntries,
    ...boardEntries,
    ...postEntries,
    ...contentEntries,
    ...policyEntries,
  ]
}
