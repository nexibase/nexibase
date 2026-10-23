import { NextResponse, type NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { serializeConsent } from '@/lib/consent/cookie'
import { isCrossSiteWrite } from '@/lib/consent/origin'
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

/** randomUUID()가 생성하는 형식과 동일한 UUID v4 문자열인지 검사한다. */
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidConsentId(id: string): boolean {
  return UUID_V4_RE.test(id)
}

/**
 * action과 클라이언트가 보낸 플래그로부터 실제 기록할 값을 정한다.
 *
 * action이 의미를 명확히 내포하는 경우(reject_all/accept_all)에는 클라이언트
 * 값을 신뢰하지 않고 서버가 강제한다 — 그렇지 않으면 "reject_all인데
 * analytics=true"처럼 라벨과 플래그가 모순되는 레코드가 증빙 테이블에 남을 수
 * 있다. save_custom/withdraw는 어떤 조합도 정당하므로(withdraw는 "적어도 하나를
 * 끔"을 의미할 뿐 다른 카테고리를 켜는 것과 공존할 수 있다) 클라이언트 값을
 * 그대로 쓴다.
 */
function deriveConsentFlags(
  action: ConsentAction,
  analytics: boolean,
  marketing: boolean,
): { analytics: boolean; marketing: boolean } {
  switch (action) {
    case 'reject_all':
      return { analytics: false, marketing: false }
    case 'accept_all':
      // marketing은 UI에 토글이 없는 카테고리라 "전체 동의"가 임의로 true를
      // 만들어내면 안 된다 — 제시된 적 없는 항목까지 동의로 기록하게 된다.
      return { analytics: true, marketing }
    case 'save_custom':
    case 'withdraw':
      return { analytics, marketing }
  }
}

/**
 * `application/json`만 받는다.
 *
 * 컨텐츠 타입을 확인하지 않으면 `enctype="text/plain"` 폼으로 JSON 본문을
 * 보내는 고전적인 JSON-CSRF가 통한다 — preflight가 붙지 않는 simple request라
 * 브라우저가 막아 주지 않는다.
 */
function hasJsonContentType(request: NextRequest): boolean {
  const raw = request.headers.get('content-type')
  if (!raw) return false
  const mime = raw.split(';')[0]?.trim().toLowerCase()
  return mime === 'application/json'
}

export async function POST(request: NextRequest) {
  if (isCrossSiteWrite(request.headers, request.nextUrl)) {
    return NextResponse.json({ error: 'cross_origin' }, { status: 403 })
  }
  if (!hasJsonContentType(request)) {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415 })
  }

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
  const marketingRaw = typeof marketing === 'boolean' ? marketing : false
  const { analytics: analyticsValue, marketing: marketingValue } = deriveConsentFlags(
    action,
    analytics,
    marketingRaw,
  )

  const context = await readConsentContext()
  // 설정을 읽지 못한 상태에서는 동의를 기록하지 않는다 — bannerVersion 등
  // 함께 기록해야 할 값들도 신뢰할 수 없다. 클라이언트는 배너를 유지한다.
  if (context.status === 'unknown') {
    return NextResponse.json({ error: 'consent_unavailable' }, { status: 503 })
  }
  if (context.status === 'off') {
    return NextResponse.json({ error: 'consent_disabled' }, { status: 404 })
  }

  // 기존 UUID를 재사용한다. 재동의가 새 ID를 만들면 이력이 끊긴다.
  // 단, 재사용 대상이 randomUUID() 형식이 아니면(손상된 쿠키) 폐기하고 새로
  // 발급한다 — 방문자가 나쁜 쿠키 때문에 동의를 못 하게 되면 안 된다.
  const reusedConsentId = context.state.consentId
  const consentId =
    reusedConsentId && isValidConsentId(reusedConsentId) ? reusedConsentId : randomUUID()

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
        analytics: analyticsValue,
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
    analytics: analyticsValue,
    marketing: marketingValue,
    ts: Date.now(),
    pv: context.policyVersion,
  }

  const response = NextResponse.json({
    ok: true,
    analytics: analyticsValue,
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
