# 플러그인 아키텍처 설계

## 개요

모든 기능(경매, 쇼핑, 게시판, 컨텐츠, 약관)을 독립 플러그인으로 분리하여 `src/plugins/` 폴더에서 관리한다. 핵심 엔진은 인증, DB, 레이아웃, 메뉴/위젯 인프라만 담당하고, 모든 비즈니스 기능은 플러그인으로 제공한다.

## 핵심 개념

- **모든 기능은 플러그인** — 핵심 플러그인/선택 플러그인 구분 없이 모두 동등
- **컨벤션 기반** — 폴더 구조 자체가 규약. 파일을 넣으면 자동 인식
- **빌드 타임 자동 스캔** — `scripts/scan-plugins.js`가 모든 것을 자동 생성
- **활성화/비활성화** — DB 기반. 비활성 시 라우트 차단, 메뉴/위젯 숨김. 데이터는 보존
- **slug 커스터마이징** — 관리자가 URL 경로를 변경 가능 (서버 재시작 필요)
- **독립 위젯** — 플러그인에 속하지 않는 위젯은 `src/widgets/`에서 관리 (항상 사용 가능)

## 네이밍 규칙

프로젝트 전체에서 **폴더명은 복수형**으로 통일:

- `components/`, `providers/`, `editors/`, `widgets/`, `plugins/`, `layouts/`, `hooks/`, `types/`, `utils/`
- 플러그인 내부도 동일: `routes/`, `components/`, `widgets/`, `menus/`

---

## 플러그인 메타데이터

각 플러그인 폴더에 `plugin.ts` 파일:

```typescript
// src/plugins/auction/plugin.ts
export default {
  name: '경매',
  description: '실시간 경매 시스템',
  version: '1.0.0',
  author: 'nexibase',
  authorDomain: 'https://nexibase.com',
  repository: 'https://github.com/nexibase/plugin-auction',
  slug: 'auction',           // 기본 URL 경로 (관리자가 DB에서 변경 가능)
  defaultEnabled: false,     // 초기 설치 시 비활성
}
```

- `slug`: URL 경로의 기준. 중복 불가 (빌드 시 체크). 관리자가 DB에서 변경 가능
- `defaultEnabled`: 초기 설치 시 활성화 여부

---

## 플러그인 폴더 구조 (컨벤션)

```
src/plugins/auction/
  plugin.ts                 ← 메타데이터 (필수)
  schema.prisma             ← DB 모델 (선택)
  routes/                   ← 사용자 페이지 (선택)
    page.tsx                ← /auction
    [id]/page.tsx           ← /auction/[id]
    [id]/pay/page.tsx       ← /auction/[id]/pay
    create/page.tsx         ← /auction/create
    my/page.tsx             ← /auction/my
  api/                      ← API 엔드포인트 (선택)
    route.ts                ← /api/auction
    [id]/route.ts           ← /api/auction/[id]
    [id]/bid/route.ts       ← /api/auction/[id]/bid
    ...
  admin/                    ← 관리자 (선택)
    page.tsx                ← /admin/auction
    [id]/page.tsx           ← /admin/auction/[id]
    api/route.ts            ← /api/admin/auction
    api/[id]/route.ts       ← /api/admin/auction/[id]
    menus.ts                ← 관리자 사이드바 메뉴 정의
  widgets/                  ← 홈 위젯 (선택, 파일 있으면 자동 등록)
    AuctionLive.tsx
  menus/                    ← 헤더/푸터 메뉴 (선택, 파일 있으면 자동 등록)
    header.ts
  components/               ← 플러그인 내부 컴포넌트 (선택)
    AuctionCard.tsx
    BidForm.tsx
    ...
  lib/                      ← 플러그인 내부 유틸리티 (선택)
    auction-events.ts
    auction-rate-limit.ts
```

`plugin.ts`만 필수이고, 나머지는 모두 선택. 있는 것만 자동으로 인식.

---

## 빌드 스캔 시스템

### `scripts/scan-plugins.js`

`src/plugins/*/`를 스캔하여 3가지를 자동 생성:

#### 1. 플러그인 매니페스트 → `src/plugins/_generated.ts`

