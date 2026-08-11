/** 동의 쿠키 이름. 값은 URL 인코딩된 JSON이다. */
export const CONSENT_COOKIE_NAME = 'nb_consent'

/** 180일. 만료되면 자연스럽게 재동의를 받는다. */
export const CONSENT_MAX_AGE_SECONDS = 15552000
export const CONSENT_MAX_AGE_MS = CONSENT_MAX_AGE_SECONDS * 1000

export const DEFAULT_BANNER_VERSION = 1
export const DEFAULT_POLICY_SLUG = 'privacy'

/** 이용자가 켜고 끌 수 있는 카테고리. necessary는 항상 켜져 있어 여기 없다. */
export type ConsentChoices = {
  analytics: boolean
  marketing: boolean
}

/** nb_consent 쿠키에 저장되는 형태. */
export type StoredConsent = {
  /** 배너 버전. 사이트 설정값보다 낮으면 동의가 무효가 된다. */
  v: number
  /** 익명 UUID. 재동의해도 유지된다. */
  id: string
  analytics: boolean
  marketing: boolean
  /** 동의 시각 (epoch ms) */
  ts: number
  /** 동의 시점의 개인정보처리방침 버전 */
  pv: string | null
}

/** 저장된 쿠키를 현재 사이트 설정과 대조해 평가한 결과. */
export type ConsentState = {
  /** false면 배너를 노출한다. */
  decided: boolean
  /** 평가 결과와 무관하게 기존 UUID를 유지해 재사용한다. */
  consentId: string | null
  analytics: boolean
  marketing: boolean
  decidedAt: number | null
}

export type ConsentAction = 'accept_all' | 'reject_all' | 'save_custom' | 'withdraw'
