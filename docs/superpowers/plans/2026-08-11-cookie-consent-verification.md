# 쿠키 동의 기능 수동 검증 기록

- 날짜: 2026-08-11
- 브랜치: `feat/cookie-consent` (검증 시점 HEAD: `897a655`)
- 검증자: Claude (Task 11)
- 환경: 로컬 개발 DB `gnu5`@localhost (프로덕션 `nexibase` DB 아님). `npm run dev -- -p 3000`으로 기동.
- 검증 도구: **브라우저를 직접 조작할 수 없어 대부분 `curl`로 SSR 응답과 `Set-Cookie` 헤더를 직접 검사했다.** 실제 브라우저·DevTools가 필요한 항목은 표에 "NOT VERIFIED — requires browser"로 명시하고 대체 불가함을 그대로 남긴다. 추측으로 "통과"라고 적지 않았다.

## Step 1: 전체 테스트 · 빌드 · 타입체크

| 명령 | 결과 |
|---|---|
| `npm test` | exit 0. `# tests 35`, `# pass 35`, `# fail 0`, `# cancelled 0`, `# skipped 0` |
| `npm run build` | exit 0. 정상 완료. (브리핑에서 언급한 `@/plugins/shop/...` 생성 래퍼 문제는 이번 체크아웃에서는 발생하지 않았다 — 별도 조치 불필요) |
| `npx tsc --noEmit 2>&1 \| grep -cE "error TS"` | `29` (기준선 33 이하) |
| 위 출력을 `grep -i consent` | 빈 결과 — consent 관련 오류 0건 |

29건 오류 파일 목록(전부 기존 무관 오류, `.superpowers/sdd/tsc-baseline.txt`의 부분집합): `prisma/seed-auction.ts`, `src/app/api/admin/menus/seed/route.ts`, `src/app/api/admin/plugins/[folder]/activate/route.ts`, `src/plugins/countdown-timer/plugin.ts`, `src/plugins/polls/admin/page.tsx`, `src/plugins/shop/admin/api/orders/[id]/route.ts`, `src/plugins/weather-widget/plugin.ts`, 그리고 `.next/dev/types/validator.ts`가 가리키는 shop/inicis 라우트 누락 10건. consent 관련 파일은 하나도 없다.

**결과: PASS.**

## Step 2: 배너 켜고 개발 서버 기동

- 시작 전 `consent_logs` 최고 `id` 확인: **7** (Task 5 테스트 잔여 행). 이후 기록되는 행은 8번부터가 이번 검증에서 생성한 것이다.
- `settings` 확인: 시작 시점에 이미 `consent_enabled='true'`, `consent_banner_version='1'`이었다. `consent_policy_slug` 행은 없음 → 코드 기본값 `'privacy'`로 동작 (정상, `DEFAULT_POLICY_SLUG`).
- `npx prisma db execute --stdin`은 `--schema prisma/schema.prisma`를 명시해야 동작했다(`Either --url or --schema must be provided` 에러가 없어 그냥 실행하면 실패). 브리핑의 명령에 스키마 플래그를 추가해서 실행.
- `npm run dev -- -p 3000`을 백그라운드로 기동, `curl http://localhost:3000/`로 200 응답 확인 후 진행. 검증 종료 후 프로세스 종료함.
- `/policies/privacy` → HTTP 200 확인. DB에 `policies` 테이블 `slug='privacy', version='1.0', isActive=1` 존재. 배너의 방침 링크가 실제로 유효한 페이지를 가리킴을 확인했다(운영자 전제조건 충족 여부의 근거).

## Step 3: 회귀 방지선 검증 (curl 기반)

브라우저 시크릿 창 대신, 각 소비자 상태를 `curl -b/-c` 쿠키 저장소로 재현하고 SSR 원본 HTML(`curl -s`)과 `Set-Cookie` 헤더(`curl -i`)를 직접 검사했다. "Elements 탭"에 해당하는 항목은 **서버가 실제로 내려보낸 HTML**을 grep한 것이며, 클라이언트 JS 실행 후의 최종 DOM은 아니다 — 이 차이가 의미 있는 항목(8, 9)은 별도로 명시했다.

