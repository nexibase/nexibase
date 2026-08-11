# 쿠키 동의 (Cookie Consent) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동의 전에는 Google Analytics 스크립트가 아예 로드되지 않도록 막고, 카테고리별 동의·철회·서버측 동의 기록을 갖춘 쿠키 동의 기능을 core에 추가한다.

**Architecture:** 동의 상태는 `nb_consent` HttpOnly 쿠키에 저장하고, `force-dynamic`인 루트 레이아웃이 매 요청 서버에서 읽어 초기 상태를 props로 내려준다(깜빡임 없음). 동의가 없으면 `GatedAnalytics`가 아무것도 렌더하지 않아 gtag 스크립트가 DOM에 존재하지 않는다. 동의하는 순간 클라이언트에서 Consent Mode v2 신호와 함께 동적 주입한다. 동의 이력은 append-only `ConsentLog` 테이블에 익명 UUID로 남긴다.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript, Prisma + MySQL, next-intl v4, Radix UI, `node:test` + `tsx --test`

설계 문서: [docs/superpowers/specs/2026-08-11-cookie-consent-design.md](../specs/2026-08-11-cookie-consent-design.md)

## Global Constraints

- 브랜치는 `feat/cookie-consent`. 모든 커밋은 이 브랜치에 쌓는다.
- 커밋 제목은 영어 Conventional Commits, 본문은 영어 → `---` → 한글 순서 (CLAUDE.md).
- **수정 가능한 core 파일은 4개뿐이다:** `src/app/layout.tsx`, `src/components/GoogleAnalytics.tsx`, `prisma/schema.base.prisma`, `src/lib/install/runInstall.ts`. 그 외 기존 파일은 `package.json`, `src/locales/*.json`을 제외하고 수정하지 않는다.
- **`prisma/schema.prisma`와 `src/messages/*.json`은 생성물이다.** 직접 편집 금지. 각각 `prisma/schema.base.prisma`와 `src/locales/*.json`을 편집한다.
- 쿠키 이름은 `nb_consent`, Max-Age는 `15552000`초(180일) 고정.
- `ConsentLog`에 IP·User-Agent를 저장하지 않는다.
- `ConsentLog`는 append-only. 어떤 경로에서도 `update`/`delete`를 호출하지 않는다.
- `ConsentLog.userId`는 Prisma 관계를 걸지 않고 스칼라 `Int?`로만 둔다.
- 마이그레이션 SQL은 MySQL 문법이며 `DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`로 끝낸다 (기존 마이그레이션 관행).
- `getTranslations`는 반드시 `next-intl/server`에서 import한다. `next-intl`에서 가져오면 런타임에 throw한다.
- 마케팅 카테고리는 타입·쿠키·DB 필드로만 존재하고 **UI에 노출하지 않는다.**
- 실패의 기본값은 항상 "추적 안 함"이다. 어떤 오류 경로에서도 동의를 낙관적으로 켜지 않는다.
- `tsc --noEmit`은 착수 시점에 이미 33개의 기존 오류(19개 파일, 전부 consent 무관)를
  낸다. 타입체크 게이트는 "오류 0건"이 아니라 "consent 관련 오류 0건 + 총계 33 이하"다.
- `src/lib/core-withdrawal-policy.ts`도 수정 대상에 포함된다. userId 스칼라를 가진 core
  모델은 빌드 시 withdrawal 정책 선언이 강제되기 때문이다 (Task 3에서 확인됨).

---

## File Structure

**신규**

| 경로 | 책임 |
|---|---|
| `src/lib/consent/types.ts` | 타입·상수 단일 출처 |
| `src/lib/consent/cookie.ts` | 쿠키 문자열 ↔ 객체 변환 (순수, throw 없음) |
| `src/lib/consent/state.ts` | 상태 평가·action 판정 (순수) |
| `src/lib/consent/server.ts` | 서버 전용 — 쿠키·Setting 읽기 |
| `src/lib/consent/cookie.test.ts` | Task 1 테스트 |
| `src/lib/consent/state.test.ts` | Task 2 테스트 |
| `src/app/api/consent/route.ts` | `POST` — 로그 append + Set-Cookie |
| `src/components/consent/ConsentProvider.tsx` | context + 배너·다이얼로그·철회 진입점 마운트 |
| `src/components/consent/ConsentBanner.tsx` | 1단계 배너 |
| `src/components/consent/ConsentPreferences.tsx` | 2단계 다이얼로그 |
| `src/components/consent/GatedAnalytics.tsx` | 동의 시 gtag 주입 |
| `prisma/migrations/20260811000000_add_consent_log/migration.sql` | 테이블 생성 + 기존 설치 플래그 |

**수정**

| 경로 | 변경 |
|---|---|
| `package.json` | `test` 스크립트 추가 |
| `prisma/schema.base.prisma` | `ConsentLog` 모델 추가 |
| `src/lib/install/runInstall.ts` | 신규 설치 시 `consent_enabled='true'` |
| `src/locales/en.json`, `src/locales/ko.json` | `consent` 네임스페이스 추가 |
| `src/components/GoogleAnalytics.tsx` | 렌더링 제거, `getMeasurementId()`만 export |
| `src/app/layout.tsx` | `<head>`의 GA 제거, `<body>`에 Provider + GatedAnalytics |

---

## Task 1: 타입·쿠키 직렬화 + 테스트 러너

**Files:**
- Create: `src/lib/consent/types.ts`
- Create: `src/lib/consent/cookie.ts`
- Test: `src/lib/consent/cookie.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `CONSENT_COOKIE_NAME: 'nb_consent'`, `CONSENT_MAX_AGE_SECONDS: 15552000`, `CONSENT_MAX_AGE_MS: number`, `DEFAULT_BANNER_VERSION: 1`, `DEFAULT_POLICY_SLUG: 'privacy'`
  - `type ConsentChoices = { analytics: boolean; marketing: boolean }`
  - `type StoredConsent = { v: number; id: string; analytics: boolean; marketing: boolean; ts: number; pv: string | null }`
  - `type ConsentState = { decided: boolean; consentId: string | null; analytics: boolean; marketing: boolean; decidedAt: number | null }`
  - `type ConsentAction = 'accept_all' | 'reject_all' | 'save_custom' | 'withdraw'`
  - `serializeConsent(stored: StoredConsent): string`
  - `parseConsentCookie(raw: string | undefined | null): StoredConsent | null`

- [ ] **Step 1: 타입 파일 생성**

`src/lib/consent/types.ts`:

```ts
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
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/lib/consent/cookie.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serializeConsent, parseConsentCookie } from './cookie'
import type { StoredConsent } from './types'

const sample: StoredConsent = {
  v: 1,
  id: '11111111-2222-3333-4444-555555555555',
  analytics: true,
  marketing: false,
  ts: 1754870400000,
  pv: '1.0',
}

test('직렬화 후 파싱하면 원본과 같다', () => {
  assert.deepEqual(parseConsentCookie(serializeConsent(sample)), sample)
})

test('직렬화 결과에 쿠키를 깨뜨리는 문자가 없다', () => {
  const encoded = serializeConsent(sample)
  assert.equal(encoded.includes(';'), false)
  assert.equal(encoded.includes(','), false)
  assert.equal(encoded.includes(' '), false)
})

test('빈 값은 null', () => {
  assert.equal(parseConsentCookie(undefined), null)
  assert.equal(parseConsentCookie(null), null)
  assert.equal(parseConsentCookie(''), null)
})

test('JSON이 아니면 throw하지 않고 null', () => {
  assert.equal(parseConsentCookie('not-json'), null)
  assert.equal(parseConsentCookie('%7Bbroken'), null)
})

test('JSON 배열/원시값은 null', () => {
  assert.equal(parseConsentCookie(encodeURIComponent('[1,2]')), null)
  assert.equal(parseConsentCookie(encodeURIComponent('"str"')), null)
  assert.equal(parseConsentCookie(encodeURIComponent('null')), null)
})

