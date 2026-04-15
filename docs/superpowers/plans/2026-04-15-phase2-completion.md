# Phase 2 Completion — Hardcoded Korean Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v0.11.0 Phase 2 이후 잔존하는 UI 하드코딩 한국어 ~93 파일을 `useTranslations` 기반으로 교체하여 완전한 단일 언어(EN/KO) 사이트를 만든다.

**Architecture:** 각 파일마다 `useTranslations('namespace')` 추가 → 하드코딩 한국어 문자열을 `t('key')` 호출로 치환 → 신규 키를 `src/locales/{en,ko}.json` 및 플러그인 locale 파일에 추가 → scan-plugins가 자동 머지.

**Tech Stack:** Next.js 16 · next-intl v4 · TypeScript · scan-plugins 자동 머지

**Audit source:** Task 12 smoke test 후 v0.13.0 커밋 시점 `grep '[가-힣]' src/` 전체 스캔 결과 (93개 UI 파일, ~900 라인 하드코딩 한국어)

---

## Scope

**대상 (93개 UI 파일):**

| 스프린트 | 영역 | 파일 수 | 예상 라인 |
|---|---|---|---|
| Sprint 1 | Core layout & common | 5 | ~60 |
| Sprint 2 | Core admin pages | 6 | ~70 |
| Sprint 3 | Core user pages | 5 | ~35 |
| Sprint 4 | Boards plugin | 8 | ~100 |
| Sprint 5 | Shop user-side routes | 10 | ~200 |
| Sprint 6 | Shop admin-side | 12 | ~180 |
| Sprint 7 | Shop components + misc | 8 | ~60 |
| Sprint 8 | 최종 검증 + v0.14.0 | - | - |

**범위 외 (별도 작업):**
- API 라우트의 Korean 에러 메시지 (서버 응답만, 클라이언트가 `t()`로 래핑 중)
- `src/lib/email.ts` 이메일 템플릿 (Phase 2 Sprint 9에서 이미 일부 처리됨)
- `src/lib/notification.ts` 알림 메시지
- `src/plugins/*/admin/api/seed/route.ts` 관리자 seed 스크립트 내 한국어 샘플 데이터
- `src/app/[locale]/admin/settings/ga-guide/page.tsx` — 123 라인 장문 관리자 가이드 (콘텐츠 작업에 가까움, 다음 작업)
- `src/lib/install/seed-ko.ts` — 의도적으로 한국어 (Korean seed)
- `src/plugins/shop/lib/delivery.ts` — 서버 로직 내 상수 (UI 아님)

---

## Shared Pattern — 모든 태스크의 공통 절차

각 Sprint 태스크에서 서브에이전트는 다음 패턴을 따른다:

### Step A: 대상 파일 읽고 한국어 식별

```bash
grep -n '[가-힣]' <file> | grep -vE '^\s*//|console\.|ko-KR'
```

식별할 것:
- JSX 내 텍스트 노드 (`<h1>최신 작성글</h1>`)
- 문자열 props (`placeholder="비밀번호 입력"`, `title="저장"`)
- 템플릿 리터럴 내 (`` `${name}님 환영합니다` ``)
- `alert()`, `confirm()`, `window.prompt()` 인자
- 에러 메시지 (`throw new Error("...")`) — UI 컴포넌트 내부만

### Step B: Namespace 선택

기존 namespace 재사용 우선:
- `header`, `footer`, `common`, `auth`, `admin`, `mypage`, `profile`, `search`, `lists`, `widgets`, `editor`, `image`, `errors`, `notification`
- 플러그인 영역: `boards`, `contents`, `policies`, `shop`

새 키는 관련 namespace에 추가. namespace가 없으면 `common`에 추가.

### Step C: 키 추가

`src/locales/en.json`과 `src/locales/ko.json` (또는 플러그인 locale 파일)에 key-value 추가:

```json
{
  "namespace": {
    "existingKey": "...",
    "newKey": "English text"
  }
}
```

**플레이스홀더:** `{name}`, `{count}`, `{minutes}` 등 — 양쪽 locale 파일에서 동일하게 유지.

### Step D: 컴포넌트 수정

```tsx
// Before
<h1>최신 작성글</h1>
<Button>저장</Button>

// After
const t = useTranslations('lists')
const tc = useTranslations('common')
...
<h1>{t('newPosts')}</h1>
<Button>{tc('save')}</Button>
```