| # | 절차 | 방법 | 실제 결과 | 판정 |
|---|---|---|---|---|
| 1 | 첫 방문(쿠키 없음) | `curl -s http://localhost:3000/` 후 `grep -c googletagmanager` / 배너 텍스트 검색 | `googletagmanager` 0건. `role="region"` 배너 마크업 1건, "쿠키 사용 동의" 등 배너 문구 실제 렌더링 확인 | **PASS** |
| 2 | Elements에서 `gtag` 검색 | 위 응답 HTML에 대해 `grep -ic gtag` | 0건 — 스크립트 태그 없음 | **PASS** (SSR HTML 기준. 클라이언트 하이드레이션 이후 상태는 미검증) |
| 3 | 배너가 콘텐츠를 가리는지, 스크롤 정상 | — | **NOT VERIFIED — requires browser.** 소스 검토(`ConsentBanner.tsx`)로는 `fixed inset-x-0 bottom-0`이고 모달 오버레이·`overflow` 잠금이 없어 비차단으로 보이나, 실제 스크롤/가림 여부는 사람이 브라우저에서 확인해야 한다 | **NOT VERIFIED** |
| 4 | 수락/거부 버튼 비교 | 소스 코드 검토 (`src/components/consent/ConsentBanner.tsx:46-61`) | 두 버튼 모두 `variant="outline" size="sm"` — 동일 컴포넌트 props. 시각적 픽셀 비교는 아니지만 같은 클래스가 적용되어 크기·모양이 동일함이 코드로 보장됨 | **PASS (소스 검증, 시각적 브라우저 확인 아님)** |
| 5 | "모두 거부" 클릭 | `curl -c jar -X POST /api/consent -d '{"action":"reject_all","analytics":false,"marketing":false}'`, 이어서 같은 jar로 `GET /` | 응답 `Set-Cookie: nb_consent=...HttpOnly...`. 이어진 `GET /`에서 `googletagmanager` 0건, `gtag` 0건, `role="region"` 0건(배너 사라짐), "쿠키 설정" 재진입 버튼 1건(정상) | **PASS** |
| 6 | 새로고침 | 5의 jar로 다시 `GET /` | 배너 재노출 없음(`role="region"` 0건), `googletagmanager`/`gtag` 0건 | **PASS** |
| 7 | `nb_consent` 쿠키 속성 | `curl -i -X POST /api/consent` 응답 헤더 직접 검사 | `Set-Cookie: nb_consent=...; Path=/; Max-Age=15552000; HttpOnly; SameSite=lax` — HttpOnly 확인, Max-Age 15552000 확인. **`Secure` 속성은 관찰되지 않음** — 코드(`src/app/api/consent/route.ts:155`)가 `secure: process.env.NODE_ENV === 'production'`으로 프로덕션에서만 켜도록 되어 있어, 로컬 `next dev`(HTTP)에서는 의도된 동작. 프로덕션 HTTPS 환경에서의 `Secure` 부여는 이번 검증에서 별도로 확인하지 못함 | **PASS** (HttpOnly, Max-Age). **NOT VERIFIED**(프로덕션에서의 Secure 속성, 로컬 HTTP라 관찰 불가) |
| 8 | "쿠키 설정" → 분석 켜고 저장 | `curl -X POST /api/consent -d '{"action":"save_custom","analytics":true,...}'`(기존 jar 재사용), 이어서 `GET /` | 서버 응답 `analytics:true`, 쿠키의 `consentId`가 5번의 값과 동일하게 유지됨. `GET /` SSR HTML에 `<link rel="preload" href="https://www.googletagmanager.com/gtag/js?id=G-G1YDVZ5CE4">` 등장(분석 미동의 상태였던 1·2·5·6번에서는 0건이었던 것과 대비). **그러나 이 링크는 next/script `afterInteractive`가 만드는 프리로드 힌트일 뿐, 실제 네트워크 요청 발생과 `_ga` 쿠키 생성은 클라이언트 JS 실행(하이드레이션 이후)이 필요해 curl로 관찰할 수 없다** | **PARTIALLY VERIFIED** — 서버가 동의 상태에 따라 GA 참조를 조건부로 내려주는 것은 확인. 실제 요청 발생·`_ga` 생성은 **NOT VERIFIED — requires browser** |
| 9 | "쿠키 설정" → 분석 끄고 저장 (철회) | `curl -X POST /api/consent -d '{"action":"withdraw","analytics":false,...}'`(같은 jar) | 서버가 `action=withdraw`로 정확히 기록(DB 확인, 아래 11번 참조), `consentId` 계속 동일 유지, 쿠키 `analytics:false`로 갱신 | **PARTIALLY VERIFIED** — 서버측 기록/쿠키 갱신 확인. `_ga` 쿠키 실제 삭제(`ConsentProvider.tsx`의 `revokeAnalyticsClientSide`)는 클라이언트 JS 실행이 필요해 **NOT VERIFIED — requires browser** |
| 10 | 9 이후 새로고침 | 9의 jar로 `GET /` | `googletagmanager` 0건, `gtag` 0건, 배너 없음, "쿠키 설정" 버튼 존재(decided 상태 유지) | **PASS** |
| 11 | DB `consent_logs` 조회 | `mysql ... -e "SELECT id, consentId, analytics, action FROM consent_logs ORDER BY id;"` | 시작 시점 1–7행은 Task 5 잔여. 이번 검증이 만든 행은 8–12: 상세는 아래 표. **append-only 확인**(UPDATE/DELETE 없이 매 액션이 새 행으로 추가됨) | **PASS** (append-only 동작), 아래 "행 수 관련 사실 그대로 기록" 참조 |
| 12 | `consentId` 동일성 | 위 결과에서 비교 | **9·10·11행(=거부→분석 켬→철회의 연속 시나리오)은 동일한 `consentId`(`ae0ec970-283d-49d1-a3d0-b7c34bf3f935`)를 공유** — 재동의가 새 UUID를 만들지 않음을 증명. 단, **8행과 12행은 검증자가 별도로(쿠키 jar 없이) 실행한 임시 확인 호출**이라 각각 다른 `consentId`를 가짐 — 이는 시스템 결함이 아니라 검증 방식(쿠키를 재사용하지 않은 단발 호출)의 산물임을 명시한다 | **PASS** (연속 세션 내 동일성 확인), 8/12행은 검증자 부산물로 별도 기재 |

