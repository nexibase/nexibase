import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getGaClient } from '@/lib/gaClient'

export const dynamic = 'force-dynamic'

/**
 * Admin-only — runs a single real API call against the stored GA4 config to verify the connection.
 * On success, returns the propertyId alongside today's active user count.
 * All failures — missing config, JSON parse errors, GA auth errors, missing permissions —
 * respond with 200 OK + { ok: false, error } (the frontend shows the error message verbatim).
 */
export async function POST() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 })
  }

  try {
    const client = await getGaClient()
    if (!client) {
      return NextResponse.json({
        ok: false,
        error: 'GA4 설정(Property ID + Service Account JSON)이 완료되지 않았거나 JSON 형식이 올바르지 않습니다.',
      })
    }

    const { propertyId, dataClient } = client

    // Minimal query to verify the connection: today's activeUsers
    const [report] = await dataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    })

    const todayUsers = Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0)

    return NextResponse.json({
      ok: true,
      propertyId,
      todayUsers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/test] GA API call failed:', err)
    return NextResponse.json({ ok: false, error: msg })
  }
}