**규칙:**
- 단일 namespace면 `const t = useTranslations('x')`
- 여러 namespace 필요하면 `tc` (common), `tb` (boards), 등으로 구분
- `'use client'` 컴포넌트면 `useTranslations` (next-intl/react)
- Server component면 `getTranslations`

### Step E: 빌드 검증

```bash
cd /home/kagla/nexibase && node scripts/scan-plugins.js && npx next build 2>&1 | tail -15
```

Expected: clean build. 타입 오류 없음. 새 키가 messages/{en,ko}.json에 머지됨.

### Step F: 커밋

```bash
git add <modified files>
git commit -m "feat(i18n): <sprint>/<file description> 번역"
```

---

## Sprint 1: Core Layout & Common

**대상 (5 files, ~60 lines):**
- `src/layouts/default/Header.tsx` — 32 lines (mobile menu, 드롭다운, 더보기 버튼 등)
- `src/layouts/default/Footer.tsx` — 6 lines (잔여 텍스트)
- `src/components/admin/Sidebar.tsx` — 8 lines
- `src/components/layout/MyPageLayout.tsx` — 8 lines
- `src/components/editors/TiptapEditor.tsx` — 9 lines (이미 Phase 2에서 일부 처리, 잔여 확인)

### Task 1.1: Header 잔여 한국어 정리

**File:** `src/layouts/default/Header.tsx`

- [ ] **Step 1: 한국어 스캔**

Run: `grep -n '[가-힣]' src/layouts/default/Header.tsx | grep -vE '^\s*//|console\.|ko-KR'`
Expected: 32 lines 정도 출력 (더보기·알림·마이페이지·관리자 버튼 라벨, 검색 placeholder, 모바일 메뉴 섹션 타이틀 등)

- [ ] **Step 2: 네임스페이스 선택 + 키 추가**

기존 `header` namespace 사용. 필요한 키를 식별해서 en.json/ko.json에 추가.

예시 (실제로는 전체 목록을 Step 1의 grep 결과에서 도출):
```json
// src/locales/en.json "header":
{
  "more": "More",
  "notifications": "Notifications",
  "mobileMenuTitle": "Menu",
  "loginMenu": "Login",
  "signupMenu": "Sign up",
  ...
}
```

```json
// src/locales/ko.json "header":
{
  "more": "더보기",
  "notifications": "알림",
  ...
}
```

- [ ] **Step 3: 컴포넌트 수정**

`const t = useTranslations('header')` 선언 이미 있음 (line 29). 각 하드코딩 한국어를 `t('key')`로 치환.

예시:
```tsx
// Before
<Button>더보기</Button>

// After
<Button>{t('more')}</Button>
```

각 grep 결과 줄마다 수정.

- [ ] **Step 4: 빌드 검증**

Run: `cd /home/kagla/nexibase && node scripts/scan-plugins.js && npx next build 2>&1 | tail -10`
Expected: clean build.

Verify: `grep -n '[가-힣]' src/layouts/default/Header.tsx | grep -vE '^\s*//|console\.|ko-KR'`
Expected: 0 lines (모든 한국어 제거됨)

- [ ] **Step 5: 커밋**

```bash
git add src/layouts/default/Header.tsx src/locales/en.json src/locales/ko.json
git commit -m "feat(i18n): Header.tsx 잔여 한국어 번역"
```

### Task 1.2: Footer 잔여 한국어 정리

**File:** `src/layouts/default/Footer.tsx`

- [ ] **Step 1-5:** Task 1.1과 동일한 패턴. namespace `footer` 사용.

Run: `grep -n '[가-힣]' src/layouts/default/Footer.tsx | grep -vE '^\s*//|console\.'`
수정 후 빌드 통과 확인, 커밋.

### Task 1.3: Sidebar 번역

**File:** `src/components/admin/Sidebar.tsx`

- [ ] **Step 1-5:** namespace `admin` 사용 (이미 Phase 2에서 일부 처리). 잔여 한국어 8 lines 정리.

Sidebar는 관리자 메뉴 라벨이므로 `admin` namespace의 `sidebar*` prefix 키 추가 권장 (예: `sidebarDashboard`, `sidebarMembers`).

### Task 1.4: MyPageLayout 번역

**File:** `src/components/layout/MyPageLayout.tsx`

- [ ] **Step 1-5:** namespace `mypage` 사용. 8 lines.