test('필수 필드가 없거나 타입이 다르면 null', () => {
  const bad = [
    { ...sample, v: '1' },
    { ...sample, id: '' },
    { ...sample, analytics: 'yes' },
    { ...sample, ts: Number.NaN },
  ]
  for (const b of bad) {
    assert.equal(parseConsentCookie(encodeURIComponent(JSON.stringify(b))), null)
  }
})

test('marketing 누락은 false로 채운다', () => {
  const { marketing: _omit, ...rest } = sample
  const parsed = parseConsentCookie(encodeURIComponent(JSON.stringify(rest)))
  assert.equal(parsed?.marketing, false)
})

test('pv 누락은 null로 채운다', () => {
  const { pv: _omit, ...rest } = sample
  const parsed = parseConsentCookie(encodeURIComponent(JSON.stringify(rest)))
  assert.equal(parsed?.pv, null)
})
```

- [ ] **Step 3: 테스트 스크립트 추가**

`package.json`의 `scripts`에서 `"lint": "next lint",` 바로 다음 줄에 추가:

```json
    "test": "tsx --test \"src/**/*.test.ts\"",
```

- [ ] **Step 4: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './cookie'`

- [ ] **Step 5: 구현**

`src/lib/consent/cookie.ts`:

```ts
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
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — cookie.test.ts의 8개 테스트 통과

- [ ] **Step 7: 커밋**

```bash
git add src/lib/consent/types.ts src/lib/consent/cookie.ts src/lib/consent/cookie.test.ts package.json
git commit -F - <<'EOF'
feat(consent): add consent cookie types and serialization

Introduces the nb_consent cookie shape and a parser that never throws —
a corrupted or unknown-version cookie resolves to null so the banner is
shown again, which is the safe default. Also wires up `npm test` with
tsx --test, since the repo had node:test files but no runner.

---

nb_consent 쿠키 형태와 파서를 추가한다. 파서는 어떤 입력에도 throw하지
않고 손상된 쿠키를 null로 처리해 배너를 다시 띄운다. 저장소에 node:test
파일은 있었으나 러너가 없어 tsx --test로 npm test를 함께 붙인다.
EOF
```

---

## Task 2: 상태 평가와 action 판정

**Files:**
- Create: `src/lib/consent/state.ts`
- Test: `src/lib/consent/state.test.ts`

**Interfaces:**
- Consumes: Task 1의 `StoredConsent`, `ConsentState`, `ConsentChoices`, `ConsentAction`, `CONSENT_MAX_AGE_MS`
- Produces:
  - `evaluateConsent(stored: StoredConsent | null, currentBannerVersion: number, nowMs: number): ConsentState`
  - `decideAction(previous: ConsentState, next: ConsentChoices): ConsentAction`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/lib/consent/state.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateConsent, decideAction } from './state'
import { CONSENT_MAX_AGE_MS } from './types'
import type { ConsentState, StoredConsent } from './types'

const NOW = 1754870400000
const ID = '11111111-2222-3333-4444-555555555555'

function stored(over: Partial<StoredConsent> = {}): StoredConsent {
  return { v: 1, id: ID, analytics: true, marketing: false, ts: NOW, pv: '1.0', ...over }
}

test('쿠키가 없으면 미결정', () => {
  const s = evaluateConsent(null, 1, NOW)
  assert.equal(s.decided, false)
  assert.equal(s.consentId, null)
  assert.equal(s.analytics, false)
})

test('유효한 쿠키는 결정 상태', () => {
  const s = evaluateConsent(stored(), 1, NOW + 1000)
  assert.equal(s.decided, true)
  assert.equal(s.consentId, ID)
  assert.equal(s.analytics, true)
  assert.equal(s.decidedAt, NOW)
})

test('배너 버전이 낮으면 미결정', () => {
  const s = evaluateConsent(stored({ v: 1 }), 2, NOW)
  assert.equal(s.decided, false)
})

test('배너 버전이 더 높으면 유효로 본다', () => {
  assert.equal(evaluateConsent(stored({ v: 3 }), 2, NOW).decided, true)
})

test('180일이 지나면 미결정', () => {
  assert.equal(evaluateConsent(stored(), 1, NOW + CONSENT_MAX_AGE_MS).decided, false)
})

test('180일 직전은 유효', () => {
  assert.equal(evaluateConsent(stored(), 1, NOW + CONSENT_MAX_AGE_MS - 1).decided, true)
})

test('미결정이어도 consentId는 재사용을 위해 유지한다', () => {
  const s = evaluateConsent(stored({ v: 1 }), 5, NOW)
  assert.equal(s.decided, false)
  assert.equal(s.consentId, ID)
})

test('거부 상태도 결정으로 본다 — 180일간 배너를 다시 띄우지 않는다', () => {
  const s = evaluateConsent(stored({ analytics: false }), 1, NOW + 1000)
  assert.equal(s.decided, true)
  assert.equal(s.analytics, false)
})

function prev(over: Partial<ConsentState> = {}): ConsentState {
  return { decided: true, consentId: ID, analytics: false, marketing: false, decidedAt: NOW, ...over }
}

test('켜져 있던 분석을 끄면 withdraw', () => {
  const a = decideAction(prev({ analytics: true }), { analytics: false, marketing: false })
  assert.equal(a, 'withdraw')
})

test('켜져 있던 마케팅을 끄면 withdraw', () => {
  const a = decideAction(prev({ marketing: true }), { analytics: false, marketing: false })
  assert.equal(a, 'withdraw')
})

test('끔에서 켬은 save_custom', () => {
  const a = decideAction(prev({ analytics: false }), { analytics: true, marketing: false })
  assert.equal(a, 'save_custom')
})

test('변화 없음은 save_custom', () => {
  const a = decideAction(prev({ analytics: true }), { analytics: true, marketing: false })
  assert.equal(a, 'save_custom')
})

test('하나는 켜고 하나는 끄면 withdraw가 이긴다', () => {
  const a = decideAction(prev({ analytics: true, marketing: false }), { analytics: false, marketing: true })
  assert.equal(a, 'withdraw')
})

test('미결정 상태에서의 저장은 withdraw가 아니다', () => {
  const a = decideAction(evaluateConsent(null, 1, NOW), { analytics: false, marketing: false })
  assert.equal(a, 'save_custom')
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test`
Expected: FAIL — `Cannot find module './state'`

- [ ] **Step 3: 구현**

`src/lib/consent/state.ts`:

```ts
import { CONSENT_MAX_AGE_MS } from './types'
import type { ConsentAction, ConsentChoices, ConsentState, StoredConsent } from './types'

/**
 * 저장된 쿠키를 현재 사이트 설정과 대조해 평가한다.
 *
 * 미결정으로 떨어지는 경우에도 consentId는 유지한다. 같은 방문자가 재동의할 때
 * 새 UUID를 만들면 동의 이력이 끊기기 때문이다.
 */
export function evaluateConsent(
  stored: StoredConsent | null,
  currentBannerVersion: number,
  nowMs: number,
): ConsentState {
  const undecided: ConsentState = {
    decided: false,
    consentId: stored?.id ?? null,
    analytics: false,
    marketing: false,
    decidedAt: null,
  }

  if (!stored) return undecided
  // 배너 버전이 올라갔으면 이전 동의는 무효 — 전원 재동의
  if (stored.v < currentBannerVersion) return undecided
  // 180일 경과
  if (nowMs - stored.ts >= CONSENT_MAX_AGE_MS) return undecided

  return {
    decided: true,
    consentId: stored.id,
    analytics: stored.analytics,
    marketing: stored.marketing,
    decidedAt: stored.ts,
  }
}

/**
 * 설정 다이얼로그 저장 시 기록할 action을 정한다.
 *
 * 켜져 있던 카테고리를 끄는 변경이 하나라도 있으면 withdraw다. 철회 이력이
 * 증빙에서 별도로 조회 가능해야 하기 때문에 save_custom과 구분한다.
 */
export function decideAction(previous: ConsentState, next: ConsentChoices): ConsentAction {
  const turnedOff =
    (previous.analytics && !next.analytics) || (previous.marketing && !next.marketing)
  return turnedOff ? 'withdraw' : 'save_custom'
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: PASS — cookie.test.ts 8개 + state.test.ts 14개 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add src/lib/consent/state.ts src/lib/consent/state.test.ts
git commit -F - <<'EOF'
feat(consent): add consent state evaluation and action classification

evaluateConsent decides whether the banner should be shown, treating a
stale banner version or a cookie older than 180 days as undecided while
preserving the anonymous consentId so re-consent does not break the audit
trail. decideAction separates withdrawal from ordinary preference saves.

---

evaluateConsent가 배너 노출 여부를 판정한다. 배너 버전이 낮거나 180일이
지난 쿠키는 미결정으로 보되, 재동의 시 이력이 끊기지 않도록 익명
consentId는 유지한다. decideAction은 철회를 일반 설정 저장과 구분한다.
EOF
```