### 11번 상세 — 실제 조회 결과

```
id  consentId                             analytics  action
1   e9233037-9e2e-4839-8f1c-cea3660355c5  1          accept_all      ← Task 5 잔여
2   cd4fad35-b4a6-4edb-a6b2-71d96e860ec4  1          accept_all      ← Task 5 잔여
3   cd4fad35-b4a6-4edb-a6b2-71d96e860ec4  0          save_custom     ← Task 5 잔여
4   8ff479a1-809d-48a6-822c-ed3c18e30a2d  0          reject_all      ← Task 5 잔여
5   add6247a-18fb-45fa-a353-5e768c0d1eb9  1          accept_all      ← Task 5 잔여
6   23e9f180-9bc6-427f-976b-5234223306bd  1          save_custom     ← Task 5 잔여
7   512aeff0-2635-4e2c-bd62-115b9df9395d  1          save_custom     ← Task 5 잔여
8   c975b048-5434-4897-8753-84e6f823bcac  0          reject_all      ← 검증자, 쿠키 jar 없이 실행한 예비 호출(부산물)
9   ae0ec970-283d-49d1-a3d0-b7c34bf3f935  0          reject_all      ← 항목 5 (배너에서 "모두 거부")
10  ae0ec970-283d-49d1-a3d0-b7c34bf3f935  1          save_custom     ← 항목 8 (분석 켜고 저장)
11  ae0ec970-283d-49d1-a3d0-b7c34bf3f935  0          withdraw        ← 항목 9 (분석 끄고 저장 = 철회)
12  3166311f-5d73-45bf-b6bb-1688347d9a3e  0          reject_all      ← 검증자, Secure 속성 확인용 예비 호출(부산물)
```