### Task 1.5: TiptapEditor 잔여

**File:** `src/components/editors/TiptapEditor.tsx`

- [ ] **Step 1-5:** namespace `editor` 사용. 9 lines (대부분 alert/prompt 메시지, placeholder).

---

## Sprint 2: Core Admin Pages

**대상 (6 files, ~70 lines):**
- `src/app/[locale]/admin/members/page.tsx` — 17 lines
- `src/app/[locale]/admin/settings/page.tsx` — 14 lines (잔여)
- `src/components/admin/MemberForm.tsx` — 16 lines
- `src/components/admin/DashboardContent.tsx` — 10 lines
- `src/app/[locale]/admin/home-widgets/page.tsx` — 7 lines
- `src/lib/types/member.ts` — 7 lines (타입 내 label 상수)

### Task 2.1: admin/members/page.tsx

- [ ] **Step 1-5:** Shared Pattern 적용. namespace `admin` 사용. 상태 라벨·필터 옵션·테이블 헤더 등.

### Task 2.2: admin/settings/page.tsx 잔여

- [ ] **Step 1-5:** namespace `admin` 사용. Phase 3 롤백 후 남은 하드코딩 문자열 확인.

### Task 2.3: MemberForm.tsx

- [ ] **Step 1-5:** namespace `admin` 사용. 폼 라벨·유효성 메시지·alert.

### Task 2.4: DashboardContent.tsx

- [ ] **Step 1-5:** namespace `admin` 사용. 대시보드 통계 라벨·카드 타이틀.

### Task 2.5: admin/home-widgets/page.tsx

- [ ] **Step 1-5:** namespace `admin` 사용. 위젯 zone 라벨 등.

### Task 2.6: lib/types/member.ts 상수 번역

**주의:** 이 파일은 타입 정의 + 상수 객체. Runtime에서 `t()`를 부를 수 없을 수도 있으니 두 가지 접근 중 선택:

(a) 상수를 다른 위치로 옮겨 컴포넌트에서 `t()` 매핑
(b) 상수는 key만 두고(예: `'ACTIVE'`), 컴포넌트에서 라벨 변환 시 `t('memberStatus.active')` 호출

(b) 방식 권장. 구체 절차:
- 상수: `export const MEMBER_STATUSES = ['active', 'inactive', 'suspended', 'deleted'] as const`
- 컴포넌트에서: `t(`memberStatus.${status}`)`
- en.json/ko.json에 `memberStatus.active`, `memberStatus.inactive` 등 키 추가

---

## Sprint 3: Core User Pages

**대상 (5 files, ~35 lines):**
- `src/components/pages/search/SearchPage.tsx` — 13 lines
- `src/components/pages/LatestPage.tsx` — 5 lines
- `src/components/pages/PopularPage.tsx` — 6 lines
- `src/app/install/setup/page.tsx` — 12 lines (이미 LABELS 객체로 일부 처리, 잔여 확인)

### Task 3.1~3.4: 각 페이지별 번역

- [ ] **Step 1-5:** Shared Pattern 적용.
  - SearchPage: namespace `search`
  - LatestPage, PopularPage: namespace `lists`
  - install/setup: 하드코딩 LABELS 객체 유지 (의도적, next-intl 미사용). 누락된 라벨이 있으면 LABELS 객체에 추가.

---

## Sprint 4: Boards Plugin

**대상 (8 files, ~100 lines):**
- `src/plugins/boards/components/BoardPostPage.tsx` — 37 lines
- `src/plugins/boards/components/BoardWritePage.tsx` — 12 lines
- `src/plugins/boards/components/BoardEditPage.tsx` — 11 lines
- `src/plugins/boards/components/BoardListPage.tsx` — 12 lines
- `src/plugins/boards/components/CommentReactions.tsx` — 7 lines
- `src/plugins/boards/admin/page.tsx` — 11 lines
- `src/plugins/boards/admin/[id]/page.tsx` — 7 lines

**Locale 파일:** `src/plugins/boards/locales/en.json` + `ko.json`에 키 추가 (core `locales/*.json` 아님). scan-plugins가 머지함.

### Task 4.1~4.7: 각 파일별 번역

각 파일 Shared Pattern 적용. namespace `boards` (core aspects: comment, attachment, pagination — `boards`에 키 추가하거나 `common` 사용).

**병렬 처리 가능:** 4.1~4.4 (사용자 측)과 4.5~4.7 (관리자 측)을 두 개 그룹으로 나눠 서브에이전트 병렬 파견 가능.

