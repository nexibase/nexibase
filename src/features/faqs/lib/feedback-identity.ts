import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export const FAQ_VOTER_COOKIE = 'nexibase-faq-voter'
export const FAQ_VOTER_MAX_AGE = 365 * 24 * 60 * 60

export function signVisitor(id: string, secret: string): string {
  return `${id}.${createHmac('sha256', secret).update(`faq-voter:${id}`).digest('hex')}`
}

export function readVisitor(value: string | undefined, secret: string): string | null {
  if (!value) return null
  const [id, signature, extra] = value.split('.')
  if (extra !== undefined || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(id ?? '') || !/^[a-f0-9]{64}$/.test(signature ?? '')) return null
  const expected = signVisitor(id, secret).split('.')[1]
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex')) ? id : null
}

export function createVisitor(secret: string) {
  const id = randomUUID()
  return { voterKey: `guest:${id}`, cookie: signVisitor(id, secret) }
}