브리핑은 "행 4개(reject_all, save_custom, withdraw + 8번)"를 예상했다. 실제로는 핵심 시나리오(9·10·11행)가 정확히 이 3개 액션을 순서대로, 동일 `consentId`로 기록했다 — 이 부분은 브리핑의 기대와 정확히 일치한다. 다만 검증자가 절차 중간에 쿠키 jar 없이 실행한 2건의 예비 호출(8, 12행)이 추가로 남았다. 이는 시스템의 결함이 아니라 검증 스크립트 작성 과정에서 생긴 부산물이며, 그대로 기록해 둔다(추측으로 숨기지 않음).

## Step 4: 배너 끈 상태 확인 (+1 항목)

```sql
UPDATE settings SET `value`='false' WHERE `key`='consent_enabled';
```

`GET /`(쿠키 없음, 새 방문자 시뮬레이션) 결과:

- 배너 없음 (`role="region"` 0건) — **확인**
- "쿠키 설정" 버튼 없음 (실제 렌더된 `>쿠키 설정<` 마크업 0건 — RSC 페이로드에 문자열 자체는 존재하지만 이는 next-intl이 로케일 전체 메시지를 클라이언트로 내려보내는 부수 현상이고 실제 렌더된 버튼은 아님을 별도로 확인) — **확인**
- GA 요청 0건 (`googletagmanager` 0건, `gtag` 0건) — **확인**

이 3개는 브리핑 Step 4가 요구한 그대로 관찰되었다. **PASS (브리핑 기준).**

확인 후 `UPDATE settings SET value='true' WHERE key='consent_enabled';`로 원복. 원복 후 쿠키 없는 새 방문자에게 배너가 다시 노출됨(`role="region"` 1건, `googletagmanager` 0건)을 재확인했다.

## 해결 기록 — `consent_enabled=false`가 설계 의도와 반대로 동작하던 문제

이 절은 원래 "중대 발견 사항"으로, 이 문제를 미해결 이슈와 두 가지 해결 방향으로 남겨 두었다. 이후 사람이 검토해 방향을 확정했으므로, 그 결정과 조치 결과를 기록으로 남긴다.

**문제였던 것.** `src/app/layout.tsx`의 disabled 분기(`consent.enabled`가 `false`)가 `children`을 그대로 렌더할 뿐 `getMeasurementId()`조차 호출하지 않았다. Task 9에서 예전의 무조건 GA 렌더 경로(`<GoogleAnalytics/>`)가 제거된 뒤였기 때문에, 결과적으로 disabled 상태에서 GA가 전혀 로드되지 않았다. 그런데 `consent_enabled=false`는 이 브랜치로 업그레이드하는 **모든 기존 사이트가 받는 기본값**이며, 설계 문서(`docs/superpowers/specs/2026-08-11-cookie-consent-design.md` §5, §2 결정 사항 표)와 마이그레이션 SQL 주석은 그 기본값의 존재 이유를 "업그레이드 시 GA가 말없이 끊기는 사고 방지"라고 명시하고 있었다. 즉 구현이 막으려던 사고를 그대로 재현하고 있었다.

**어느 쪽이 맞는지.** Task 10의 브리핑(`task-10-brief.md` 91행)은 이 동작을 "의도"라고 명시했지만, 그 결정이 설계 문서 §2/§5/§8과 마이그레이션 주석이 정한 원래 목적을 뒤집는다는 점을 재검토한 기록은 어디에도 없었다. 사람에게 확인한 결과, **스펙 문서가 최종 판단 기준이며 구현 계획(plan) 쪽이 틀렸다**는 것으로 확정되었다. 스펙 문서는 수정하지 않는다 — 처음부터 옳았다.