### Task 4.8: Boards 번역 키 추가 (ko.json 플러그인)

- [ ] **Step 1: 서브에이전트 파견**

`src/plugins/boards/locales/ko.json`에 추가된 새 키들의 한국어 번역 확인. 이미 Task 10의 기계 번역으로 기본 키는 있음. Phase 2 완성 작업에서 추가한 신규 키만 한국어 번역 작성.

- [ ] **Step 2-3:** en.json / ko.json 동기화 검증, 커밋

---

## Sprint 5: Shop User-Side Routes

**대상 (10 files, ~200 lines):**
- `src/plugins/shop/routes/orders/[orderNo]/page.tsx` — 52 lines
- `src/plugins/shop/routes/products/[slug]/page.tsx` — 37 lines
- `src/plugins/shop/routes/order/page.tsx` — 36 lines
- `src/plugins/shop/routes/page.tsx` — 13 lines (홈)
- `src/plugins/shop/routes/cart/page.tsx` — 12 lines
- `src/plugins/shop/routes/categories/[slug]/page.tsx` — 11 lines
- `src/plugins/shop/routes/mypage/wishlist/page.tsx` — 6 lines
- `src/plugins/shop/routes/policy/page.tsx` — 5 lines
- `src/plugins/shop/routes/mypage/orders/page.tsx` — 5 lines

**Submodule 주의:** `src/plugins/shop/`는 git submodule. 변경 사항은 submodule 내에서 먼저 커밋 후 메인 repo에서 pointer를 업데이트하는 2-커밋 패턴 필수.

**Locale 파일:** `src/plugins/shop/locales/en.json` + `ko.json` (submodule 내).

### Task 5.1~5.9: 각 페이지별 번역

각 파일 Shared Pattern 적용. namespace `shop`. 필요 시 sub-namespace 사용 (예: `shop.cart.*`, `shop.order.*`).

**병렬 처리:** 세 개 그룹으로 나눠 가능:
- Group A: orders 관련 (orders/[orderNo], mypage/orders)
- Group B: products·categories·shop 홈 (routes/page, products, categories)
- Group C: 기타 (order, cart, wishlist, policy)

### Task 5.10: Shop submodule 번역 커밋 (submodule + main)

- [ ] **Step 1: Submodule 내부 커밋**

```bash
cd src/plugins/shop
git add locales/en.json locales/ko.json routes/
git commit -m "feat(i18n): shop user-side routes 한국어 잔재 번역"
git push origin main
cd ../../..
```

- [ ] **Step 2: Main repo pointer 커밋**

```bash
git add src/plugins/shop
git commit -m "feat(i18n): shop submodule — user routes 번역"
```

---

## Sprint 6: Shop Admin-Side

**대상 (12 files, ~180 lines):**
- `src/plugins/shop/admin/orders/[id]/page.tsx` — 56 lines
- `src/plugins/shop/admin/reviews/page.tsx` — 22 lines
- `src/plugins/shop/admin/settings/page.tsx` — 21 lines
- `src/plugins/shop/admin/sales/page.tsx` — 16 lines
- `src/plugins/shop/admin/qna/page.tsx` — 14 lines
- `src/plugins/shop/admin/products/[id]/page.tsx` — 12 lines
- `src/plugins/shop/admin/products/page.tsx` — 6 lines
- `src/plugins/shop/admin/delivery/page.tsx` — 7 lines
- `src/plugins/shop/admin/orders/page.tsx` — 5 lines
- `src/plugins/shop/admin/categories/page.tsx` — 5 lines
- `src/plugins/shop/admin/page.tsx` — 8 lines
- `src/plugins/shop/admin/menus.ts` — 10 lines (메뉴 상수)

### Task 6.1~6.12: 각 파일별 번역

Shared Pattern. namespace `shop.admin.*` 또는 기존 `shop` 재사용.

**`admin/menus.ts` 주의:** 메뉴 상수는 서버 import 시점에 `t()`를 부를 수 없음. 해결: 상수는 key만 두고, 메뉴 렌더링 컴포넌트에서 `t()` 변환. 또는 Sprint 2 Task 2.6과 동일한 패턴.

**병렬 처리:** 세 개 그룹:
- Group A: orders + products (가장 큰 파일)
- Group B: reviews·qna·sales
- Group C: settings·delivery·categories·page·menus