```typescript
// 자동 생성 — 직접 수정하지 마세요
export const pluginManifest = {
  'auction': {
    name: '경매',
    slug: 'auction',
    defaultEnabled: false,
    hasRoutes: true,
    hasApi: true,
    hasAdmin: true,
    hasWidgets: true,
    hasMenus: true,
  },
  'boards': {
    name: '게시판',
    slug: 'boards',
    defaultEnabled: true,
    hasRoutes: true,
    hasApi: true,
    hasAdmin: true,
    hasWidgets: false,
    hasMenus: true,
  },
  // ...
}
```

#### 2. Prisma 스키마 병합 → `prisma/schema.prisma`

```
prisma/schema.base.prisma           ← 핵심 모델 (User, Setting, Menu, HomeWidget 등)
+ src/plugins/auction/schema.prisma  ← Auction, Bid, AutoBid
+ src/plugins/shop/schema.prisma     ← Product, Order, ...
+ src/plugins/boards/schema.prisma   ← Board, Post, Comment, ...
+ (비활성 플러그인도 포함)
= prisma/schema.prisma               ← 자동 병합 결과 (직접 수정 X)
```

모든 플러그인의 스키마는 활성/비활성 무관하게 항상 포함. 데이터 보존을 위해.

#### 3. Next.js rewrites → `src/plugins/_rewrites.ts`

```typescript
// next.config.ts에서 import하여 사용
export const pluginRewrites = [
  // 사용자 라우트
  { source: '/auction/:path*', destination: '/plugins/auction/routes/:path*' },
  // API
  { source: '/api/auction/:path*', destination: '/plugins/auction/api/:path*' },
  // 관리자 라우트
  { source: '/admin/auction/:path*', destination: '/plugins/auction/admin/:path*' },
  // 관리자 API
  { source: '/api/admin/auction/:path*', destination: '/plugins/auction/admin/api/:path*' },
]
```

slug가 DB에서 변경된 경우, 스캔 스크립트가 DB를 읽어 변경된 slug를 반영.

#### 4. 중복 체크

- slug 중복 → 빌드 에러, 중단

### package.json 연동

```json
{
  "dev": "node scripts/scan-plugins.js && node scripts/scan-layouts.js && next dev --turbopack",
  "build": "node scripts/scan-plugins.js && node scripts/scan-layouts.js && next build"
}
```

---

## slug 시스템

slug는 플러그인의 모든 URL 경로를 결정:

```
slug: 'auction' 일 때:
  /auction/**          → 사용자 페이지
  /api/auction/**      → API
  /admin/auction/**    → 관리자 페이지
  /api/admin/auction/**→ 관리자 API

관리자가 slug를 'kyungmae'로 변경하면:
  /kyungmae/**         → 사용자 페이지
  /api/kyungmae/**     → API
  /admin/kyungmae/**   → 관리자 페이지
  /api/admin/kyungmae/**→ 관리자 API
```

- 기본값: `plugin.ts`의 `slug` 필드
- 오버라이드: DB Setting 테이블 (`plugin_auction_slug: "kyungmae"`)
- slug 변경 시 서버 재시작 필요 (next.config.ts rewrites 반영)
- 위젯 내부의 링크도 slug를 참조하여 자동으로 변경된 경로 사용

---

## 활성화/비활성화

### DB 저장

Setting 테이블 활용:
- `plugin_auction_enabled`: `"true"` 또는 `"false"`
- `plugin_auction_slug`: `"kyungmae"` (변경한 경우에만)

초기 설치 시 DB에 값이 없으면 `plugin.ts`의 `defaultEnabled`를 사용.

### 활성화 시

1. DB에 `plugin_auction_enabled: "true"` 저장
2. 플러그인의 `menus/header.ts` 정의를 Menu DB에 INSERT (이미 있으면 건너뜀)
3. 플러그인의 `widgets/` 정의를 HomeWidget DB에 INSERT (이미 있으면 건너뜀)
4. 관리자 사이드바에 `admin/menus.ts`의 메뉴 표시

### 비활성화 시

1. DB에 `plugin_auction_enabled: "false"` 저장
2. 라우트 접근 시 404 반환 (미들웨어에서 체크)
3. 메뉴 렌더링 시 비활성 플러그인의 URL에 해당하는 메뉴 숨김
4. 위젯 렌더링 시 비활성 플러그인의 위젯 숨김
5. 관리자 사이드바에서 해당 메뉴 숨김

