# 쿠키 동의 (Cookie Consent) 설계

- 날짜: 2026-08-11
- 브랜치: `feat/cookie-consent`
- 상태: 설계 승인됨

## 1. 배경과 문제

현재 [src/components/GoogleAnalytics.tsx](../../../src/components/GoogleAnalytics.tsx)가
[src/app/layout.tsx](../../../src/app/layout.tsx)의 `<head>`에서 조건 없이 렌더링된다.
`strategy="afterInteractive"`로 gtag.js가 붙으면서 방문자 동의 이전에 `_ga`/`_gid`
쿠키가 생성된다. 이는 ePrivacy 지침 5(3)의 사전 동의(opt-in) 요건 위반이다.

적용 기준은 다음과 같다.

- **ePrivacy 지침 5(3)** — 단말에 정보를 저장하거나 접근하기 전 동의. 면제는 (a) 통신
  전송의 유일한 목적, (b) 이용자가 명시적으로 요청한 서비스에 엄격히 필요한 경우뿐.
- **GDPR 4(11)·7** — 동의의 유효 요건(자유·구체·정보제공·명확한 적극적 행위), 증빙
  책임(accountability), 철회는 동의만큼 쉬울 것(7(3)).
- **EDPB Guidelines 2/2023** (2024-10-16 채택) — 5(3)의 적용 대상이 쿠키에 국한되지
  않는다. 트래킹 픽셀, 트래킹 URL, localStorage, IP 단독 추적, 고유 식별자 포함.
  따라서 "쿠키 대신 localStorage" 식 우회는 설계에서 배제한다.
- **EDPB Guidelines 03/2022** (다크패턴) 및 각국 DPA 관행 — 거부가 수락만큼 쉬울 것.
  CNIL이 2021년 구글에 1.5억 유로를 부과한 사유가 이 지점이다.

### 아직 법이 아닌 것

Digital Omnibus(2025-11-19 제안)는 쿠키 규칙을 GDPR 88a·88b조로 이관하는 안이나
2026년 8월 현재 삼자협의 중이며 확정되지 않았다. 브라우저 신호를 의무화하는 88b조는
2026-06-18 Council 입장에서 삭제되었다.

이 설계는 **현행법 기준으로 구현**하되, 통과가 유력한 88a(4)(c)의 "거부 후 6개월
재요청 금지"만 선반영한다(180일). 나머지는 확정 후 별도 작업으로 다룬다.

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| 범위 | 표준 준수 | 배너 + 카테고리 동의 + 동의 기록 + 철회 + 재요청 억제 |
| 계층 | Core 기능 | GA가 core에 있어 플러그인은 게이팅 불가. 동의는 법적 베이스라인이라 on/off 옵션이 아님 |
| 적용 대상 | 전체 방문자 | geo 인프라 없음(자체 호스팅). 오판 위험 제거, 한국 PIPA 행태정보 동의에도 재사용 |
| 동의 기록 | 익명 UUID + 서버 append-only 로그 | accountability 충족. IP·UA 미저장으로 최소화 원칙 균형 |
| 차단 방식 | 하이브리드 | SSR 완전 차단 + 동의 시 동적 주입 + Consent Mode v2 |
| 카테고리 | 필수 + 분석 | 마케팅은 게이팅 대상이 없어 UI에서 제외(YAGNI). 스키마·쿠키에는 필드 유지 |
| `consent_enabled` 기본값 | 신규 `true` / 기존 `false` | 업그레이드 시 GA가 말없이 끊기는 사고 방지 |

### 배제한 선택지

- **Consent Mode v2 단독** — gtag.js 로드 자체가 단말 접근에 해당한다는 해석이
  Guidelines 2/2023 기준으로 가능하다. denied 상태에서도 쿠키 없는 핑이 전송된다.
- **EU 방문자만 배너** — geo 판정 수단이 없고, 오판 시 미준수 위험이 남는다.
- **순수 플러그인** — 코어 무변경 원칙상 플러그인은 `layout.tsx`를 수정할 수 없다.
- **쿠키 전용(서버 기록 없음)** — 분쟁 시 동의 사실을 입증할 서버측 근거가 없다.