### Task 6.13: Shop submodule 번역 커밋

Task 5.10과 동일 패턴 (submodule 먼저, main pointer 나중).

---

## Sprint 7: Shop Components + Misc

**대상 (8 files, ~60 lines):**
- `src/plugins/shop/components/ReviewSection.tsx` — 20 lines
- `src/plugins/shop/components/QnaSection.tsx` — 8 lines
- `src/plugins/shop/components/ProductImages.tsx` — 8 lines
- `src/plugins/shop/plugin.ts` — 5 lines (플러그인 메타)
- `src/components/admin/BoardsContent.tsx`, `src/components/admin/UsersContent.tsx` 등 남은 작은 파일 (0-5 lines 단위)

### Task 7.1~7.4: Shop components

Shared Pattern. namespace `shop`.

### Task 7.5: plugin.ts 메타 상수

**주의:** Plugin manifest의 메타 정보. i18n 하기 까다로움. 옵션:
- (a) 메타 파일에는 영문만 유지 + 런타임 번역 매핑
- (b) 현재 한국어 메타 그대로 두고 Phase 2에서 허용 (관리자 전용 표시)

(a) 권장. 상수는 key로 두고 렌더링 시 `t()` 변환.

### Task 7.6: 기타 작은 파일 일괄 정리

- [ ] **Step 1: 잔여 파일 목록**

Run: `grep -rn '[가-힣]' src/ --include='*.tsx' --include='*.ts' | grep -vE "/locales/|/messages/|_generated|^\s*//|console\.|ko-KR|/api/|/seed/|email\.ts|notification\.ts|ga-guide|seed-ko\.ts" | cut -d: -f1 | sort -u`

- [ ] **Step 2: 파일별 수정**

위 grep 결과 목록에서 아직 남은 파일을 하나씩 Shared Pattern으로 처리.

- [ ] **Step 3-5:** 빌드·커밋.

---

## Sprint 8: Final Verification + v0.14.0 Release

### Task 8.1: 전체 UI 한국어 잔여 검증

- [ ] **Step 1: 감사 재실행**

Run:
```bash
grep -rn '[가-힣]' src/ --include='*.tsx' --include='*.ts' 2>/dev/null | \
  grep -vE "/locales/|/messages/|_generated|^\s*//|console\.|ko-KR|/api/|/seed/route|email\.ts|notification\.ts|ga-guide|seed-ko\.ts|\[\.\.\.nextauth\]" | \
  cut -d: -f1 | sort -u
```

Expected: 0 files (또는 의도적으로 제외된 파일만)

만약 남은 파일이 있으면 Sprint 1-7으로 돌아가 처리.

### Task 8.2: 빌드 + 수동 smoke test

- [ ] **Step 1: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -20`
Expected: clean build, 0 errors.

- [ ] **Step 2: 수동 smoke test — 영문 시나리오**

1. `npm run reset-install -- --confirm` 실행
2. dev 서버 재시작
3. 영문으로 install 완료
4. 주요 페이지를 돌아보며 한국어가 노출되지 않는지 확인:
   - `/` 홈
   - `/boards/free`
   - `/boards/free/[postId]` (글 작성 후 확인)
   - `/boards/free/create` 글쓰기
   - `/login` / `/signup`
   - `/mypage`, `/mypage/profile/edit`, `/mypage/login-history`
   - `/admin` 대시보드
   - `/admin/members`, `/admin/boards`, `/admin/menus`, `/admin/settings`, `/admin/policies`, `/admin/contents`
   - `/shop`, `/shop/products/[slug]`, `/shop/cart`, `/shop/order`
   - `/shop/admin`, `/shop/admin/orders`, `/shop/admin/products`, `/shop/admin/reviews`, `/shop/admin/qna`, `/shop/admin/sales`, `/shop/admin/settings`

발견된 한국어는 해당 파일에 추가 번역.

- [ ] **Step 3: 수동 smoke test — 한국어 시나리오**

1. `npm run reset-install -- --confirm`
2. dev 서버 재시작
3. 한국어로 install
4. 위 주요 페이지들이 한국어로 일관되게 표시되는지 확인

### Task 8.3: README 업데이트

`README.md`의 "Known limitations" 섹션에서 "199 files 미번역" 언급을 제거하거나 축소. 대신:
- 완성된 영역 명시
- 남은 범위 외 영역 (API 에러 메시지, seed 스크립트, ga-guide) 명시

### Task 8.4: 버전 업 + 커밋

- [ ] **Step 1: package.json v0.14.0**

```bash
cd /home/kagla/nexibase && node -e "const p=require('./package.json'); p.version='0.14.0'; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n')"
```

- [ ] **Step 2: 커밋 + 푸시**

```bash
git add package.json README.md
git commit -m "chore: v0.14.0 — Phase 2 완성 (UI 하드코딩 한국어 정리)"
git push origin feat/phase2-completion
```

- [ ] **Step 3: PR 생성**

```bash
gh pr create --title "feat(i18n): Phase 2 완성 — UI 하드코딩 한국어 정리 (v0.14.0)" --body "$(cat <<'EOF'
## Summary
Phase 2 (v0.9.0~v0.10.0) 이후 잔존한 ~93개 UI 파일의 하드코딩 한국어를
useTranslations 기반으로 교체. 이제 영문/한국어 install 시 전체 사이트가
일관된 단일 언어로 렌더링됨.

