import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = ['p', 'strong', 'em', 'u', 's', 'a', 'br', 'ul', 'ol', 'li']
const ALLOWED_ATTR = ['href', 'target', 'rel']

export function sanitizeHtml(dirty: string): string {
  const clean = DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR })
  // Force safe link attributes on any surviving <a>
  return clean.replace(
    /<a\s+([^>]*?)>/gi,
    (_m, attrs) => {
      const hrefMatch = attrs.match(/href=(['"])([^'"]*)\1/i)
      if (!hrefMatch) return `<a>`
      return `<a href=${hrefMatch[1]}${hrefMatch[2]}${hrefMatch[1]} target="_blank" rel="noopener noreferrer">`
    }
  )
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