## 3. 아키텍처

### 3.1 동의 쿠키

- 이름: `nb_consent`
- 값: URL 인코딩 JSON `{ v, id, analytics, marketing, ts, pv }`
  - `v` — 배너 버전(정수), `id` — 익명 UUID, `ts` — 동의 시각(epoch ms)
  - `pv` — 동의 시점의 개인정보처리방침 버전
- 속성: `Path=/; Max-Age=15552000; SameSite=Lax; Secure; HttpOnly`

`HttpOnly`가 가능한 이유는 `layout.tsx`가 이미 `export const dynamic = 'force-dynamic'`
이라 매 요청 서버에서 쿠키를 읽어 초기 상태를 props로 내려줄 수 있기 때문이다.
클라이언트가 쿠키를 직접 읽을 필요가 없고, 배너 노출 여부가 SSR에서 결정되므로
깜빡임(flash)이 없다. 쓰기는 `POST /api/consent` 응답의 `Set-Cookie`로만 일어난다.

이 쿠키 자체는 5(3)(b) 면제 대상(이용자가 요청한 기능에 필수)이므로 동의 없이 설정
가능하다. 닭-달걀 문제가 없다.

`Max-Age`는 180일로 두어 만료 시 자연스럽게 재동의를 받는다.

### 3.2 데이터 모델

`prisma/schema.base.prisma`에 core 모델을 추가한다.

```prisma
model ConsentLog {
  id            Int      @id @default(autoincrement())
  consentId     String   @db.VarChar(36)
  userId        Int?
  analytics     Boolean  @default(false)
  marketing     Boolean  @default(false)
  policyVersion String?  @db.VarChar(20)
  bannerVersion String   @db.VarChar(20)
  action        String   @db.VarChar(20)
  createdAt     DateTime @default(now())

  @@index([consentId])
  @@index([createdAt])
  @@map("consent_logs")
}
```

- `action` — `accept_all` | `reject_all` | `save_custom` | `withdraw`
- **append-only.** 철회는 기존 행을 수정하지 않고 새 행을 추가한다. "언제 동의했고
  언제 철회했다"는 이력 자체가 증빙이다.
- IP·User-Agent는 저장하지 않는다.
- `userId`는 동의 시점에 로그인 상태였을 때만 채운다. Prisma 관계를 걸지 않고
  스칼라로만 둔다(플러그인 User 관계 정책과 동일한 이유).
- `policyVersion`은 `policies` 플러그인의 활성 privacy 정책 버전을 스냅샷한다.

### 3.3 설정 키

`Setting` 테이블(key/value)에 3개를 추가한다.

| 키 | 기본값 | 용도 |
|---|---|---|
| `consent_enabled` | 신규 `true` / 기존 `false` | 배너 및 게이팅 활성화 |
| `consent_banner_version` | `1` | 올리면 전원 재동의 |
| `consent_policy_slug` | `privacy` | 배너에서 링크할 방침 페이지 |

### 3.4 파일 구성

**신규**

| 경로 | 역할 |
|---|---|
| `src/lib/consent/types.ts` | `ConsentCategory`, `ConsentState` 타입 |
| `src/lib/consent/cookie.ts` | 직렬화/파싱 순수 함수 (서버·클라 공용) |
| `src/lib/consent/server.ts` | `readConsent()` — `cookies()`에서 읽어 상태 판정 |
| `src/components/consent/ConsentProvider.tsx` | context + 배너·설정·철회 진입점 마운트 |
| `src/components/consent/ConsentBanner.tsx` | 1단계 배너 |
| `src/components/consent/ConsentPreferences.tsx` | 2단계 카테고리 다이얼로그 |
| `src/components/consent/GatedAnalytics.tsx` | 동의 시 gtag 동적 주입 |
| `src/app/api/consent/route.ts` | `POST` — 로그 append + `Set-Cookie` |

