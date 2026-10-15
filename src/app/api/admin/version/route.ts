import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getLatestRelease } from '@/lib/releases/latest'
import { getVersionStatus } from '@/lib/releases/version'

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' }
  if (!await getAdminUser()) return NextResponse.json({ error: 'Forbidden' }, { status: 401, headers })
  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || ''
  const release = await getLatestRelease()
  const status = getVersionStatus(currentVersion, release?.version ?? '')
  return NextResponse.json({ currentVersion, latestVersion: release?.version ?? null,
    releaseUrl: release?.url ?? null, status, updateAvailable: status === 'update' }, { headers })
}