---

## Task 3: ConsentLog 모델 · 마이그레이션 · 설치 기본값

**Files:**
- Modify: `prisma/schema.base.prisma`
- Create: `prisma/migrations/20260811000000_add_consent_log/migration.sql`
- Modify: `src/lib/install/runInstall.ts:49-55`

**Interfaces:**
- Consumes: 없음
- Produces: Prisma 모델 `ConsentLog` (`prisma.consentLog`), Setting 키 `consent_enabled` / `consent_banner_version` / `consent_policy_slug`

- [ ] **Step 1: Prisma 모델 추가**

`prisma/schema.base.prisma` 맨 끝에 추가:

```prisma
/// 동의 이력. append-only — 철회도 새 행으로 남긴다.
/// IP와 User-Agent는 저장하지 않는다 (데이터 최소화).
model ConsentLog {
  id            Int      @id @default(autoincrement())
  /// 익명 UUID. 로그인 여부와 무관하게 방문자를 묶는 축.
  consentId     String   @db.VarChar(36)
  /// 동의 시점에 로그인 상태였을 때만 채운다. 관계는 걸지 않는다.
  userId        Int?
  analytics     Boolean  @default(false)
  marketing     Boolean  @default(false)
  /// 동의 시점의 활성 개인정보처리방침 버전
  policyVersion String?  @db.VarChar(20)
  bannerVersion String   @db.VarChar(20)
  /// accept_all | reject_all | save_custom | withdraw
  action        String   @db.VarChar(20)
  createdAt     DateTime @default(now())

  @@index([consentId])
  @@index([createdAt])
  @@map("consent_logs")
}
```

- [ ] **Step 2: 마이그레이션 SQL 작성**

`prisma/migrations/20260811000000_add_consent_log/migration.sql`:

```sql
-- CreateTable
CREATE TABLE `consent_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consentId` VARCHAR(36) NOT NULL,
    `userId` INTEGER NULL,
    `analytics` BOOLEAN NOT NULL DEFAULT false,
    `marketing` BOOLEAN NOT NULL DEFAULT false,
    `policyVersion` VARCHAR(20) NULL,
    `bannerVersion` VARCHAR(20) NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consent_logs_consentId_idx`(`consentId`),
    INDEX `consent_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 기존 설치는 배너를 꺼진 상태로 시작한다.
-- 업그레이드 즉시 GA가 말없이 끊기는 것을 막기 위함이며,
-- 운영자가 관리자 설정에서 직접 켜야 한다.
-- 신규 설치는 install wizard가 'true'로 넣으므로 이 INSERT가 실행되지 않는다.
INSERT INTO `settings` (`key`, `value`, `updatedAt`)
SELECT 'consent_enabled', 'false', NOW(3)
FROM DUAL
WHERE EXISTS (SELECT 1 FROM `settings` WHERE `key` = 'site_initialized')
  AND NOT EXISTS (SELECT 1 FROM `settings` WHERE `key` = 'consent_enabled');
```

- [ ] **Step 3: 신규 설치 기본값 추가**

`src/lib/install/runInstall.ts`의 `// 2. Core settings` 블록을 다음으로 교체:

```ts
    // 2. Core settings
    await tx.setting.createMany({
      data: [
        { key: 'site_name', value: params.siteName },
        { key: 'site_locale', value: params.locale },
        { key: 'signup_enabled', value: 'true' },
        // 신규 설치는 동의 배너를 켠 상태로 시작한다 (법적 기본선).
        // 기존 설치는 마이그레이션이 'false'로 넣는다.
        { key: 'consent_enabled', value: 'true' },
        { key: 'consent_banner_version', value: '1' },
        { key: 'consent_policy_slug', value: 'privacy' },
      ],
    })
```

- [ ] **Step 4: 스키마 병합과 생성 확인**

Run: `node scripts/scan-plugins.js && npx prisma generate`
Expected: 오류 없이 완료. `prisma/schema.prisma`에 `model ConsentLog`가 포함된다.

확인: `grep -c "model ConsentLog" prisma/schema.prisma` → `1`

- [ ] **Step 5: 마이그레이션 적용**

Run: `npx prisma migrate deploy`
Expected: `Applying migration '20260811000000_add_consent_log'` 후 성공

확인: `npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM consent_logs;"` 가 오류 없이 실행된다.

- [ ] **Step 6: 타입체크**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -i consent`
Expected: 출력 없음 (consent 관련 오류 0건)

**주의:** 이 저장소의 `tsc --noEmit`은 원래 깨끗하지 않다. 착수 시점 기준으로
19개 파일에 33개의 기존 오류가 있으며 전부 consent와 무관하다. "오류 없음"을
기대하지 말고, **consent 관련 오류가 0건인지**와 전체 개수가 33개를 넘지
않는지로 판단한다. 기준선은 `.superpowers/sdd/tsc-baseline.txt`에 있다.

- [ ] **Step 7: 커밋**

```bash
git add prisma/schema.base.prisma prisma/migrations/20260811000000_add_consent_log src/lib/install/runInstall.ts
git commit -F - <<'EOF'
feat(consent): add ConsentLog model and consent settings

Append-only consent log keyed by an anonymous UUID, storing neither IP
nor User-Agent. Withdrawal is recorded as a new row rather than an update
so the history itself is the evidence. Fresh installs start with the
banner enabled; the migration inserts consent_enabled=false for existing
sites so an upgrade does not silently cut off Google Analytics.

---

익명 UUID를 축으로 하는 append-only 동의 로그를 추가한다. IP와
User-Agent는 저장하지 않는다. 철회는 기존 행 수정이 아니라 새 행으로
남겨 이력 자체가 증빙이 되게 한다. 신규 설치는 배너가 켜진 상태로
시작하고, 기존 사이트는 마이그레이션이 consent_enabled=false를 넣어
업그레이드 시 GA가 말없이 끊기는 것을 막는다.
EOF
```

---

## Task 4: 서버측 동의 판독

**Files:**
- Create: `src/lib/consent/server.ts`

**Interfaces:**
- Consumes: Task 1의 상수·타입, Task 2의 `evaluateConsent`, Task 3의 Setting 키
- Produces:
  - `type ConsentServerContext = { enabled: boolean; bannerVersion: number; policySlug: string; policyVersion: string | null; state: ConsentState }`
  - `readConsentContext(): Promise<ConsentServerContext>`

- [ ] **Step 1: 구현**

`src/lib/consent/server.ts`:

```ts
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { parseConsentCookie } from './cookie'
import { evaluateConsent } from './state'
import {
  CONSENT_COOKIE_NAME,
  DEFAULT_BANNER_VERSION,
  DEFAULT_POLICY_SLUG,
  type ConsentState,
} from './types'

export type ConsentServerContext = {
  enabled: boolean
  bannerVersion: number
  policySlug: string
  /** 현재 활성 개인정보처리방침 버전. policies 플러그인이 없으면 null. */
  policyVersion: string | null
  state: ConsentState
}