**실제로 바꾼 것.**
1. `src/components/consent/UngatedAnalytics.tsx`를 새로 만들었다. 이 브랜치 이전에 `src/components/GoogleAnalytics.tsx`가 렌더하던 GA 마크업(`gtag.js` 스크립트 + 인라인 `gtag('config', ...)`)을 그대로 재현하는 순수 컴포넌트로, `useConsent()`를 쓰지 않고 동의 게이팅을 전혀 하지 않는다 — `ConsentProvider` 바깥(= disabled 상태)에서 렌더되기 때문이다.
2. `src/app/layout.tsx`를 고쳤다: `measurementId`를 두 분기 모두에서 쓰도록 `consent.enabled` 조건 없이 무조건 `getMeasurementId()`를 호출하고, disabled 분기를 bare `children`에서 `children` + `<UngatedAnalytics measurementId={measurementId} />`로 바꿨다. enabled 분기(`ConsentProvider` + `GatedAnalytics`)는 그대로 유지했다.
3. 구현 계획 문서(`docs/superpowers/plans/2026-08-11-cookie-consent.md`)의 Task 10 Step 4 서술과 Task 11 릴리스 노트 문구를 이 결정에 맞게 정정했다 — "disabled = GA 완전 정지가 의도"라는 잘못된 서술을 "disabled = 업그레이드 이전과 동일하게 GA가 계속 로드되고, enabled로 전환하는 것이 GA를 동의 게이팅 뒤로 옮기는 스위치"로 바꿨다.
4. 아래 "릴리스 노트" 절도 같은 방향으로 다시 썼다(검증자 주석 삭제, 본문 자체를 수정).

**재검증 결과.**

| 항목 | 명령 | 결과 |
|---|---|---|
| 1a | `npx tsc --noEmit 2>&1 \| grep -E "error TS" \| grep -i -E "consent\|analytics\|layout"` | 출력 없음 |
| 1b | `npx tsc --noEmit 2>&1 \| grep -cE "error TS"` | `19` (기준선 33 이하) |
| 2 | `npm test` | `# tests 35`, `# pass 35`, `# fail 0` |
| 3 | `npm run build` | exit 0, 정상 완료. `@/plugins/shop/...` 관련 생성 래퍼 문제 없음 — 별도 조치 불필요 |
| 4a | `consent_enabled='false'`, 쿠키 없음, `GET /` (dev, port 3000, DB `gnu5`) | `googletagmanager` 참조 2건(`<link rel="preload">` + RSC 페이로드의 `<Script src=...>` 직렬화), 배너 마크업(`role="region"`) 0건 |
| 4b | `consent_enabled='true'`, 쿠키 없음, `GET /` (동일 서버) | `googletagmanager` 참조 0건, 배너 마크업(`role="region"`) 1건 |

4a/4b 모두 이번에 직접 `curl`로 재현·확인했다(Task 11의 기존 curl 방법론을 그대로 사용). `googletagmanager` 참조가 실제 DOM `<script src>` 태그가 아니라 프리로드 힌트 + RSC 하이드레이션 페이로드로 나타나는 것은 `GatedAnalytics`(Task 11에서 이미 확인된 것)와 동일한 `next/script afterInteractive` 특성이며, disabled 경로에 새로 추가한 `UngatedAnalytics`도 같은 메커니즘을 쓰므로 예상된 형태다. 검증 후 `consent_enabled`는 `true`로 되돌렸고 dev 서버는 종료했다.

**결론.** disabled 상태(기존 사이트의 업그레이드 기본값)에서 GA가 게이팅 없이 계속 로드되는 것을 확인했고, enabled 상태에서는 여전히 동의 전 GA 참조가 0건임을 재확인했다 — Task 11이 확립한 회귀 방지선(동의 전 GA 요청 0건)은 깨지지 않았다.

## 그 외 관찰 사항 (버그 아님, 참고용)

