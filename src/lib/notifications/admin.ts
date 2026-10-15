import { getAdminUser } from '@/lib/auth'

export async function notificationAdmin() {
  const user = await getAdminUser()
  return user?.role === 'admin' && user.status === 'active' && !user.deletedAt ? user : null
}
export function sameOrigin(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false
  const origin = request.headers.get('origin')
  if (!origin) return true // server/CLI clients do not have a browser Origin header
  const expected = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url).origin
  return origin === expected
}