/**
 * 쿠키와 사이트 설정을 읽어 동의 컨텍스트를 만든다.
 *
 * DB 오류 시 enabled=false로 떨어진다. 이 경우 GA measurementId 조회도 같이
 * 실패하므로 결과적으로 아무것도 추적되지 않는다 — 실패의 기본값이 "추적 안 함"이다.
 */
export async function readConsentContext(): Promise<ConsentServerContext> {
  let enabled = false
  let bannerVersion = DEFAULT_BANNER_VERSION
  let policySlug = DEFAULT_POLICY_SLUG
  let policyVersion: string | null = null

  try {
    const rows = await prisma.setting.findMany({
      where: {
        key: { in: ['consent_enabled', 'consent_banner_version', 'consent_policy_slug'] },
      },
    })
    const map = new Map(rows.map((r) => [r.key, r.value]))

    enabled = map.get('consent_enabled') === 'true'

    const parsedVersion = Number(map.get('consent_banner_version'))
    if (Number.isInteger(parsedVersion) && parsedVersion > 0) {
      bannerVersion = parsedVersion
    }

    policySlug = map.get('consent_policy_slug')?.trim() || DEFAULT_POLICY_SLUG
  } catch {
    // DB 오류 — 기본값(배너 비활성)을 그대로 쓴다
  }

  try {
    const policy = await prisma.policy.findFirst({
      where: { slug: policySlug, isActive: true },
      select: { version: true },
    })
    policyVersion = policy?.version ?? null
  } catch {
    // policies 플러그인이 비활성이거나 테이블이 없다 — 버전 없이 진행
  }

  const store = await cookies()
  const stored = parseConsentCookie(store.get(CONSENT_COOKIE_NAME)?.value)

  return {
    enabled,
    bannerVersion,
    policySlug,
    policyVersion,
    state: evaluateConsent(stored, bannerVersion, Date.now()),
  }
}
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -i consent`
Expected: 출력 없음 (consent 관련 오류 0건)

**주의:** 이 저장소의 `tsc --noEmit`은 원래 깨끗하지 않다. 착수 시점 기준으로
19개 파일에 33개의 기존 오류가 있으며 전부 consent와 무관하다. "오류 없음"을
기대하지 말고, **consent 관련 오류가 0건인지**와 전체 개수가 33개를 넘지
않는지로 판단한다. 기준선은 `.superpowers/sdd/tsc-baseline.txt`에 있다.

이 파일은 `cookies()`를 쓰므로 서버 전용이다. `server-only` 패키지는 이 저장소에
설치돼 있지 않으므로 import하지 않는다. 클라이언트 컴포넌트에서 실수로 import하면
`cookies()`가 빌드 오류를 내므로 사실상 같은 보호가 걸린다.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/consent/server.ts
git commit -F - <<'EOF'
feat(consent): add server-side consent context reader

Reads the consent cookie alongside the three consent settings and the
active privacy policy version. A DB failure leaves the banner disabled,
which is safe because the GA measurement id lookup fails on the same
outage — nothing gets tracked either way.

---

동의 쿠키와 설정 3개, 활성 개인정보처리방침 버전을 함께 읽는다. DB 오류
시 배너는 비활성으로 떨어지는데, 같은 장애에서 GA measurementId 조회도
실패하므로 어느 쪽이든 아무것도 추적되지 않는다.
EOF
```

---

## Task 5: POST /api/consent

**Files:**
- Create: `src/app/api/consent/route.ts`

**Interfaces:**
- Consumes: Task 1의 `serializeConsent`·상수·타입, Task 4의 `readConsentContext`
- Produces: `POST /api/consent` — 요청 `{ action: ConsentAction, analytics: boolean, marketing?: boolean }`, 응답 `{ ok: true, analytics, marketing }` + `Set-Cookie`

- [ ] **Step 1: 구현**

`src/app/api/consent/route.ts`:

```ts
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
```

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -i consent`
Expected: 출력 없음 (consent 관련 오류 0건)

**주의:** 이 저장소의 `tsc --noEmit`은 원래 깨끗하지 않다. 착수 시점 기준으로
19개 파일에 33개의 기존 오류가 있으며 전부 consent와 무관하다. "오류 없음"을
기대하지 말고, **consent 관련 오류가 0건인지**와 전체 개수가 33개를 넘지
않는지로 판단한다. 기준선은 `.superpowers/sdd/tsc-baseline.txt`에 있다.

- [ ] **Step 3: 수동 동작 확인**

개발 서버를 띄운다: `npm run dev`

먼저 배너를 켠다 (기존 DB라면 마이그레이션이 false로 넣었을 것):

```bash
npx prisma db execute --stdin <<'SQL'
INSERT INTO settings (`key`, `value`, `updatedAt`) VALUES ('consent_enabled','true',NOW(3))
ON DUPLICATE KEY UPDATE `value`='true', `updatedAt`=NOW(3);
INSERT INTO settings (`key`, `value`, `updatedAt`) VALUES ('consent_banner_version','1',NOW(3))
ON DUPLICATE KEY UPDATE `updatedAt`=NOW(3);
SQL
```

요청을 보낸다:

```bash
curl -i -X POST http://localhost:3000/api/consent \
  -H 'Content-Type: application/json' \
  -d '{"action":"accept_all","analytics":true}'
```

Expected: `HTTP/1.1 200`, 응답 본문 `{"ok":true,"analytics":true,"marketing":false}`,
`Set-Cookie: nb_consent=...; Path=/; Max-Age=15552000; HttpOnly; SameSite=lax`

잘못된 입력도 확인한다:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/consent \
  -H 'Content-Type: application/json' -d '{"action":"bogus","analytics":true}'
```

Expected: `400`

행이 정확히 1개 쌓였는지 확인:

```bash
npx prisma db execute --stdin <<< "SELECT consentId, analytics, action, bannerVersion FROM consent_logs ORDER BY id DESC LIMIT 3;"
```

Expected: `accept_all` 행 1개, `bannerVersion` = `1`

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/consent/route.ts
git commit -F - <<'EOF'
feat(consent): add POST /api/consent endpoint

Validates the action, appends exactly one ConsentLog row, then sets the
HttpOnly nb_consent cookie. The cookie is only issued after the DB write
succeeds — on failure the client keeps the banner up rather than
optimistically assuming consent. Existing consentIds are reused so
re-consent does not fragment the audit trail.

---

action을 검증하고 ConsentLog에 정확히 한 행을 append한 뒤 HttpOnly
nb_consent 쿠키를 내린다. DB 기록이 성공한 뒤에만 쿠키를 발급하며,
실패 시 클라이언트는 동의를 낙관적으로 가정하지 않고 배너를 유지한다.
기존 consentId를 재사용해 재동의로 이력이 쪼개지지 않게 한다.
EOF
```

---

## Task 6: i18n 문구

**Files:**
- Modify: `src/locales/ko.json`
- Modify: `src/locales/en.json`

**Interfaces:**
- Consumes: 없음
- Produces: `consent` 네임스페이스 — 키 `title`, `description`, `acceptAll`, `rejectAll`, `settings`, `save`, `close`, `privacyLink`, `reopen`, `error`, `necessaryTitle`, `necessaryDescription`, `analyticsTitle`, `analyticsDescription`, `alwaysOn`

- [ ] **Step 1: 한글 문구 추가**

`src/locales/ko.json`의 최상위에 `consent` 키를 추가한다 (`footer` 다음 위치를 권장):

```json
  "consent": {
    "title": "쿠키 사용 동의",
    "description": "이 사이트는 서비스 운영에 필요한 쿠키를 사용합니다. 방문 통계를 위한 분석 쿠키는 동의하신 경우에만 사용합니다.",
    "acceptAll": "모두 동의",
    "rejectAll": "모두 거부",
    "settings": "설정",
    "save": "저장",
    "close": "닫기",
    "privacyLink": "개인정보처리방침",
    "reopen": "쿠키 설정",
    "error": "저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    "necessaryTitle": "필수 쿠키",
    "necessaryDescription": "로그인 유지와 동의 기록 저장 등 사이트 작동에 반드시 필요합니다. 끌 수 없습니다.",
    "analyticsTitle": "분석 쿠키",
    "analyticsDescription": "방문자 수와 인기 페이지를 파악하는 데 사용합니다. 거부해도 사이트 이용에는 제한이 없습니다.",
    "alwaysOn": "항상 켜짐"
  },
