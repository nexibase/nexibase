import { ensureFaqVisitor } from './activity-status'

// The database is authoritative; browser memory only joins in-flight requests.
// Every open checks the current account/cookie, including after account changes.
const pending = new Map<number, Promise<number | undefined>>()

export function trackFaqView(id: number): Promise<number | undefined> {
  if (pending.has(id)) return pending.get(id)!
  const request = Promise.resolve().then(async () => {
    try {
      await ensureFaqVisitor()
      const send = () => fetch('/api/faqs', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'view', id }),
      })
      let response = await send()
      if (response.status === 400) {
        const error = await response.json()
        if (error.error !== 'visitor_required') return undefined
        await ensureFaqVisitor(true)
        response = await send()
      }
      if (!response.ok) return undefined
      const data: { views?: number } = await response.json()
      return Number.isInteger(data.views) && data.views! >= 0 ? data.views : undefined
    } catch {
      return undefined
    }
  }).finally(() => { pending.delete(id) })
  pending.set(id, request)
  return request
}
