# Visitor Analytics — 방문 로깅 및 접속자 통계

**Date:** 2026-04-09
**Status:** Approved, ready for implementation

## 목표

NexiBase 코어에 **방문 로깅 + 접속자 통계 위젯**을 기본 기능으로 추가한다. 모든 NexiBase 사이트에서 별도 설정 없이 방문자 수를 추적하고 위젯으로 볼 수 있게 한다.

## 배경 / 동기

- 기존 `google_analytics_id` 설정은 외부 GA로 데이터를 보내기만 할 뿐, 사이트 자체에서 접속자 수치를 즉시 볼 수 없다.
- 관리자나 방문자에게 "지금 몇 명이 접속 중"을 보여주려면 GA Data API 연동(복잡한 서비스 계정 설정)을 하거나 자체 트래킹이 필요한데, GA Data API 연동은 설정 부담이 크다.
- 로그는 어차피 남겨야 하는 데이터이므로 코어에서 기본 제공하면 각 NexiBase 사이트(및 플러그인)가 즉시 활용할 수 있다.

## 범위

### 포함
- `VisitLog` 모델 (schema.base.prisma)
- `logVisit()` 헬퍼 (봇 필터링, 세션 쿠키, 경로 필터)
- `proxy.ts`의 `x-nexibase-path` 헤더 주입
- `RootLayout`에서 `after()`로 비차단 로깅
- `/api/analytics/stats` API + 인메모리 캐시 (TTL 120초)
- `VisitorStats` 위젯 (스켈레톤 로딩 + 120초 폴링)
- `isbot` 의존성 추가

### 제외 (나중에 별도 작업)
- 로그 자동 정리 (90일 이상 삭제 등 보관 정책)
- 관리자 상세 분석 페이지 (`/admin/analytics`)
- IP 마스킹 옵션 (관리자만 보므로 그대로 저장)
- 봇 트래픽 기록 옵션 (현재는 봇 완전 제외)
- 차트/그래프 (단순 숫자만)

## 아키텍처

```
 ┌──────────────┐
 │   Browser    │
 └──────┬───────┘
        │ page request
        ▼
 ┌──────────────┐   x-nexibase-path 헤더 주입
 │  proxy.ts    │────────────────────┐
 └──────┬───────┘                    │
        │                            ▼
        ▼                    ┌───────────────┐
 ┌──────────────┐            │  RootLayout   │
 │  Next.js     │───────────▶│               │
 │  render      │            │  after(() =>  │
 └──────┬───────┘            │   logVisit()) │
        │                    └───────┬───────┘
        ▼                            │
 ┌──────────────┐            (응답 후 백그라운드)
 │   Response   │                    │
 └──────┬───────┘                    ▼
        │                    ┌───────────────┐
        │                    │   VisitLog    │
        │                    │   (DB write)  │
        │                    └───────────────┘
        ▼
 (page loaded)
 VisitorStats widget
        │
        ▼ fetch (폴링 120초)
 ┌────────────────────────┐
 │ /api/analytics/stats   │
 │ ┌────────────────────┐ │
 │ │ in-memory cache    │ │
 │ │ (TTL 120s)         │ │
 │ └────────────────────┘ │
 │   cache miss → Prisma  │
 └────────────────────────┘
```

## 컴포넌트

### 1. Prisma 모델 — `prisma/schema.base.prisma`

```prisma
model VisitLog {
  id        Int      @id @default(autoincrement())
  sessionId String   @db.VarChar(64)
  userId    Int?
  ip        String   @db.VarChar(45)
  path      String   @db.VarChar(500)
  referer   String?  @db.VarChar(500)
  userAgent String?  @db.VarChar(500)
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@index([sessionId, createdAt])
  @@map("visit_logs")
}
```

- `sessionId` VarChar(64): 랜덤 32바이트 hex (64자)
- `ip` VarChar(45): IPv6 최대 길이
- `path`/`referer`/`userAgent` VarChar(500): 과도한 길이 방지 차원

### 2. 로깅 헬퍼 — `src/lib/visitLogger.ts`

**공개 함수:** `logVisit(userId?: number | null): Promise<void>`

**동작:**
1. `headers()`에서 User-Agent 조회 → `isbot(ua)`면 즉시 return
2. `headers()`의 `x-nexibase-path`에서 pathname 조회 (fallback: referer, 기본 `/`)
3. `shouldSkip(pathname)` → `true`면 return
4. `x-forwarded-for` → `x-real-ip` 순으로 IP 추출 (45자 제한)
5. `cookies()`에서 `nb_visit_sid` 쿠키 조회
   - 없으면 `randomBytes(32).toString('hex')` 생성 후 `cookies().set()`
   - `httpOnly: true`, `sameSite: 'lax'`, `maxAge: 30 * 24 * 60 * 60`
