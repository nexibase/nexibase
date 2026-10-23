import { sanitizeHtml } from '@/lib/sanitize'

function decodeText(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
    const point = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
  }).replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, key: string) =>
    ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" })[key] || '')
}

function plainText(html: string): string {
  return decodeText(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function safeImage(value?: string | null): string | null {
  if (!value) return null
  const src = decodeText(value.trim())
  if (/^\/uploads\/[a-z0-9/_%. -]+\.(?:png|jpe?g|webp|gif|avif)$/i.test(src) && !src.includes('..')) return src
  try {
    const url = new URL(src)
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href
  } catch { /* Unsupported or relative image URL. */ }
  return null
}

export interface ShowcasePreview {
  thumbnail: string | null
  excerpt: string
  siteUrl: string | null
}

// Return only display fields. Never return the original HTML to a public card.
export function getShowcasePreview(content: string, attachment?: string | null): ShowcasePreview {
  const html = sanitizeHtml(content)
  const inlineImage = html.match(/<img\b[^>]*\bsrc="([^"]+)"/i)?.[1]
  let siteUrl: string | null = null
  for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)) {
    try {
      const url = new URL(decodeText(match[1]))
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) {
        siteUrl = url.href
        break
      }
    } catch { /* Keep looking for an absolute website link. */ }
  }
  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(match => plainText(match[1]))
    .filter(text => text && !/^(?:https?:\/\/|[a-z0-9.-]+\.[a-z]{2,}\/?$)/i.test(text))
  return {
    thumbnail: safeImage(attachment) || safeImage(inlineImage),
    excerpt: (paragraphs[0] || plainText(html)).slice(0, 160),
    siteUrl,
  }
}