Radix dialog/switch/checkbox가 이미 의존성에 있어 UI 패키지 추가는 없다.
i18n 키는 `src/locales/{en,ko}.json`에 넣는다. `src/messages/`는 생성물이므로
직접 편집하지 않는다.

**수정 (core 3개)**

- `src/app/layout.tsx` — 서버에서 `readConsent()` 호출, `ConsentProvider`로 감싸고
  `<GoogleAnalytics/>`를 `<GatedAnalytics/>`로 교체
- `src/components/GoogleAnalytics.tsx` — `getMeasurementId()` 서버 함수만 남기고
  렌더링 책임을 `GatedAnalytics`로 이관
- `prisma/schema.base.prisma` — `ConsentLog` 추가

### 3.5 철회 진입점의 위치

`src/components/layout/Footer.tsx`는 `src/layouts/default/Footer.tsx`를 재export하는
얇은 shim이다. 즉 푸터는 테마가 소유한다. 철회 링크를 테마 파일에 넣으면 테마를
교체할 때 사라진다.

따라서 **`ConsentProvider`가 철회 진입점을 직접 렌더한다.** GDPR 7(3)의 "철회는
동의만큼 쉬울 것" 요건이 테마 선택에 좌우되어서는 안 된다.

## 4. 데이터 흐름

### 4.1 최초 방문 (쿠키 없음)

1. SSR: `readConsent()` → `null`
2. `ConsentProvider initial={null}` → 배너 렌더
3. `GatedAnalytics`는 아무것도 렌더하지 않음

이 시점에 DOM에 gtag 스크립트가 없고 `googletagmanager.com`으로 나가는 요청이 0건이다.

### 4.2 "모두 수락"

1. 클라이언트 → `POST /api/consent { action: 'accept_all', analytics: true }`
2. 서버: `consentId`는 기존 쿠키 값을 재사용하고, 없으면 `crypto.randomUUID()`
3. 서버: `ConsentLog` insert → `Set-Cookie` → 200
4. 클라이언트 컨텍스트 갱신 → `GatedAnalytics`가 주입:

```
gtag('consent', 'default', { analytics_storage: 'denied' })   // 먼저
→ gtag.js 로드
→ gtag('consent', 'update', { analytics_storage: 'granted' })
→ gtag('config', G-XXXXXXX)
```

`default: denied`를 먼저 push하는 순서가 중요하다. 스크립트 로드 직후의 짧은
순간에도 저장이 일어나지 않게 한다.

배너가 사라진다. 새로고침은 없다.

### 4.3 "모두 거부"

같은 경로에 `analytics: false`. GA는 주입되지 않는다. 쿠키의 `ts`를 기준으로
**180일간 배너를 다시 띄우지 않는다.**

### 4.4 재방문

SSR에서 쿠키를 읽어 `analytics: true`면 배너 없이 `GatedAnalytics`가 처음부터
주입한다. `false`면 배너도 GA도 없다.

### 4.5 설정 변경 및 철회

철회 진입점("쿠키 설정")에서 `ConsentPreferences` 다이얼로그를 연다. 저장 시
`action`은 **이전 상태와 비교해서** 결정한다.

- 켜져 있던 카테고리를 끄는 변경이 하나라도 있으면 → `withdraw`
- 그 외(끔 → 켬, 또는 변화 없음) → `save_custom`

어느 쪽이든 새 로그 행을 append한다. 구분하는 이유는 철회 이력이 증빙에서 별도로
조회 가능해야 하기 때문이다.

분석을 끄는 경우의 후속 처리:

1. 이미 로드된 gtag에 `consent update: denied` 전송
2. `_ga`/`_gid` 쿠키 삭제 시도
3. `router.refresh()` → 다음 렌더부터 스크립트 자체가 사라짐

분석을 켜는 경우는 4.2의 주입 절차와 동일하다.

### 4.6 배너 버전 상향

