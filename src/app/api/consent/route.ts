import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/prisma'
import { serializeConsent } from '@/lib/consent/cookie'
import { readConsentContext } from '@/lib/consent/server'
import {
  CONSENT_COOKIE_NAME,
  CONSENT_MAX_AGE_SECONDS,
  type ConsentAction,
  type StoredConsent,
} from '@/lib/consent/types'

const VALID_ACTIONS: readonly ConsentAction[] = [
  'accept_all',
  'reject_all',
  'save_custom',
  'withdraw',
]

function isValidAction(v: unknown): v is ConsentAction {
  return typeof v === 'string' && (VALID_ACTIONS as readonly string[]).includes(v)
}

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { action, analytics, marketing } = body as Record<string, unknown>

  if (!isValidAction(action)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }
  if (typeof analytics !== 'boolean') {
    return NextResponse.json({ error: 'invalid_analytics' }, { status: 400 })
  }
  const marketingValue = typeof marketing === 'boolean' ? marketing : false

  const context = await readConsentContext()
  if (!context.enabled) {
    return NextResponse.json({ error: 'consent_disabled' }, { status: 404 })
  }

  // 기존 UUID를 재사용한다. 재동의가 새 ID를 만들면 이력이 끊긴다.
  const consentId = context.state.consentId ?? randomUUID()

  let userId: number | null = null
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true },
      })
      userId = user?.id ?? null
    }
  } catch {
    // 세션 조회 실패는 기록을 막지 않는다 — 익명으로 남긴다
  }

  // DB 기록이 성공해야만 쿠키를 내린다.
  // 실패 시 클라이언트는 동의를 반영하지 않고 배너를 유지한다.
  try {
    await prisma.consentLog.create({
      data: {
        consentId,
        userId,
        analytics,
        marketing: marketingValue,
        policyVersion: context.policyVersion,
        bannerVersion: String(context.bannerVersion),
        action,
      },
    })
  } catch (err) {
    console.error('[consent] failed to record consent:', err)
    return NextResponse.json({ error: 'record_failed' }, { status: 500 })
  }

  const stored: StoredConsent = {
    v: context.bannerVersion,
    id: consentId,
    analytics,
    marketing: marketingValue,
    ts: Date.now(),
    pv: context.policyVersion,
  }

  const response = NextResponse.json({
    ok: true,
    analytics,
    marketing: marketingValue,
  })

  response.cookies.set({
    name: CONSENT_COOKIE_NAME,
    value: serializeConsent(stored),
    path: '/',
    maxAge: CONSENT_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
