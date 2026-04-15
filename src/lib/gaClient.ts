import { createHash } from 'crypto'
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { prisma } from '@/lib/prisma'

export interface GaClient {
  propertyId: string
  dataClient: BetaAnalyticsDataClient
}

// Module-scope cache: reuse the client for the lifetime of the process
let cachedClient: { credentialsHash: string; client: GaClient } | null = null

/**
 * Reads ga4_property_id + ga4_service_account_json from the settings table and
 * returns a BetaAnalyticsDataClient instance.
 *
 * Returns null in all of the following cases (the caller cannot distinguish):
 * - Either setting is empty (not configured)
 * - Service Account JSON fails to parse (format error)
 * - Exception while constructing BetaAnalyticsDataClient (auth library error)
 * - DB lookup failure
 *
 * Callers should report something like "not configured or invalid format".
 *
 * When the credentials hash (SHA-256) changes (setting updated), a fresh
 * client is created.
 */
export async function getGaClient(): Promise<GaClient | null> {
  try {
    const [propRow, jsonRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'ga4_property_id' } }),
      prisma.setting.findUnique({ where: { key: 'ga4_service_account_json' } }),
    ])

    const propertyId = propRow?.value?.trim()
    const jsonStr = jsonRow?.value?.trim()
    if (!propertyId || !jsonStr) return null

    // Create a new client when the settings change
    const hash = `${propertyId}:${createHash('sha256').update(jsonStr).digest('hex')}`
    if (cachedClient && cachedClient.credentialsHash === hash) {
      return cachedClient.client
    }

    const credentials = JSON.parse(jsonStr)
    const dataClient = new BetaAnalyticsDataClient({ credentials })
    cachedClient = { credentialsHash: hash, client: { propertyId, dataClient } }
    return cachedClient.client
  } catch (err) {
    console.error('[gaClient] client construction failed:', err)
    return null
  }
}

/**
 * Force-invalidate the cache (for tests; no current call sites, reserved for
 * future use).
 */
export function invalidateGaClientCache(): void {
  cachedClient = null
}
