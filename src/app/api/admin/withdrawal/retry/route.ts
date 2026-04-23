import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { executeWithdrawalPhase2 } from '@/lib/withdrawal/execute'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { jobId } = await req.json().catch(() => ({}))
  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'invalid_job_id' }, { status: 400 })
  }
  try {
    await executeWithdrawalPhase2(jobId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
