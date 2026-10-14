export function faqHash(id: number): string { return `#faq-${id}` }

export function faqIdFromHash(hash: string): number | null {
  const match = /^#faq-([1-9]\d*)$/.exec(hash)
  const id = match ? Number(match[1]) : NaN
  return Number.isSafeInteger(id) ? id : null
}

export function faqSharePath(id: number): string { return `/faqs${faqHash(id)}` }
