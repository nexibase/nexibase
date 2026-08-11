import type { StoredConsent } from './types'

/** 쿠키 값으로 안전하도록 URL 인코딩한다. */
export function serializeConsent(stored: StoredConsent): string {
  return encodeURIComponent(JSON.stringify(stored))
}

/**
 * 쿠키 값을 StoredConsent로 파싱한다.
 * 어떤 입력에도 throw하지 않는다 — 손상된 쿠키는 null(=미동의)로 취급해
 * 배너를 다시 띄우는 것이 안전한 기본값이다.
 */
export function parseConsentCookie(raw: string | undefined | null): StoredConsent | null {
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null

  const { v, id, analytics, marketing, ts, pv } = parsed as Record<string, unknown>

  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (typeof id !== 'string' || id.length === 0) return null
  if (typeof analytics !== 'boolean') return null
  if (typeof ts !== 'number' || !Number.isFinite(ts)) return null

  return {
    v,
    id,
    analytics,
    marketing: typeof marketing === 'boolean' ? marketing : false,
    ts,
    pv: typeof pv === 'string' ? pv : null,
  }
}
