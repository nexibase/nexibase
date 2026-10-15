import type { MetadataRoute } from 'next'
import { resolveSiteUrl } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await resolveSiteUrl()
  return {
    rules: {
      userAgent: '*', allow: '/',
      disallow: ['/admin', '/api/', '/mypage', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/email-certify', '/search', '/boards/*/create', '/boards/*/*/edit', '/shop/cart', '/shop/order', '/shop/mypage', '/shop/wishlist'],
    },
    sitemap: new URL('/sitemap.xml', base).toString(),
  }
}