```

- [ ] **Step 2: 영문 문구 추가**

`src/locales/en.json`의 같은 위치에 추가:

```json
  "consent": {
    "title": "Cookie consent",
    "description": "This site uses cookies required to operate the service. Analytics cookies for visit statistics are used only if you agree.",
    "acceptAll": "Accept all",
    "rejectAll": "Reject all",
    "settings": "Settings",
    "save": "Save",
    "close": "Close",
    "privacyLink": "Privacy Policy",
    "reopen": "Cookie settings",
    "error": "Could not save. Please try again in a moment.",
    "necessaryTitle": "Necessary cookies",
    "necessaryDescription": "Required for the site to work, including keeping you signed in and storing your consent record. These cannot be turned off.",
    "analyticsTitle": "Analytics cookies",
    "analyticsDescription": "Used to understand visitor numbers and popular pages. Rejecting them does not limit your use of the site.",
    "alwaysOn": "Always on"
  },
```

- [ ] **Step 3: JSON 유효성과 키 일치 확인**

Run:

```bash
node -e "
const ko=require('./src/locales/ko.json'), en=require('./src/locales/en.json');
const a=Object.keys(ko.consent).sort(), b=Object.keys(en.consent).sort();
if(JSON.stringify(a)!==JSON.stringify(b)) throw new Error('key mismatch');
console.log('ok', a.length, 'keys');
"
```

Expected: `ok 15 keys`

- [ ] **Step 4: 메시지 병합 확인**

Run: `node scripts/scan-plugins.js && node -e "console.log(!!require('./src/messages/ko.json').consent)"`
Expected: `true`

- [ ] **Step 5: 커밋**

```bash
git add src/locales/ko.json src/locales/en.json
git commit -F - <<'EOF'
i18n(consent): add cookie consent strings

Copy states plainly that rejecting analytics does not restrict use of the
site, and that necessary cookies cover the consent record itself.

---

분석 쿠키를 거부해도 사이트 이용에 제한이 없다는 점과, 필수 쿠키에
동의 기록 저장이 포함된다는 점을 문구에 명시한다.
EOF
```

---

## Task 7: ConsentProvider + 배너

**Files:**
- Create: `src/components/consent/ConsentProvider.tsx`
- Create: `src/components/consent/ConsentBanner.tsx`

**Interfaces:**
- Consumes: Task 1의 `ConsentChoices`·`ConsentState`, Task 2의 `decideAction`, Task 5의 `POST /api/consent`, Task 6의 문구 키
- Produces:
  - `type ConsentStrings = Record<'title'|'description'|'acceptAll'|'rejectAll'|'settings'|'save'|'close'|'privacyLink'|'reopen'|'error'|'necessaryTitle'|'necessaryDescription'|'analyticsTitle'|'analyticsDescription'|'alwaysOn', string>`
  - `<ConsentProvider initialState strings privacyHref>{children}</ConsentProvider>`
  - `useConsent(): { state: ConsentState; submitting: boolean; error: boolean; strings: ConsentStrings; privacyHref: string; openPreferences(): void; closePreferences(): void; preferencesOpen: boolean; submit(action, choices): Promise<void> }`

- [ ] **Step 1: Provider 구현**

`src/components/consent/ConsentProvider.tsx`:

```tsx
'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ConsentAction, ConsentChoices, ConsentState } from '@/lib/consent/types'
import { ConsentBanner } from './ConsentBanner'
import { ConsentPreferences } from './ConsentPreferences'

export type ConsentStrings = {
  title: string
  description: string
  acceptAll: string
  rejectAll: string
  settings: string
  save: string
  close: string
  privacyLink: string
  reopen: string
  error: string
  necessaryTitle: string
  necessaryDescription: string
  analyticsTitle: string
  analyticsDescription: string
  alwaysOn: string
}

type ConsentContextValue = {
  state: ConsentState
  submitting: boolean
  error: boolean
  strings: ConsentStrings
  privacyHref: string
  preferencesOpen: boolean
  openPreferences: () => void
  closePreferences: () => void
  submit: (action: ConsentAction, choices: ConsentChoices) => Promise<void>
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider')
  return ctx
}

