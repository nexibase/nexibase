export interface FaqActivityStatus {
  votes: { faqId: number; helpful: boolean }[]
  viewedIds: number[]
  guest: boolean
}

let pendingStatus: Promise<FaqActivityStatus> | undefined
let visitorReady = false

// Share the initial identity request between feedback and view tracking. A
// guest must receive one signed cookie before simultaneous actions can count.
export function loadFaqActivityStatus(): Promise<FaqActivityStatus> {
  if (pendingStatus) return pendingStatus
  pendingStatus = Promise.resolve().then(async () => {
    const response = await fetch('/api/faqs?type=activity', { cache: 'no-store' })
    if (!response.ok) throw new Error('FAQ activity status unavailable')
    const data: FaqActivityStatus = await response.json()
    visitorReady = true
    return data
  }).finally(() => { pendingStatus = undefined })
  return pendingStatus
}

export async function ensureFaqVisitor(force = false): Promise<void> {
  if (!visitorReady || force) await loadFaqActivityStatus()
}