- **`Set-Cookie` 값의 2중 URL 인코딩.** 서버 응답의 `nb_consent` 값이 `%257B...`처럼 이중으로 percent-encode되어 나타난다(`serializeConsent`가 한 번 `encodeURIComponent`한 결과를 Next.js의 쿠키 직렬화 계층이 다시 인코딩). 그러나 같은 쿠키를 그대로 재전송했을 때 서버가 정확히 원래 상태로 디코드해 `decided`/`analytics` 값을 올바르게 복원하는 것을 여러 라운드트립(항목 5→6, 8→9→10)에서 확인했다 — 프레임워크 계층에서 투명하게 처리되며 애플리케이션 버그는 아니다.
- **로컬 HTTP에서 `Secure` 속성 부재는 기대된 동작.** `route.ts`가 `NODE_ENV==='production'`일 때만 `Secure`를 설정하므로 `next dev`(HTTP, development)에서는 관찰되지 않는다. 프로덕션 HTTPS 환경에서의 실제 부여는 이번 검증 범위 밖(별도 확인 필요).

## 검증 요약

| 구분 | 개수 |
|---|---|
| PASS | 1(빌드/테스트/타입체크), 1, 2, 4, 5, 6, 7(부분), 10, 11, 12, Step4(3항목) = 코드/서버 레벨로 확인된 항목 다수 |
| PARTIALLY VERIFIED (서버측만 확인, 브라우저 필요 부분 남음) | 8, 9 |
| NOT VERIFIED — requires browser | 3, 7의 프로덕션 Secure 속성, 8의 실제 네트워크 요청·`_ga` 생성, 9의 `_ga` 실제 삭제 |
| 해결됨 | `consent_enabled=false`가 설계 의도(GA 무조건 로드)와 반대로 동작하던 문제 — 위 "해결 기록" 절 참조. `UngatedAnalytics` 추가로 수정, 재검증 통과 |

**가장 중요한 회귀 방지선("동의 전 googletagmanager 요청 0건, DOM에 gtag 스크립트 없음")은 항목 1·2·5·6·10에서 curl로 반복 확인했고 전부 통과했다.** 이 속성 자체는 깨지지 않았다. 다만 위에서 발견한 "꺼진 상태에서 GA가 아예 로드되지 않는" 문제는 별개의, 그러나 이 기능의 존재 이유(기존 사이트 보호)와 직결되는 중요한 사안이다.

---

## 릴리스 노트 (기존 사이트 운영자용)

이번 버전부터 쿠키 동의 배너가 추가되었습니다. **기존 사이트는 꺼진 상태로
업그레이드됩니다.** 이 상태에서는 배너가 보이지 않고, Google Analytics는
업그레이드 이전과 동일하게 계속 수집됩니다 — 아무 조치도 하지 않아도
수집이 끊기지 않습니다.

관리자 설정에서 배너를 켜면 그 순간부터 Google Analytics가 동의 게이팅
뒤로 들어갑니다: 방문자가 분석 쿠키에 동의하기 전까지는 수집되지 않고,
그만큼 수치가 줄어드는 것이 정상입니다.

EU/EEA 방문자가 있는 사이트라면 켜는 것을 권합니다. 켜지 않은 상태는
ePrivacy 지침 5(3)의 사전 동의 요건을 충족하지 않습니다.

배너를 켤 경우 배너에서 개인정보처리방침으로 링크가 걸리므로 **policies
플러그인을 켜고 privacy 정책을 발행해 두어야 합니다.** 방침 페이지 없이
동의를 받으면 정보제공 요건을 충족하지 못합니다.

> **정정 (2026-08-11, Task 11 이후):** 이 절은 최초 작성 시 "켜면" 시나리오만
> 안내하고, 꺼진 기본 상태에서 GA가 어떻게 되는지는 말하지 않았다 — 당시
> 구현이 실제로 GA를 완전히 정지시키고 있었기 때문이다. 그 구현이 설계
> 문서 §5·마이그레이션 의도와 반대였음이 확인되어 코드를 고쳤고(위 "해결
> 기록" 절), 이 문구도 고쳐진 동작(꺼진 상태 = GA 계속 로드)에 맞게
> 다시 썼다.