/** 이미 로드된 gtag에 철회를 알리고 GA 쿠키를 지운다. */
function revokeAnalyticsClientSide() {
  const w = window as unknown as { gtag?: (...args: unknown[]) => void }
  w.gtag?.('consent', 'update', { analytics_storage: 'denied' })

  // _ga, _ga_XXXX, _gid 제거. 도메인 변형까지 훑는다.
  // 정규식은 _ga / _ga_로 시작하는 것과 정확히 _gid만 잡는다.
  // `^_ga|^_gid$` 처럼 쓰면 교차가 잘못 묶여 _gadget 같은 이름까지 지운다.
  const GA_COOKIE = /^_ga($|_)|^_gid$/
  const host = window.location.hostname
  const domains = [host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const raw of document.cookie.split(';')) {
    const name = raw.split('=')[0]?.trim()
    if (!name || !GA_COOKIE.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain}`
    }
    document.cookie = `${name}=; Max-Age=0; path=/`
  }
}

export function ConsentProvider({
  initialState,
  strings,
  privacyHref,
  children,
}: {
  initialState: ConsentState
  strings: ConsentStrings
  privacyHref: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState<ConsentState>(initialState)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(false)
  const [preferencesOpen, setPreferencesOpen] = useState(false)

  const submit = useCallback(
    async (action: ConsentAction, choices: ConsentChoices) => {
      setSubmitting(true)
      setError(false)
      try {
        const res = await fetch('/api/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...choices }),
        })
        if (!res.ok) throw new Error(`consent request failed: ${res.status}`)

        const wasAnalytics = state.analytics
        setState({
          decided: true,
          consentId: state.consentId,
          analytics: choices.analytics,
          marketing: choices.marketing,
          decidedAt: Date.now(),
        })
        setPreferencesOpen(false)

        if (wasAnalytics && !choices.analytics) {
          revokeAnalyticsClientSide()
          // 다음 렌더부터 스크립트 자체가 사라지게 한다
          router.refresh()
        }
      } catch (err) {
        console.error('[consent]', err)
        // 실패 시 동의를 낙관적으로 켜지 않는다 — 배너를 유지한다
        setError(true)
      } finally {
        setSubmitting(false)
      }
    },
    [router, state.analytics, state.consentId],
  )

  const value = useMemo<ConsentContextValue>(
    () => ({
      state,
      submitting,
      error,
      strings,
      privacyHref,
      preferencesOpen,
      openPreferences: () => setPreferencesOpen(true),
      closePreferences: () => setPreferencesOpen(false),
      submit,
    }),
    [state, submitting, error, strings, privacyHref, preferencesOpen, submit],
  )

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {!state.decided && <ConsentBanner />}
      <ConsentPreferences />
      {state.decided && (
        <button
          type="button"
          onClick={() => setPreferencesOpen(true)}
          className="fixed bottom-3 left-3 z-40 rounded-md border border-border bg-background/90 px-3 py-1.5 text-[13px] text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
        >
          {strings.reopen}
        </button>
      )}
    </ConsentContext.Provider>
  )
}
```

- [ ] **Step 2: 배너 구현**

`src/components/consent/ConsentBanner.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useConsent } from './ConsentProvider'

/**
 * 1단계 배너.
 *
 * 법적 제약이 UI에 직접 걸린다:
 * - 비modal. 콘텐츠를 가리거나 스크롤을 막지 않는다 (쿠키월 금지).
 * - 거부 버튼은 수락 버튼과 같은 층위·같은 크기·같은 variant다.
 *   "설정" 뒤에 숨기지 않는다.
 * - 모바일 본문 15px 이상.
 */
export function ConsentBanner() {
  const { strings, privacyHref, submitting, error, submit, openPreferences } = useConsent()

  return (
    <div
      role="region"
      aria-label={strings.title}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-[15px] font-medium">{strings.title}</p>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground sm:text-sm">
            {strings.description}{' '}
            <a href={privacyHref} className="underline underline-offset-2 hover:text-foreground">
              {strings.privacyLink}
            </a>
          </p>
          {error && <p className="mt-2 text-[13px] text-destructive">{strings.error}</p>}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting}
            onClick={openPreferences}
          >
            {strings.settings}
          </Button>
          {/* 거부와 수락은 반드시 동일한 variant/size를 쓴다 */}
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => submit('reject_all', { analytics: false, marketing: false })}
          >
            {strings.rejectAll}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => submit('accept_all', { analytics: true, marketing: false })}
          >
            {strings.acceptAll}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Button variant 확인**

`src/components/ui/button.tsx`에 `default`/`destructive`/`ghost`/`link`/`outline`/`secondary`
variant가 있는 것은 확인되었다. 코드 그대로 쓰면 된다.

확인만 한다 — Run: `grep -c "outline:" src/components/ui/button.tsx`
Expected: `1`

**거부와 수락 버튼의 variant·size를 서로 다르게 바꾸지 말 것.** 시각적 동등성이
법적 요건이다.

- [ ] **Step 4: 커밋** (Task 8에서 `ConsentPreferences`를 만들기 전이라 타입체크는 아직 실패한다 — Task 8 이후 함께 확인)

```bash
git add src/components/consent/ConsentProvider.tsx src/components/consent/ConsentBanner.tsx
git commit -F - <<'EOF'
feat(consent): add consent provider and banner

The banner is non-modal and never blocks content or scrolling, and the
reject button sits at the same level with the same variant and size as
accept — putting refusal behind a "Settings" step is what CNIL fined
Google for. Strings arrive as props because the root layout sits outside
NextIntlClientProvider.

---

배너는 비modal이며 콘텐츠나 스크롤을 막지 않는다. 거부 버튼은 수락과
같은 층위에 같은 variant/size로 둔다 — 거부를 "설정" 뒤로 숨기는 것이
CNIL이 구글에 과징금을 매긴 사유다. 루트 레이아웃이
NextIntlClientProvider 바깥이라 문구는 props로 받는다.
EOF
```

---

## Task 8: 설정 다이얼로그

**Files:**
- Create: `src/components/consent/ConsentPreferences.tsx`

**Interfaces:**
- Consumes: Task 7의 `useConsent`, Task 2의 `decideAction`
- Produces: `<ConsentPreferences />` (props 없음 — context에서 모두 읽는다)

- [ ] **Step 1: 구현**

`src/components/consent/ConsentPreferences.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { decideAction } from '@/lib/consent/state'
import { useConsent } from './ConsentProvider'

/**
 * 2단계 카테고리 다이얼로그. 철회 진입점이기도 하다.
 *
 * 마케팅 카테고리는 현재 게이팅할 스크립트가 없어 노출하지 않는다.
 * 저장 시 marketing은 항상 false로 보낸다.
 */
export function ConsentPreferences() {
  const {
    state,
    strings,
    submitting,
    error,
    preferencesOpen,
    closePreferences,
    submit,
  } = useConsent()

  const [analytics, setAnalytics] = useState(state.analytics)

  // 열 때마다 현재 저장된 상태로 초기화한다.
  // 미결정 상태의 초기값은 꺼짐 — 사전 선택은 유효한 동의가 아니다.
  useEffect(() => {
    if (preferencesOpen) setAnalytics(state.analytics)
  }, [preferencesOpen, state.analytics])

  const handleSave = () => {
    const choices = { analytics, marketing: false }
    submit(decideAction(state, choices), choices)
  }

  return (
    <Dialog open={preferencesOpen} onOpenChange={(open) => !open && closePreferences()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{strings.title}</DialogTitle>
          <DialogDescription className="text-[15px] sm:text-sm">
            {strings.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium sm:text-sm">{strings.necessaryTitle}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {strings.necessaryDescription}
              </p>
            </div>
            <span className="shrink-0 pt-0.5 text-[13px] text-muted-foreground">
              {strings.alwaysOn}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[15px] font-medium sm:text-sm">{strings.analyticsTitle}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {strings.analyticsDescription}
              </p>
            </div>
            <Switch
              checked={analytics}
              onCheckedChange={setAnalytics}
              disabled={submitting}
              aria-label={strings.analyticsTitle}
              className="shrink-0"
            />
          </div>

          {error && <p className="text-[13px] text-destructive">{strings.error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={closePreferences} disabled={submitting}>
            {strings.close}
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={submitting}>
            {strings.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: UI 컴포넌트 확인**

`src/components/ui/dialog.tsx`(`DialogFooter`·`DialogDescription` 포함)와
`src/components/ui/switch.tsx`가 존재하는 것은 확인되었다. 코드 그대로 쓰면 된다.

확인만 한다 — Run: `grep -c "DialogFooter" src/components/ui/dialog.tsx`
Expected: `1` 이상

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -i consent`
Expected: 출력 없음 (consent 관련 오류 0건)

**주의:** 이 저장소의 `tsc --noEmit`은 원래 깨끗하지 않다. 착수 시점 기준으로
19개 파일에 33개의 기존 오류가 있으며 전부 consent와 무관하다. "오류 없음"을
기대하지 말고, **consent 관련 오류가 0건인지**와 전체 개수가 33개를 넘지
않는지로 판단한다. 기준선은 `.superpowers/sdd/tsc-baseline.txt`에 있다. (Task 7의 순환 참조가 해소된다)

- [ ] **Step 4: 커밋**

```bash
git add src/components/consent/ConsentPreferences.tsx
git commit -F - <<'EOF'
feat(consent): add category preferences dialog

Doubles as the withdrawal entry point. The analytics toggle always
initialises from stored state — off when undecided, since a pre-ticked
box is not valid consent. Marketing is omitted because nothing gates on
it yet.

---

철회 진입점을 겸한다. 분석 토글은 항상 저장된 상태로 초기화되며 미결정
상태에서는 꺼짐이다 — 사전 선택된 체크박스는 유효한 동의가 아니다.
마케팅은 아직 게이팅 대상이 없어 노출하지 않는다.
EOF
```

---

## Task 9: GatedAnalytics + GoogleAnalytics 리팩터

**Files:**
- Create: `src/components/consent/GatedAnalytics.tsx`
- Modify: `src/components/GoogleAnalytics.tsx`

**Interfaces:**
- Consumes: Task 7의 `useConsent`
- Produces:
  - `getMeasurementId(): Promise<string | null>` (서버)
  - `<GatedAnalytics measurementId={string | null} />` (클라이언트)

- [ ] **Step 1: GoogleAnalytics를 조회 전용으로 축소**

`src/components/GoogleAnalytics.tsx` 전체를 교체:

```ts
import { prisma } from '@/lib/prisma'

/**
 * 설정된 GA measurement id를 반환한다. 렌더링은 하지 않는다.
 *
 * 실제 스크립트 주입은 동의 이후에만 일어나며 GatedAnalytics가 담당한다.
 * 이 파일이 직접 <Script>를 렌더하면 동의 전에 gtag가 붙어 ePrivacy 5(3)
 * 위반이 된다 — 렌더링 책임을 여기 되돌리지 말 것.
 */
export async function getMeasurementId(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: 'google_analytics_id' },
    })
    const value = row?.value?.trim()
    if (!value || !/^G-[A-Z0-9]+$/i.test(value)) return null
    return value
  } catch {
    return null
  }
}
```

- [ ] **Step 2: GatedAnalytics 구현**

`src/components/consent/GatedAnalytics.tsx`:

```tsx
'use client'

import Script from 'next/script'
import { useConsent } from './ConsentProvider'

/**
 * 분석 동의가 있을 때만 gtag를 주입한다.
 *
 * 동의가 없으면 아무것도 렌더하지 않는다 — 스크립트 태그가 DOM에 존재하지
 * 않고 googletagmanager.com으로 나가는 요청도 0건이다.
 *
 * dataLayer 명령은 gtag.js 로드 전에 큐에 쌓이고 로드 시 순서대로 처리된다.
 * 따라서 consent default → update → config를 하나의 인라인 스크립트에 넣고
 * src 스크립트를 뒤에 두면 순서가 보장된다.
 *
 * `beforeInteractive`는 쓰지 않는다 — Next.js App Router에서 루트 레이아웃
 * 밖의 중첩 클라이언트 컴포넌트에서는 지원되지 않는다.
 */
export function GatedAnalytics({ measurementId }: { measurementId: string | null }) {
  const { state } = useConsent()

  if (!measurementId) return null
  if (!state.analytics) return null

  return (
    <>
      <Script id="ga-consent-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied'
});
gtag('consent', 'update', { analytics_storage: 'granted' });
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
    </>
  )
}
```

- [ ] **Step 3: 이전 GoogleAnalytics 사용처가 없는지 확인**

Run: `grep -rn "GoogleAnalytics" src --include=*.tsx --include=*.ts`
Expected: `src/components/GoogleAnalytics.tsx` 자신과 `src/app/layout.tsx`만 나온다. `layout.tsx`는 Task 10에서 정리한다.

- [ ] **Step 4: 커밋**

```bash
git add src/components/GoogleAnalytics.tsx src/components/consent/GatedAnalytics.tsx
git commit -F - <<'EOF'
feat(consent): gate Google Analytics behind analytics consent

GoogleAnalytics.tsx no longer renders anything — it only resolves the
measurement id. GatedAnalytics injects gtag solely when analytics consent
is present, pushing `consent default: denied` before the script loads so
nothing is stored even momentarily.

---

GoogleAnalytics.tsx는 더 이상 렌더링하지 않고 measurement id 조회만
담당한다. GatedAnalytics는 분석 동의가 있을 때만 gtag를 주입하며,
스크립트 로드 전에 consent default: denied를 먼저 push해 순간적으로도
저장이 일어나지 않게 한다.
EOF
```

---

## Task 10: 루트 레이아웃 배선

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: Task 4의 `readConsentContext`, Task 7의 `ConsentProvider`, Task 9의 `getMeasurementId`·`GatedAnalytics`, Task 6의 문구
- Produces: 없음 (배선 완료)

- [ ] **Step 1: import 교체**

`src/app/layout.tsx`의 다음 줄을 제거:

```ts
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
```

대신 아래를 추가한다 (`loadSiteSettings` import 다음 줄):

```ts
import { getTranslations } from 'next-intl/server'
import { getMeasurementId } from '@/components/GoogleAnalytics'
import { ConsentProvider } from '@/components/consent/ConsentProvider'
import { GatedAnalytics } from '@/components/consent/GatedAnalytics'
import { readConsentContext } from '@/lib/consent/server'
```

`getTranslations`는 반드시 `next-intl/server`에서 가져온다. `next-intl`에서 가져오면 컴파일은 되지만 런타임에 throw한다.

- [ ] **Step 2: `<head>`에서 GA 제거**

`RootLayout`의 `<head>` 블록에서 다음 한 줄을 삭제한다:

```tsx
        <GoogleAnalytics />
```

- [ ] **Step 3: 동의 컨텍스트 로드**

`RootLayout` 함수 본문에서 `const baseStr = ...` 다음에 추가:

```ts
  const consent = await readConsentContext()
  const measurementId = consent.enabled ? await getMeasurementId() : null
  const t = await getTranslations('consent')

  const consentStrings = {
    title: t('title'),
    description: t('description'),
    acceptAll: t('acceptAll'),
    rejectAll: t('rejectAll'),
    settings: t('settings'),
    save: t('save'),
    close: t('close'),
    privacyLink: t('privacyLink'),
    reopen: t('reopen'),
    error: t('error'),
    necessaryTitle: t('necessaryTitle'),
    necessaryDescription: t('necessaryDescription'),
    analyticsTitle: t('analyticsTitle'),
    analyticsDescription: t('analyticsDescription'),
    alwaysOn: t('alwaysOn'),
  }
```

- [ ] **Step 4: `<body>` 배선**

`<body>` 안의 `<SessionProvider>` 블록을 다음으로 교체한다:

```tsx
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {consent.enabled ? (
              <ConsentProvider
                initialState={consent.state}
                strings={consentStrings}
                privacyHref={`/policies/${consent.policySlug}`}
              >
                {children}
                <GatedAnalytics measurementId={measurementId} />
              </ConsentProvider>
            ) : (
              children
            )}
          </ThemeProvider>
        </SessionProvider>
      </body>
```

`consent.enabled`가 false면 Provider도 GatedAnalytics도 마운트되지 않는다. 이 경우 GA는 로드되지 않는다 — 기존 사이트가 배너를 켜기 전까지 GA가 멈추는 것이 의도된 동작이며, 릴리스 노트에 안내한다(Task 11).

- [ ] **Step 5: 정책 경로 확인**

`routing.localePrefix`가 `'never'`이고 scan-plugins가 플러그인 라우트를
`src/app/[locale]/policies/[slug]`로 생성하므로 공개 URL은 `/policies/privacy`다.
이 부분은 확인되었다.

확인만 한다 — Run: `ls -d "src/app/[locale]/policies/[slug]"`
Expected: 디렉터리가 존재한다

policies 플러그인이 비활성인 사이트에서는 이 링크가 404가 된다. `readConsentContext`가
`policyVersion`을 null로 떨어뜨리는 것과 별개로 링크 자체는 남는데, 방침 페이지 없이
동의를 받는 것은 정보제공 요건 미충족이므로 **운영자가 policies 플러그인을 켜두는 것을
전제**로 한다. 릴리스 노트(Task 11)에 명시한다.

- [ ] **Step 6: 타입체크와 빌드**

Run: `npx tsc --noEmit 2>&1 | grep -E "error TS" | grep -i consent`
Expected: 출력 없음 (consent 관련 오류 0건)

**주의:** 이 저장소의 `tsc --noEmit`은 원래 깨끗하지 않다. 착수 시점 기준으로
19개 파일에 33개의 기존 오류가 있으며 전부 consent와 무관하다. "오류 없음"을
기대하지 말고, **consent 관련 오류가 0건인지**와 전체 개수가 33개를 넘지
않는지로 판단한다. 기준선은 `.superpowers/sdd/tsc-baseline.txt`에 있다.

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 7: 커밋**

```bash
git add src/app/layout.tsx
git commit -F - <<'EOF'
feat(consent): wire consent provider into the root layout

Google Analytics leaves <head> and moves under ConsentProvider in <body>,
which is what lets the gate see consent state. Strings are resolved
server-side with getTranslations because the root layout sits outside
NextIntlClientProvider. When consent is disabled neither the provider nor
the analytics gate mounts.

---

Google Analytics를 <head>에서 빼고 <body>의 ConsentProvider 하위로
옮긴다. 그래야 게이트가 동의 상태를 볼 수 있다. 루트 레이아웃이
NextIntlClientProvider 바깥이므로 문구는 서버에서 getTranslations로
해석해 내려준다. 동의 기능이 꺼져 있으면 Provider와 게이트 모두
마운트되지 않는다.
EOF
```

---

## Task 11: 수동 검증과 릴리스 노트

**Files:**
- Create: `docs/superpowers/plans/2026-08-11-cookie-consent-verification.md`

**Interfaces:**
- Consumes: 전체
- Produces: 검증 기록 문서

- [ ] **Step 1: 전체 테스트와 빌드**

Run: `npm test && npm run build`
Expected: 모두 통과. 실패하면 여기서 멈추고 고친다.

이어서 Run: `npx tsc --noEmit 2>&1 | grep -cE "error TS"`
Expected: `33` 이하이고, `| grep -i consent` 했을 때 출력이 없을 것.
기존 오류 33개는 이 작업과 무관한 선재 문제다.

- [ ] **Step 2: 배너 켜고 개발 서버 기동**

```bash
npx prisma db execute --stdin <<'SQL'
INSERT INTO settings (`key`, `value`, `updatedAt`) VALUES ('consent_enabled','true',NOW(3))
ON DUPLICATE KEY UPDATE `value`='true', `updatedAt`=NOW(3);
SQL
npm run dev
```

- [ ] **Step 3: 회귀 방지선 검증**

브라우저를 시크릿 창으로 열고 DevTools Network 탭에서 `googletagmanager` 로 필터한다. 각 항목을 실제로 확인하고 결과를 기록한다.

| # | 절차 | 기대 결과 |
|---|---|---|
| 1 | 시크릿 창으로 첫 방문 | `googletagmanager.com` 요청 **0건**. 배너 노출 |
| 2 | Elements 탭에서 `gtag` 검색 | 스크립트 태그 **없음** |
| 3 | 배너가 콘텐츠를 가리는지 확인 | 스크롤 정상, 본문 접근 가능 |
| 4 | 수락/거부 버튼 비교 | 같은 층위, 같은 크기, 같은 variant |
| 5 | "모두 거부" 클릭 | 요청 여전히 0건. 배너 사라짐 |
| 6 | 새로고침 | 배너 재노출 **안 됨**. 요청 0건 |
| 7 | Application 탭에서 `nb_consent` 확인 | HttpOnly 체크됨, Max-Age 15552000 |
| 8 | "쿠키 설정" → 분석 켜고 저장 | `googletagmanager.com` 요청 발생, `_ga` 쿠키 생성 |
| 9 | "쿠키 설정" → 분석 끄고 저장 | `_ga` 삭제됨 |
| 10 | 9 이후 새로고침 | 스크립트 태그 없음, 요청 0건 |
| 11 | DB에서 `consent_logs` 조회 | 행 4개(reject_all, save_custom, withdraw + 8번) |
| 12 | `consentId`가 모든 행에서 동일한지 | 동일 |

11번 확인 명령:

```bash
npx prisma db execute --stdin <<< "SELECT id, consentId, analytics, action FROM consent_logs ORDER BY id;"
```

- [ ] **Step 4: 배너 끈 상태 확인**

```bash
npx prisma db execute --stdin <<'SQL'
UPDATE settings SET `value`='false' WHERE `key`='consent_enabled';
SQL
```

새로고침 후: 배너 없음, "쿠키 설정" 버튼 없음, GA 요청 0건. 확인 후 다시 `true`로 되돌린다.

- [ ] **Step 5: 검증 기록 작성**

`docs/superpowers/plans/2026-08-11-cookie-consent-verification.md`에 Step 3·4의 12+1개 항목을 실제 결과와 함께 표로 기록한다. 통과하지 못한 항목이 있으면 그대로 적고 원인을 남긴다. 추측으로 "통과"라고 쓰지 않는다.

문서 끝에 운영자용 릴리스 노트를 덧붙인다:

```markdown
## 릴리스 노트 (기존 사이트 운영자용)

이번 버전부터 쿠키 동의 배너가 추가되었습니다. **기존 사이트는 꺼진 상태로
업그레이드됩니다.** 관리자 설정에서 직접 켜야 동작합니다.

켜면 방문자가 분석 쿠키에 동의하기 전까지 Google Analytics가 수집되지
않습니다. 그만큼 수치가 줄어드는 것이 정상입니다.

EU/EEA 방문자가 있는 사이트라면 켜는 것을 권합니다. 켜지 않은 상태는
ePrivacy 지침 5(3)의 사전 동의 요건을 충족하지 않습니다.

배너에서 개인정보처리방침으로 링크가 걸리므로 **policies 플러그인을 켜고
privacy 정책을 발행해 두어야 합니다.** 방침 페이지 없이 동의를 받으면
정보제공 요건을 충족하지 못합니다.
```

- [ ] **Step 6: 커밋**

```bash
git add docs/superpowers/plans/2026-08-11-cookie-consent-verification.md
git commit -F - <<'EOF'
docs(consent): record manual verification results

Captures the regression line that matters — zero googletagmanager
requests before consent — along with withdrawal behaviour and the
append-only log check. Includes release notes for existing operators,
who must enable the banner manually.

---

가장 중요한 회귀 방지선인 "동의 전 googletagmanager 요청 0건"과 철회
동작, append-only 로그 확인 결과를 기록한다. 배너를 직접 켜야 하는 기존
운영자용 릴리스 노트를 포함한다.
EOF
```

---

## Self-Review 결과

**스펙 커버리지**

| 스펙 항목 | 담당 Task |
|---|---|
| 3.1 동의 쿠키 | 1, 5 |
| 3.2 ConsentLog | 3 |
| 3.3 설정 키 3개 | 3, 4 |
| 3.4 파일 구성 | 1–10 |
| 3.5 마운트 위치·i18n props | 6, 10 |
| 3.6 철회 진입점 (테마 비의존) | 7 (Provider가 직접 렌더) |
| 4.1 최초 방문 | 9, 10 / 검증 11-1,2 |
| 4.2 모두 수락 | 5, 7, 9 |
| 4.3 모두 거부 + 180일 억제 | 2, 7 / 검증 11-5,6 |
| 4.4 재방문 | 4, 10 |
| 4.5 설정 변경·철회 | 2, 7, 8 / 검증 11-9,10 |
| 4.6 배너 버전 상향 | 2, 4 |
| 5 예외 처리 | 1(파싱), 4(DB), 5(500), 10(비활성) |
| 6 UI 요건 | 7, 8 |
| 7 테스트 | 1, 2, 11 |
| 8 마이그레이션 | 3, 11(릴리스 노트) |

누락 없음.

**타입 일관성 확인**

- `ConsentState` 필드(`decided`/`consentId`/`analytics`/`marketing`/`decidedAt`)가 Task 1 정의와 2·4·7·8 사용처에서 일치한다.
- `evaluateConsent(stored, currentBannerVersion, nowMs)` 인자 순서가 Task 2 정의와 Task 4 호출에서 일치한다.
- `decideAction(previous, next)` 인자 순서가 Task 2 정의와 Task 8 호출에서 일치한다.
- `getMeasurementId()`가 Task 9에서 정의되고 Task 10에서 같은 이름으로 호출된다.
- `ConsentStrings` 15개 키가 Task 6의 JSON 키, Task 7의 타입, Task 10의 매핑에서 모두 일치한다.
- `CONSENT_MAX_AGE_SECONDS`(초)와 `CONSENT_MAX_AGE_MS`(밀리초)를 구분해서 쓴다 — 쿠키 `maxAge`에는 초, 만료 비교에는 밀리초.

**알려진 순서 의존**

Task 7은 Task 8의 `ConsentPreferences`를 import하므로 Task 7 시점에는 타입체크가 실패한다. Task 8 Step 3에서 함께 통과를 확인한다. 두 파일을 한 커밋으로 합치지 않은 이유는 리뷰 단위를 나누기 위함이다.

**계획 작성 중 검증한 환경 가정**

실제로 확인하고 계획에 반영한 항목이다. 구현자가 다시 의심할 필요는 없다.

- `src/components/ui/button.tsx` — `outline`·`ghost` variant 존재
- `src/components/ui/dialog.tsx` — `DialogFooter`·`DialogDescription` export
- `src/components/ui/switch.tsx` — 존재
- `server-only` 패키지 — **미설치.** 따라서 import하지 않는다
- 공개 정책 URL — `routing.localePrefix: 'never'` + scan-plugins 생성 규칙으로 `/policies/privacy`
- `next/script`의 `beforeInteractive` — 루트 레이아웃 밖 중첩 클라이언트 컴포넌트에서 지원되지 않아 사용하지 않는다. dataLayer 큐잉으로 순서를 보장한다
- 기존 테스트 규약 — `node:test` + `node:assert/strict`, 러너는 미설치라 Task 1에서 추가
