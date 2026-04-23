import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getAuthUser } from '@/lib/auth'
import { executeWithdrawalPhase1, executeWithdrawalPhase2 } from '@/lib/withdrawal/execute'

const ALLOWED_REASON_CODES = new Set(['rarely_used', 'no_feature', 'moved_service', 'privacy', 'other'])

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { password, reasonCode, reasonText } = body as {
    password?: string
    reasonCode?: string
    reasonText?: string
  }

  // Password verification: required if the user has a local password.
  if (user.password) {
    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'password_required' }, { status: 400 })
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
    }
  }
  // OAuth-only users: password is null. Current session cookie itself is the
  // re-verification (they are logged in). Additional OAuth re-auth can be
  // added later if stricter verification is required.

  // Reason validation
  if (reasonCode !== undefined && !ALLOWED_REASON_CODES.has(reasonCode)) {
    return NextResponse.json({ error: 'invalid_reason_code' }, { status: 400 })
  }
  if (reasonText !== undefined && typeof reasonText !== 'string') {
    return NextResponse.json({ error: 'invalid_reason_text' }, { status: 400 })
  }
  if (reasonText && reasonText.length > 500) {
    return NextResponse.json({ error: 'reason_text_too_long' }, { status: 400 })
  }

  const { jobId } = await executeWithdrawalPhase1({
    userId: user.id,
    reasonCode: reasonCode || null,
    reasonText: reasonCode === 'other' ? (reasonText || null) : null,
  })

  // Fire-and-forget Phase 2. Explicitly unawaited — do not block the response.
  // Errors are captured by executeWithdrawalPhase2 into withdrawal_jobs.status='failed'.
  void executeWithdrawalPhase2(jobId).catch(err => {
    console.error(`[withdrawal] Phase 2 failed for job ${jobId}:`, err)
  })

  const res = NextResponse.json({ ok: true })
  // Clear NextAuth session cookies so the client side no longer has a usable
  // JWT. The server-side session lookup already refuses withdrawn users via
  // the status filter in src/lib/auth.ts, but clearing here prevents the
  // brief window where a client component still reads a decoded-but-stale JWT.
  res.cookies.delete('next-auth.session-token')
  res.cookies.delete('__Secure-next-auth.session-token')
  return res
}