6. `prisma.visitLog.create({...})` 실행
7. 전체를 `try/catch`로 감싸 조용히 무시

**경로 필터 (`shouldSkip`):**
- `/api/*`
- `/_next/*`
- `/admin/*`
- `/uploads/*`
- `/favicon.ico`
- `/robots.txt`
- `/sitemap.xml`

### 3. Proxy 수정 — `src/proxy.ts`

기존 proxy 로직(플러그인 비활성 차단, NextAuth 쿠키)은 그대로 유지하고, 다음을 추가:

```ts
const requestHeaders = new Headers(request.headers)
requestHeaders.set('x-nexibase-path', pathname)

// ... 기존 로직 ...

const response = NextResponse.next({
  request: { headers: requestHeaders },
})
```

### 4. RootLayout 수정 — `src/app/layout.tsx`

```ts
import { after } from 'next/server'
import { logVisit } from '@/lib/visitLogger'

export default async function RootLayout({ children }: ...) {
  after(() => logVisit())
  // ... 기존 로직 ...
}
```

- `after()`는 응답 전송 후 실행 → 페이지 응답 시간에 영향 없음
- Next.js 16의 안정 API (`next/server`에서 import)

### 5. 통계 API — `src/app/api/analytics/stats/route.ts`

```ts
interface Stats {
  online: number
  today: number
  yesterday: number
  total: number
}

let cache: { data: Stats; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000 // 120초

export async function GET() {
  // 캐시 히트 시 DB 조회 없이 반환
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  try {
    const now = new Date()
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000)
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const thirtyDaysAgo = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [online, today, yesterday, total] = await Promise.all([
      prisma.visitLog.findMany({ where: { createdAt: { gte: tenMinAgo } }, distinct: ['sessionId'], select: { sessionId: true } }),
      prisma.visitLog.findMany({ where: { createdAt: { gte: todayStart } }, distinct: ['sessionId'], select: { sessionId: true } }),
      prisma.visitLog.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } }, distinct: ['sessionId'], select: { sessionId: true } }),
      prisma.visitLog.findMany({ where: { createdAt: { gte: thirtyDaysAgo } }, distinct: ['sessionId'], select: { sessionId: true } }),
    ])

    const data: Stats = {
      online: online.length,
      today: today.length,
      yesterday: yesterday.length,
      total: total.length,
    }

    cache = { data, expires: Date.now() + CACHE_TTL_MS }
    return NextResponse.json(data)
  } catch (error) {
    console.error('analytics/stats 에러:', error)
    return NextResponse.json({ online: 0, today: 0, yesterday: 0, total: 0 }, { status: 200 })
  }
}
```

**집계 기준:**
- `online`: 지난 10분 내 활동한 고유 세션 (distinct sessionId)
- `today`: 오늘 00:00:00부터 지금까지의 고유 세션
- `yesterday`: 어제 00:00:00부터 오늘 00:00:00 직전까지의 고유 세션
- `total`: 최근 30일 누적 고유 세션

### 6. VisitorStats 위젯 — `src/widgets/VisitorStats.tsx` + `.meta.ts`

**Meta:**
```ts
export default {
  title: '접속자 통계',
  description: '현재 접속자, 오늘/어제/누적 방문자 수',
  defaultZone: 'sidebar',
  defaultColSpan: 1,
  defaultRowSpan: 1,
  settingsSchema: null,
}
```

**컴포넌트:**
- 클라이언트 컴포넌트 (`"use client"`)
- `useState<Stats | null>(null)` — `null`이면 스켈레톤 UI
- `useEffect`에서 초기 fetch + `setInterval(fetch, 120_000)`
- unmount 시 `clearInterval` + `mounted` flag
- `Intl.NumberFormat('ko-KR')`로 숫자 포매팅

**UI 구성:**
- 상단: 헤더 (`Activity` 아이콘 + "접속자 통계")
- 중단: 현재 접속 박스 (녹색 점 ping 애니메이션 + 숫자)
- 하단: 리스트 (오늘 / 어제 / 누적 30일)
- `stats === null`일 때: 숫자 자리에 얇은 `<div class="h-4 w-12 bg-muted animate-pulse rounded" />` 스켈레톤

### 7. 의존성 — `package.json`

```json
"isbot": "^5.x"
```

## 데이터 플로우

### 쓰기 (방문 기록)