쿠키의 `v`가 `consent_banner_version`보다 낮으면 SSR에서 동의를 무효로 보고 배너를
재노출한다. 방침 변경 시 전원 재동의를 받는 수단이다.

## 5. 예외 처리

| 상황 | 동작 |
|---|---|
| DB 다운 | `/api/consent` 500. 배너 유지 + 에러 표시. **동의를 낙관적으로 켜지 않는다.** 실패의 기본값은 "추적 안 함" |
| 쿠키 손상·구버전 | `null` 취급 → 배너 재노출. 파싱에서 throw하지 않는다 |
| `consent_enabled=false` | 배너 없음. GA는 기존 동작대로 로드 |
| GA measurementId 미설정 | `GatedAnalytics`가 no-op. 배너는 정상 노출(향후 대비) |
| 봇·크롤러 | 배너는 렌더되나 GA 미주입. 배너가 콘텐츠를 가리지 않아 SEO 영향 없음 |

## 6. UI 요건

법적 요건에서 직접 도출되는 제약이라 구현 재량이 아니다.

- **비modal.** 배너가 콘텐츠를 가리거나 스크롤을 막지 않는다. 쿠키월은 유효한 동의를
  만들지 못한다.
- **거부 버튼은 수락 버튼과 같은 층위·같은 크기·같은 스타일.** 1단계 배너에 바로
  놓는다. "설정" 뒤에 숨기지 않는다.
- 사전 선택 금지. 분석 토글의 초기 상태는 꺼짐이다.
- 방침 페이지 링크를 1단계에 노출한다.
- 모바일 본문 15–16px, 메타 12–13px 이상.

## 7. 테스트

기존 테스트 규약은 `node:test` + `node:assert/strict`이나 러너가 설치되어 있지 않고
`test` 스크립트도 없다(`src/plugins/shop/**/*.test.ts` 3개가 실행 불가 상태). 같은
규약을 유지하되 `tsx --test`로 실제 실행되도록 `package.json`에 스크립트를 추가한다.

**단위**

- `cookie.ts` — 직렬화/파싱 라운드트립, 손상값, 알 수 없는 버전, 누락 필드
- `readConsent()` — 쿠키 없음 / 유효 / 180일 만료 / 배너 버전 낮음
- action 판정 — 켬→끔이 하나라도 있으면 `withdraw`, 끔→켬 및 무변화는 `save_custom`

**통합**

- `POST /api/consent` — action별로 정확히 1행 append
- 기존 `consentId` 재사용 (재동의가 새 ID를 만들지 않음)
- DB 실패 시 500이면서 `Set-Cookie`가 없을 것

**회귀 방지선 (수동 체크리스트)**

- 최초 방문 시 네트워크 탭에 `googletagmanager.com` 요청 **0건**
- 거부 후 새로고침 시에도 0건
- 수락 후 `_ga` 쿠키 생성 확인
- 철회 후 `_ga` 삭제 및 다음 렌더에서 스크립트 부재

## 8. 마이그레이션

1. `ConsentLog` 테이블 생성
2. 기존 설치 판별 — `site_initialized`가 이미 `true`이면 `consent_enabled='false'`를
   삽입한다. 업그레이드 즉시 GA가 끊기는 것을 막는다.
3. 신규 설치는 install wizard에서 `consent_enabled='true'`로 시작한다.
4. 릴리스 노트에 기존 운영자용 안내를 넣는다 — 관리자 설정에서 직접 켜야 하며,
   켜는 순간부터 방문자 동의 전에는 GA가 수집되지 않는다.

## 9. 범위 밖

- 브라우저 신호(GPC / Consent Mode 신호 수신) — 88b조가 Council 입장에서 삭제되어
  확정 후 재검토
- geo 기반 조건부 노출
- 플러그인이 자기 추적 스크립트를 카테고리에 등록하는 API
- 관리자 화면에서의 카테고리·문구 편집 UI (문구는 i18n 파일로 관리)
- 동의 기록 조회·내보내기 관리자 화면
- IAB TCF 연동
