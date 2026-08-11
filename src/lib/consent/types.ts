/** 동의 쿠키 이름. 값은 URL 인코딩된 JSON이다. */
export const CONSENT_COOKIE_NAME = 'nb_consent'

/** 180일. 만료되면 자연스럽게 재동의를 받는다. */
export const CONSENT_MAX_AGE_SECONDS = 15552000
export const CONSENT_MAX_AGE_MS = CONSENT_MAX_AGE_SECONDS * 1000

export const DEFAULT_BANNER_VERSION = 1
export const DEFAULT_POLICY_SLUG = 'privacy'

/**
 * `consent_enabled` 설정을 읽은 결과.
 *
 * `'off'`와 `'unknown'`은 반드시 구분한다. `'off'`는 게이팅 없는 GA 로드를
 * 뜻하므로, 설정을 읽지 못한 상태를 `'off'`로 뭉개면 일시적인 DB 오류가
 * "거부"를 누른 방문자에게까지 GA를 붙이게 된다.
 */
export type ConsentSettingsStatus = 'on' | 'off' | 'unknown'

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

/**
 * 클라이언트 컴포넌트에 props로 내려도 되는 상태.
 *
 * `consentId`를 뺀다. 클라이언트 컴포넌트의 props는 React가 flight 페이로드로
 * 직렬화해 SSR HTML에 그대로 박아 넣으므로(`self.__next_f`), 넣는 순간 익명
 * UUID가 페이지 소스에서 아무 스크립트에나 읽힌다 — 쿠키를 `HttpOnly`로 둔
 * 이유가 그대로 무너진다(설계 문서 §3.1).
 *
 * 클라이언트는 이 값을 쓸 일이 없다. `POST /api/consent`는 재사용할 id를
 * 요청 본문이 아니라 쿠키에서 직접 읽는다.
 */
export type ConsentClientState = Omit<ConsentState, 'consentId'>

export type ConsentAction = 'accept_all' | 'reject_all' | 'save_custom' | 'withdraw'
