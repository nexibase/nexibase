// Shared by the public FAQ page and widget for the current browser session.
const viewed = new Set<number>()
const pending = new Map<number, Promise<number | undefined>>()

export function trackFaqView(id: number): Promise<number | undefined> {
  if (pending.has(id)) return pending.get(id)!
  const key = `faq-viewed:${id}`
  if (viewed.has(id)) return Promise.resolve(undefined)
  try {
    if (sessionStorage.getItem(key) === '1') return Promise.resolve(undefined)
  } catch {}

  const request = (async () => {
    try {
      const response = await fetch('/api/faqs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'view', id }),
      })
      if (!response.ok) return undefined
      const data: { views?: number } = await response.json()
      if (!Number.isInteger(data.views) || data.views! < 0) return undefined
      viewed.add(id)
      try { sessionStorage.setItem(key, '1') } catch {}
      return data.views
    } catch {
      return undefined
    } finally {
      pending.delete(id)
    }
  })()
  pending.set(id, request)
  return request
}
