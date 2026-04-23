import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = ['p', 'strong', 'em', 'u', 's', 'a', 'br', 'ul', 'ol', 'li']
const ALLOWED_ATTR = ['href', 'target', 'rel']

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    if (!node.getAttribute('href')) {
      node.removeAttribute('href')
      return
    }
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR })
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