### 데이터 처리

- 비활성화해도 DB 테이블과 데이터는 그대로 보존
- 비활성이어도 Prisma 스키마에 항상 포함 (데이터 손실 방지)
- 다시 활성화하면 기존 데이터 그대로 사용 가능
- 메뉴/위젯 DB 레코드도 삭제하지 않고 렌더링 시 필터링

### 라우트 차단

`middleware.ts`에서 비활성 플러그인의 slug에 해당하는 요청을 404로 차단:

```
요청: /auction/123
→ auction 플러그인 활성 여부 체크
→ 비활성이면 404 페이지 반환
```

---

## 메뉴/위젯 자동 등록

### 메뉴 정의 파일

```typescript
// src/plugins/auction/menus/header.ts
export default [
  { label: '경매', icon: '🔨', sortOrder: 3 },
]
// URL은 slug에서 자동 생성 (/auction)
```

### 위젯 정의

```typescript
// src/plugins/auction/widgets/AuctionLive.tsx
// 컨벤션: export default로 React 컴포넌트
// 위젯 메타데이터는 컴포넌트와 같은 이름의 .meta.ts 파일에

// src/plugins/auction/widgets/AuctionLive.meta.ts
export default {
  title: '진행중 경매',
  defaultZone: 'main',
  defaultColSpan: 2,
  defaultRowSpan: 1,
  settingsSchema: { limit: 4 },
}
```

### 독립 위젯

플러그인에 속하지 않는 범용 위젯은 `src/widgets/`에서 관리:

```
src/widgets/                        ← 독립 위젯 (항상 사용 가능, 플러그인 무관)
  WelcomeBanner.tsx
  WelcomeBanner.meta.ts
  SiteStats.tsx
  SiteStats.meta.ts
  CommunityGuide.tsx
  CommunityGuide.meta.ts

src/plugins/auction/widgets/        ← 플러그인 위젯 (플러그인 비활성 시 숨김)
  AuctionLive.tsx
  AuctionLive.meta.ts
src/plugins/boards/widgets/
  LatestPosts.tsx
  LatestPosts.meta.ts
  PopularBoards.tsx
  PopularBoards.meta.ts
  BoardCards.tsx
  BoardCards.meta.ts
src/plugins/shop/widgets/
  ShopShortcut.tsx
  ShopShortcut.meta.ts
```

### 등록 흐름

1. 플러그인 활성화 시 `menus/` 폴더의 정의를 읽어 Menu DB에 INSERT
2. `widgets/` 폴더의 정의를 읽어 HomeWidget DB에 INSERT
3. 이미 존재하는 레코드는 건너뜀 (관리자가 수정한 내용 보존)
4. 렌더링 시 플러그인 활성 상태를 체크하여 비활성 플러그인의 메뉴/위젯은 숨김
5. 독립 위젯 (`src/widgets/`)은 항상 표시 (플러그인 상태와 무관)

---

## 관리자 페이지

### 플러그인 관리 (`/admin/plugins`)

- 설치된 플러그인 목록
- 각 플러그인: 이름, 버전, 작성자, 설명, 활성 토글
- slug 변경 (변경 시 서버 재시작 안내)
- 작성자 도메인, 저장소 링크

### 관리자 사이드바

각 플러그인의 `admin/menus.ts`에서 정의한 메뉴를 활성 플러그인만 표시:

```typescript
// src/plugins/auction/admin/menus.ts
export default [
  { label: '경매관리', icon: 'Gavel', path: '/admin/auction' },
]
```

---

## 기존 코드 마이그레이션

### 경매 → `src/plugins/auction/`

| 현재 위치 | 이동 후 |
|-----------|---------|
| `src/app/auction/**` | `plugins/auction/routes/` |
| `src/app/api/auction/**` | `plugins/auction/api/` |
| `src/app/admin/auction/**` | `plugins/auction/admin/` |
| `src/app/api/admin/auction/**` | `plugins/auction/admin/api/` |
| `src/components/auction/**` | `plugins/auction/components/` |
| `src/lib/auction-*.ts` | `plugins/auction/lib/` |
| `src/components/widgets/AuctionLive.tsx` | `plugins/auction/widgets/` |
| Prisma: Auction, Bid, AutoBid | `plugins/auction/schema.prisma` |