1. 브라우저 → proxy.ts: `x-nexibase-path` 헤더 주입
2. Next.js → RootLayout 렌더: `after(() => logVisit())` 등록
3. 응답 전송 완료
4. 백그라운드: `logVisit()` 실행
   - `isbot()` 체크 → 봇이면 return
   - `shouldSkip(pathname)` → 제외 경로면 return
   - 쿠키 확인 → 없으면 새 `sessionId` 생성 + `cookies().set()`
   - `prisma.visitLog.create()`
5. 에러는 `try/catch`로 조용히 무시

### 읽기 (통계 조회)

1. `VisitorStats` 위젯 마운트 (`stats = null`)
2. 스켈레톤 UI 표시
3. `fetch('/api/analytics/stats')`
4. API route:
   - cache hit (120초 이내) → 즉시 반환
   - cache miss → 4개 Prisma 쿼리 병렬 실행 → 캐시 저장 → 반환
5. 위젯 상태 업데이트 → 숫자 표시
6. 120초 후 polling 재실행

## 에러 처리

| 위치 | 실패 시 동작 | 이유 |
|------|------------|------|
| `logVisit()` DB write | `try/catch`로 무시 | 로깅 실패로 페이지가 죽으면 안 됨 |
| `cookies().set()` (SC 제한) | `try/catch`로 무시 | Server Component에서 쿠키 set은 상황에 따라 에러 발생 가능 |
| `/api/analytics/stats` DB | 모든 값 0 반환 (200 OK) | 위젯이 깨지지 않게 |
| 위젯 `fetch` 실패 | `-` 표시 유지, 다음 폴링 재시도 | UX를 망가뜨리지 않음 |

## 성능 고려사항

### DB 부담
- 쓰기: 페이지 로드마다 1 INSERT. `after()`로 응답 비차단.
- 읽기: 캐시 TTL 120초 + 폴링 120초. 동시 접속자 1,000명이어도 시간당 ~30회 DB 쿼리 (4 쿼리 × 0.5회/분 × 60분 / 캐시 히트율 고려).
- 인덱스: `@@index([createdAt])` + `@@index([sessionId, createdAt])`로 distinct 집계 최적화.

### 응답 속도
- `after()`로 로깅이 응답을 블로킹하지 않음
- 캐시 히트 시 API 응답 < 10ms

## 보안 / 프라이버시

- **IP 저장**: 그대로 저장 (관리자만 접근)
- **userAgent**: 500자 절단
- **쿠키**: `httpOnly`, `sameSite: lax` — XSS 차단
- **봇 제외**: `isbot`으로 필터링 → 가짜 트래픽 방지
- 추후 GDPR 대응 필요 시 IP 마스킹 옵션을 별도 작업으로 추가

## 테스트 계획

수동 테스트 중심 (NexiBase 전반 테스트 패턴 준수):

1. **빌드 통과** — `npx next build`
2. **DB 스키마 반영** — `npx prisma db push`
3. **방문 기록 생성 확인** — 페이지 방문 → `visit_logs` 테이블에 행 증가 확인
4. **봇 필터링 확인** — `curl -A "Googlebot/2.1"` 후 로그 증가 안 함
5. **제외 경로 확인** — `/admin/*`, `/api/*` 방문 후 로그 증가 안 함
6. **쿠키 재사용 확인** — 같은 브라우저로 여러 페이지 방문 → 같은 `sessionId`로 기록
7. **위젯 자동 등록 확인** — `/admin/home-widgets`에서 "접속자 통계" 미배치 목록에 나타남
8. **위젯 배치 후 숫자 표시 확인** — 사이드바에 배치 → 숫자 정상 표시
9. **캐시 확인** — 2분 내 여러 번 호출 시 DB 쿼리 1회만 실행 (로그/쿼리 툴로 확인)
10. **스켈레톤 UI 확인** — 첫 로드 시 `-`가 아닌 스켈레톤 바 표시

## 마이그레이션

- `prisma db push` 또는 `prisma migrate dev --name add_visit_log`로 `visit_logs` 테이블 생성
- 기존 데이터 없음 (신규 테이블)
- 롤백: 테이블 drop 가능, 기존 기능에 영향 없음

## 향후 작업 (별도 PR)

1. **로그 자동 정리**: 90일 이상 된 로그 삭제 크론/스크립트
2. **관리자 분석 페이지**: 시간대별 차트, 인기 페이지, 레퍼러 Top 10, 디바이스 비율
3. **IP 마스킹 옵션**: 환경변수 `ANALYTICS_MASK_IP=true` 시 마지막 옥텟 마스킹
4. **봇 통계 옵션**: `isBot` 컬럼 추가 후 봇 트래픽도 기록 (옵션)
