export function faqCategoryPath(slug?: string): string {
  return slug ? `/faqs/${encodeURIComponent(slug)}` : '/faqs'
}