### 쇼핑 → `src/plugins/shop/`

| 현재 위치 | 이동 후 |
|-----------|---------|
| `src/app/shop/**` | `plugins/shop/routes/` |
| `src/app/api/shop/**` | `plugins/shop/api/` |
| `src/app/admin/shop/**` | `plugins/shop/admin/` |
| `src/app/api/admin/shop/**` | `plugins/shop/admin/api/` |
| `src/components/pages/shop/**` | `plugins/shop/components/` |
| `src/lib/delivery.ts` | `plugins/shop/lib/` |
| Prisma: Product, Order, ProductCategory, ... | `plugins/shop/schema.prisma` |

### 게시판 → `src/plugins/boards/`

| 현재 위치 | 이동 후 |
|-----------|---------|
| `src/app/boards/**` | `plugins/boards/routes/` |
| `src/app/api/boards/**` | `plugins/boards/api/` |
| `src/app/admin/boards/**` | `plugins/boards/admin/` |
| `src/components/pages/board/**` | `plugins/boards/components/` |
| `src/components/comment/**` | `plugins/boards/components/` |
| Prisma: Board, Post, Comment, Reaction, PostAttachment | `plugins/boards/schema.prisma` |

### 컨텐츠 → `src/plugins/contents/`

| 현재 위치 | 이동 후 |
|-----------|---------|
| `src/app/contents/**` | `plugins/contents/routes/` |
| `src/app/api/contents/**` | `plugins/contents/api/` |
| `src/app/admin/contents/**` | `plugins/contents/admin/` |
| `src/components/pages/content/**` | `plugins/contents/components/` |
| Prisma: Content | `plugins/contents/schema.prisma` |

### 약관 → `src/plugins/policies/`

| 현재 위치 | 이동 후 |
|-----------|---------|
| `src/app/policies/**` | `plugins/policies/routes/` |
| `src/app/api/policies/**` | `plugins/policies/api/` |
| `src/app/admin/policies/**` | `plugins/policies/admin/` |
| `src/components/pages/policy/**` | `plugins/policies/components/` |
| Prisma: Policy | `plugins/policies/schema.prisma` |

### 핵심 엔진에 남는 것

| 카테고리 | 파일들 |
|----------|--------|
| 인증 | `src/app/(auth)/`, `src/app/api/auth/`, `src/lib/auth.ts` |
| 관리자 기본 | `src/app/admin/page.tsx` (대시보드), `settings/`, `users/`, `plugins/` |
| 공통 UI | `src/components/ui/` (ShadCN), `src/components/layout/` |
| 공통 lib | `src/lib/prisma.ts`, `src/lib/email.ts`, `src/lib/sanitize.ts`, `src/lib/notification.ts` |
| 공통 providers | `src/components/providers/` |
| 공통 editors | `src/components/editors/` |
| 레이아웃 | `src/layouts/` |
| 독립 위젯 | `src/widgets/` (WelcomeBanner, SiteStats, CommunityGuide) |
| 메뉴/위젯 인프라 | `src/lib/widgets/`, 메뉴/위젯 API |
| 홈/검색/인기 | `src/app/page.tsx`, `src/app/search/`, `src/app/popular/`, `src/app/latest/` |
| Prisma 기본 | `prisma/schema.base.prisma` (User, Setting, Menu, HomeWidget, Account, Notification, ...) |

---

## 에러 처리

- slug 중복 → 빌드 에러
- `plugin.ts` 없는 폴더 → 무시 (경고만 출력)
- 비활성 플러그인 라우트 접근 → 404
- 스키마 병합 실패 → 빌드 에러 (모델명 충돌 등)
- 위젯/메뉴 등록 실패 → 콘솔 에러, 다른 플러그인에 영향 없음

---

## 새 플러그인 만들기 (개발자 가이드)

1. `src/plugins/my-feature/` 폴더 생성
2. `plugin.ts` 작성 (이름, slug 등)
3. 필요한 폴더 추가 (routes/, api/, widgets/, menus/ 등)
4. DB 모델이 필요하면 `schema.prisma` 작성
5. `npm run dev` → 자동 인식
6. 관리자 페이지에서 활성화
7. 프로덕션: `npm run build` → 배포
