import { prisma } from '@/lib/prisma'
import { AUTH_POLICY_KEYS, resolveAuthPolicy } from './auth-policy'

// Read on each authentication request so administrator changes apply immediately.
export async function getAuthPolicy() {
  const rows = await prisma.setting.findMany({ where: { key: { in: [...AUTH_POLICY_KEYS] } } })
  return resolveAuthPolicy(Object.fromEntries(rows.map(row => [row.key, row.value])))
}