## Scope
- Core layout & common (5 files)
- Core admin pages (6 files)
- Core user pages (5 files)
- Boards plugin (8 files)
- Shop user-side routes (10 files, submodule)
- Shop admin-side (12 files, submodule)
- Shop components + misc (8 files)

## Scope out (별도 작업)
- API 에러 메시지 (서버 응답, 클라이언트 래핑 중)
- src/lib/email.ts 이메일 템플릿
- ga-guide 장문 관리자 가이드
- 일부 플러그인 seed 스크립트의 샘플 데이터

## Test plan
- [x] \`npx next build\` clean
- [x] 영문 install 시나리오 수동 smoke test
- [x] 한국어 install 시나리오 수동 smoke test

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: 머지 + 태그**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull origin main
git tag -a v0.14.0 -m "v0.14.0 — Phase 2 완성"
git push origin v0.14.0
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Shared Pattern 정의 (모든 태스크 재사용)
- ✅ 스프린트별 파일 할당 (93 파일 전체 커버)
- ✅ 병렬 처리 가능 그룹 명시 (Sprint 4, 5, 6)
- ✅ Submodule 커밋 패턴 명시 (Sprint 5, 6)
- ✅ 런타임 상수 처리 방법 (Sprint 2.6, 6.12, 7.5)
- ✅ 최종 검증 + 릴리즈 (Sprint 8)

**Placeholder check:**
- ⚠️ 각 Task 1.1~7.X에 "Shared Pattern 적용"이라고만 써둔 곳 존재. Phase 2 Sprint들이 많아서 모든 파일에 대해 완전한 before/after 코드를 쓰면 플랜이 수천 라인이 됨. Shared Pattern 섹션을 상세히 쓰는 것으로 대체함. 서브에이전트는 파일을 읽고 패턴을 적용할 수 있어야 함.

**Type consistency:**
- 네임스페이스 이름 일관 (header, footer, admin, mypage, search, lists, boards, shop 등 Phase 2 Sprint 1에서 정의된 것 재사용)
- Submodule 커밋 패턴 Sprint 5·6에서 동일

**병렬 처리 계획:**

컨트롤러 에이전트는 다음 순서로 파견:

1. **Sprint 1 (순차)** — Header/Footer/Sidebar 등 core layout은 의존성이 있어 순차 처리
2. **Sprint 2 (순차)** — core admin, 의존성 있음
3. **Sprint 3 (병렬 가능)** — 개별 page 컴포넌트 독립
4. **Sprint 4 (병렬 가능)** — Boards 2 그룹 병렬
5. **Sprint 5 (병렬 가능)** — Shop user-side 3 그룹 병렬 + submodule 커밋 직렬화
6. **Sprint 6 (병렬 가능)** — Shop admin 3 그룹 병렬 + submodule 커밋 직렬화
7. **Sprint 7 (순차)** — 작은 파일 일괄 정리
8. **Sprint 8 (순차)** — 검증 + 릴리즈

**병렬 제약:** Shop submodule 수정이 겹치는 Sprint 5·6은 같은 시점에 다른 파일을 건드리더라도 submodule 커밋 충돌 가능. Sprint 5 완료 후 Sprint 6 시작 권장.

**예상 총 소요 시간:** 5-10시간 (순수 작업). 병렬 처리로 실제 경과 시간은 절반 이하.

---

**Plan complete.**
