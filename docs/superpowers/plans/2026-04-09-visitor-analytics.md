# Visitor Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NexiBase 코어에 방문 로깅 + 접속자 통계 위젯(VisitorStats)을 기본 기능으로 추가한다.

**Architecture:** 모든 페이지 요청이 `proxy.ts`를 거칠 때 `x-nexibase-path` 헤더를 주입하고, `RootLayout`이 Next.js 16의 `after()` API로 응답을 블로킹하지 않고 백그라운드에서 `logVisit()`을 호출해 `visit_logs` 테이블에 기록한다. 위젯은 `/api/analytics/stats` API(모듈 스코프 인메모리 캐시 TTL 120초)를 120초 주기로 폴링하며, 초기 렌더는 스켈레톤 UI로 로딩 상태를 최소화한다.

**Tech Stack:** Next.js 16 (App Router, `after()` API), Prisma (MySQL), isbot, React 19

---

## Spec Reference

`docs/superpowers/specs/2026-04-09-visitor-analytics-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `prisma/schema.base.prisma` | `VisitLog` 모델 추가 |
| Modify | `prisma/schema.prisma` | scan-plugins.js가 자동 재생성 (확인용) |
| Modify | `package.json` / `package-lock.json` | `isbot` 의존성 추가 |
| Create | `src/lib/visitLogger.ts` | `logVisit()` 헬퍼 (봇 필터, 경로 필터, 쿠키 관리, DB 기록) |
| Modify | `src/proxy.ts` | `x-nexibase-path` 헤더 주입 |
| Modify | `src/app/layout.tsx` | `after(() => logVisit())` 호출 |
| Create | `src/app/api/analytics/stats/route.ts` | 통계 API + 인메모리 캐시 (TTL 120초) |
| Create | `src/widgets/VisitorStats.tsx` | 접속자 통계 위젯 컴포넌트 |
| Create | `src/widgets/VisitorStats.meta.ts` | 위젯 메타 정보 |

---

## Testing Approach

NexiBase는 자동 테스트 프레임워크가 없고 수동 검증 중심이다. 각 Task는 다음 기준으로 검증한다:

- **빌드 통과**: `npx next build`가 에러 없이 끝남
- **DB 스키마 반영**: `npx prisma db push` 성공
- **실제 동작 확인**: curl / 브라우저 / DB 쿼리로 확인

---

### Task 1: VisitLog 모델 추가 및 DB 스키마 반영

**Files:**
- Modify: `prisma/schema.base.prisma`
- Modify (auto-generated): `prisma/schema.prisma`

- [ ] **Step 1: `prisma/schema.base.prisma` 맨 끝에 VisitLog 모델 추가**

기존 `LoginAttempt` 모델 아래에 다음을 추가:

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

- [ ] **Step 2: scan-plugins 실행하여 schema.prisma 병합 재생성**

```bash
cd /home/kagla/nexibase && node scripts/scan-plugins.js
```

Expected 출력 마지막 줄:
```
[scan-plugins] Merged N plugin schema(s) into /home/kagla/nexibase/prisma/schema.prisma
```

- [ ] **Step 3: schema.prisma에 VisitLog 모델이 존재하는지 확인**

```bash
grep -A 12 "^model VisitLog" prisma/schema.prisma
```

Expected: VisitLog 모델 블록이 출력됨.

- [ ] **Step 4: DB에 스키마 반영**

```bash
npx prisma db push
```

Expected:
```
🚀  Your database is now in sync with your Prisma schema.
```

(`prisma migrate dev`는 shadow DB 권한이 없을 수 있으므로 `db push` 사용)

- [ ] **Step 5: Prisma Client에 `visitLog` 타입이 생겼는지 확인**

```bash
grep -c "visitLog" node_modules/.prisma/client/index.d.ts
```

Expected: 숫자 > 0 (최소 10 이상).

- [ ] **Step 6: 커밋**

```bash
git add prisma/schema.base.prisma prisma/schema.prisma
git commit -m "feat(analytics): VisitLog 모델 추가"
```

---

### Task 2: isbot 패키지 설치

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: isbot 설치**

```bash
cd /home/kagla/nexibase && npm install isbot
```

Expected: 설치 성공, `package.json`의 dependencies에 `"isbot"` 라인이 추가됨.

- [ ] **Step 2: 설치 확인**

```bash
grep '"isbot"' package.json
```

Expected: `"isbot": "^5.x.x"` 형태의 라인 출력.

- [ ] **Step 3: import 가능한지 확인**

```bash
node -e "const { isbot } = require('isbot'); console.log(isbot('Googlebot/2.1'))"
```

Expected: `true`

- [ ] **Step 4: 커밋**

```bash
git add package.json package-lock.json
git commit -m "feat(analytics): isbot 의존성 추가"
```

---

### Task 3: visitLogger 헬퍼 작성

**Files:**
- Create: `src/lib/visitLogger.ts`

- [ ] **Step 1: `src/lib/visitLogger.ts` 생성**

전체 내용:

```ts
import { headers, cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { isbot } from 'isbot'
import { prisma } from '@/lib/prisma'

const VISIT_SESSION_COOKIE = 'nb_visit_sid'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30일

/**
 * 현재 요청을 VisitLog에 기록한다.
 * Root layout에서 `after()`로 호출되어 응답 후 백그라운드에 실행된다.
 * 봇 / 정적 자원 / API / admin 경로는 제외한다.
 * DB 에러는 조용히 무시한다 (로깅 실패로 페이지가 죽지 않게).
 */
export async function logVisit(userId?: number | null): Promise<void> {
  try {
    const h = await headers()
    const userAgent = h.get('user-agent') || ''

    // 봇 제외
    if (!userAgent || isbot(userAgent)) return

    const rawPath = h.get('x-nexibase-path') || h.get('referer') || '/'
    const pathname = extractPathname(rawPath)

    // 트래킹 제외 경로
    if (shouldSkip(pathname)) return

    const referer = h.get('referer') || null
    const forwardedFor = h.get('x-forwarded-for')
    const realIp = h.get('x-real-ip')
    const ip = (forwardedFor?.split(',')[0].trim() || realIp || 'unknown').slice(0, 45)

    // 세션 쿠키 (고유 방문자 식별용)
    const cookieStore = await cookies()
    let sessionId = cookieStore.get(VISIT_SESSION_COOKIE)?.value
    if (!sessionId) {
      sessionId = randomBytes(32).toString('hex')
      try {
        cookieStore.set(VISIT_SESSION_COOKIE, sessionId, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: SESSION_MAX_AGE,
          path: '/',
        })
      } catch {
        // Server Component에서 cookies().set()은 상황에 따라 에러 가능 — 무시
      }
    }

    await prisma.visitLog.create({
      data: {
        sessionId,
        userId: userId ?? null,
        ip,
        path: pathname.slice(0, 500),
        referer: referer?.slice(0, 500) ?? null,
        userAgent: userAgent.slice(0, 500),
      },
    })
  } catch {
    // 방문 로깅 실패는 조용히 무시
  }
}

function extractPathname(url: string): string {
  try {
    if (url.startsWith('http')) {
      return new URL(url).pathname
    }
    return url.split('?')[0]
  } catch {
    return '/'
  }
}

function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/uploads/') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  )
}
```

- [ ] **Step 2: 파일 존재 및 import 경로 확인**

```bash
ls src/lib/visitLogger.ts && grep -c "from '@/lib/prisma'" src/lib/visitLogger.ts
```

Expected: 파일 존재, grep 결과 `1`.

- [ ] **Step 3: 커밋**

```bash
git add src/lib/visitLogger.ts
git commit -m "feat(analytics): logVisit 헬퍼 추가

봇 필터링(isbot), 경로 필터, 세션 쿠키 관리, VisitLog 기록.
DB 에러는 조용히 무시하여 페이지 렌더링에 영향을 주지 않는다."
```

---

### Task 4: proxy.ts에 `x-nexibase-path` 헤더 주입

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: 현재 proxy.ts 내용 확인**

```bash
cat src/proxy.ts
```

`proxy()` 함수 시작 부분과 `NextResponse.next()` 호출 지점을 파악해둔다.

- [ ] **Step 2: 함수 시작부에 헤더 준비 로직 추가**

`proxy(request)` 함수 body 시작 부분(`const { pathname } = request.nextUrl;` 바로 아래)에 다음을 추가:

```ts
  // pathname을 헤더에 주입 (서버 컴포넌트의 headers()로 읽기 위함)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nexibase-path', pathname);
```

- [ ] **Step 3: `NextResponse.next()` 호출을 headers 전달 형태로 변경**

기존:
```ts
const response = NextResponse.next();
```

변경:
```ts
const response = NextResponse.next({
  request: {
    headers: requestHeaders,
  },
});
```

- [ ] **Step 4: 수정 결과 확인**

```bash
grep -n "x-nexibase-path\|requestHeaders" src/proxy.ts
```

Expected 출력 (라인 번호는 다를 수 있음):
```
N: const requestHeaders = new Headers(request.headers);
N: requestHeaders.set('x-nexibase-path', pathname);
N:     headers: requestHeaders,
```

- [ ] **Step 5: 커밋**

```bash
git add src/proxy.ts
git commit -m "feat(analytics): proxy.ts에 x-nexibase-path 헤더 주입

서버 컴포넌트에서 headers()로 현재 pathname을 읽을 수 있도록
x-nexibase-path 헤더를 모든 요청에 주입한다."
```

---

### Task 5: RootLayout에서 `after()`로 비차단 로깅

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: import 두 줄 추가**

`src/app/layout.tsx`의 상단 import 블록에 다음을 추가:

```ts
import { after } from 'next/server'
import { logVisit } from '@/lib/visitLogger'
```

(기존 `import` 문들 사이 아무 위치에 추가해도 됨. 기존 `@/lib/prisma` import 바로 아래 추천)

- [ ] **Step 2: RootLayout 함수 body 맨 첫줄에 `after(() => logVisit())` 추가**

기존 `RootLayout` 함수의 `return` 이전, 함수 body 시작 부분에 추가:

```ts
export default async function RootLayout({ children }: ...) {
  // 방문 로깅 (봇/정적자원/API/admin 제외, after()로 응답 후 백그라운드 실행)
  after(() => logVisit())

  // ... 기존 로직 ...
}
```

(`await`는 쓰지 않는다. `after()`는 fire-and-forget.)

- [ ] **Step 3: 수정 결과 확인**

```bash
grep -n "after\|logVisit" src/app/layout.tsx
```

Expected: `after` import, `logVisit` import, `after(() => logVisit())` 호출 세 줄이 모두 보임.

- [ ] **Step 4: 빌드 통과 확인**

```bash
npx next build 2>&1 | tail -10
```

Expected: 에러 없이 끝나고 route list 출력됨. "Compiled successfully" 또는 route 목록이 보이면 성공.

- [ ] **Step 5: 커밋**

```bash
git add src/app/layout.tsx
git commit -m "feat(analytics): RootLayout에서 after()로 방문 로깅

Next.js 16의 after() API로 응답 전송 후 백그라운드에서 logVisit()을
실행. 페이지 응답 시간에 영향을 주지 않음."
```

---

### Task 6: `/api/analytics/stats` API 작성

**Files:**
- Create: `src/app/api/analytics/stats/route.ts`

- [ ] **Step 1: 디렉토리 및 파일 생성**

```bash
mkdir -p src/app/api/analytics/stats
```

- [ ] **Step 2: `src/app/api/analytics/stats/route.ts` 전체 내용 작성**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface Stats {
  online: number
  today: number
  yesterday: number
  total: number
}

// 모듈 스코프 인메모리 캐시 (TTL 120초)
let cache: { data: Stats; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000

/**
 * 접속자 통계
 * - online: 현재 접속자 (지난 10분 내 고유 세션)
 * - today: 오늘 00:00 이후 고유 방문자
 * - yesterday: 어제 하루 고유 방문자
 * - total: 최근 30일 누적 고유 방문자
 *
 * 모듈 스코프 인메모리 캐시로 DB 부담을 줄인다 (동일 프로세스 내에서 120초 유지).
 */
export async function GET() {
  // 캐시 히트 시 DB 조회 없이 즉시 반환
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  try {
    const now = new Date()
    const tenMinAgo = new Date(now.getTime() - 10 * 60 * 1000)

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [online, today, yesterday, total] = await Promise.all([
      prisma.visitLog.findMany({
        where: { createdAt: { gte: tenMinAgo } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      prisma.visitLog.findMany({
        where: { createdAt: { gte: todayStart } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      prisma.visitLog.findMany({
        where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
      prisma.visitLog.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        distinct: ['sessionId'],
        select: { sessionId: true },
      }),
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
    return NextResponse.json(
      { online: 0, today: 0, yesterday: 0, total: 0 },
      { status: 200 }
    )
  }
}
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
npx next build 2>&1 | tail -10
```

Expected: 에러 없음. route 목록에 `ƒ /api/analytics/stats` 포함 확인.

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/analytics/stats/route.ts
git commit -m "feat(analytics): /api/analytics/stats API 추가

현재 접속자/오늘/어제/누적(30일) 고유 방문자 수를 반환.
모듈 스코프 인메모리 캐시(TTL 120초)로 DB 부담 최소화."
```

---

### Task 7: VisitorStats 위젯 작성

**Files:**
- Create: `src/widgets/VisitorStats.meta.ts`
- Create: `src/widgets/VisitorStats.tsx`

- [ ] **Step 1: `src/widgets/VisitorStats.meta.ts` 생성**

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

- [ ] **Step 2: `src/widgets/VisitorStats.tsx` 생성**

```tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Activity } from "lucide-react"

interface Stats {
  online: number
  today: number
  yesterday: number
  total: number
}

const POLL_INTERVAL_MS = 120_000 // 120초

export default function VisitorStats() {
  // null = 아직 첫 fetch 완료 전 (스켈레톤 UI 표시)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/analytics/stats')
        if (res.ok && mounted) {
          const data: Stats = await res.json()
          setStats(data)
        }
      } catch {
        // 네트워크 에러 — 기존 값 유지하고 다음 폴링에서 재시도
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const formatNumber = (n: number) => n.toLocaleString('ko-KR')

  const Skeleton = () => (
    <div className="h-4 w-12 bg-muted animate-pulse rounded inline-block align-middle" />
  )

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">접속자 통계</h3>
        </div>

        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-green-50 dark:bg-green-950/30 rounded-md border border-green-200 dark:border-green-900">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-sm text-muted-foreground">현재 접속</span>
          <span className="ml-auto text-base font-bold text-green-700 dark:text-green-400">
            {stats ? formatNumber(stats.online) : <Skeleton />}
          </span>
        </div>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between py-1 border-b">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              오늘
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.today) : <Skeleton />}
            </span>
          </div>
          <div className="flex items-center justify-between py-1 border-b">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              어제
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.yesterday) : <Skeleton />}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              누적 (30일)
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.total) : <Skeleton />}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: scan-plugins 실행하여 위젯 레지스트리 재생성**

```bash
node scripts/scan-plugins.js
```

Expected: "Generated widget registry with N widget(s)" — 숫자가 기존보다 1 증가.

- [ ] **Step 4: 레지스트리에 등록되었는지 확인**

```bash
grep "visitor-stats\|VisitorStats" src/lib/widgets/_generated-registry.ts
```

Expected: `VisitorStats` 관련 라인이 여러 개 출력됨.

- [ ] **Step 5: 빌드 통과 확인**

```bash
npx next build 2>&1 | tail -10
```

Expected: 에러 없이 완료.

- [ ] **Step 6: 커밋**

```bash
git add src/widgets/VisitorStats.meta.ts src/widgets/VisitorStats.tsx src/lib/widgets/_generated-registry.ts src/lib/widgets/_generated-metadata.ts src/plugins/_generated.ts
git commit -m "feat(analytics): VisitorStats 위젯 추가

현재 접속자 / 오늘 / 어제 / 누적(30일) 방문자 수를 표시하는 위젯.
초기 렌더 시 스켈레톤 UI, 이후 120초 간격 폴링으로 갱신.
관리자 홈화면관리에서 자동으로 감지되어 배치 가능."
```

---

### Task 8: 수동 검증

이 Task는 코드 변경 없이 실제 동작을 확인하는 단계다.

- [ ] **Step 1: 개발 서버 실행 (이미 실행 중이면 skip)**

```bash
npm run dev
```

Expected: `Ready in Nms`, 포트 출력.

- [ ] **Step 2: 일반 브라우저로 홈페이지 접속 (또는 curl)**

```bash
curl -s -o /dev/null -w "%{http_code}" -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" http://localhost:3000/
```

Expected: `200`

- [ ] **Step 3: DB에 VisitLog가 쌓였는지 확인**

```bash
npx prisma studio
```

또는 직접 SQL:
```bash
mysql -u <user> -p <db> -e "SELECT id, path, ip, LEFT(userAgent, 40) as ua, createdAt FROM visit_logs ORDER BY id DESC LIMIT 5;"
```

Expected: 최소 1행 이상의 최근 방문 기록. `path`가 `/`이고 `userAgent`에 "Mozilla"가 포함됨.

- [ ] **Step 4: 봇 필터링 확인**

```bash
curl -s -o /dev/null -A "Googlebot/2.1 (+http://www.google.com/bot.html)" http://localhost:3000/
```

그 후 DB 재확인:
```bash
mysql -u <user> -p <db> -e "SELECT COUNT(*) FROM visit_logs WHERE userAgent LIKE '%Googlebot%';"
```

Expected: `0` — 봇은 기록되지 않음.

- [ ] **Step 5: admin 경로 제외 확인**

```bash
curl -s -o /dev/null -A "Mozilla/5.0" http://localhost:3000/admin/
mysql -u <user> -p <db> -e "SELECT COUNT(*) FROM visit_logs WHERE path LIKE '/admin/%';"
```

Expected: `0`

- [ ] **Step 6: API 응답 확인**

```bash
curl -s http://localhost:3000/api/analytics/stats
```

Expected: JSON 형태 `{"online":N,"today":N,"yesterday":N,"total":N}` — 숫자는 0 이상.

- [ ] **Step 7: API 캐시 동작 확인**

두 번 연속 호출 후 DB 쿼리 로그를 확인하거나, Prisma 쿼리 로깅이 없다면 응답 시간으로 간접 확인:

```bash
time curl -s http://localhost:3000/api/analytics/stats > /dev/null
time curl -s http://localhost:3000/api/analytics/stats > /dev/null
```

Expected: 두 번째 호출이 현저히 빠름 (캐시 히트). 첫 호출은 수십~수백 ms, 두 번째는 < 20ms 예상.

- [ ] **Step 8: 위젯이 관리자 UI에 자동 등록되었는지 확인**

브라우저에서 `http://localhost:3000/admin/home-widgets` 접속. 로그인 후 **미배치 위젯** 또는 위젯 선택 메뉴에 **"접속자 통계"** 가 보이는지 확인.

Expected: "접속자 통계" 항목이 미배치 위젯 목록에 보임. 사이드바 영역에 배치 가능.

- [ ] **Step 9: 위젯 배치 후 홈페이지에서 숫자 표시 확인**

위 화면에서 "접속자 통계" 위젯을 사이드바 영역에 배치한 후, 홈페이지(`/`)를 새로고침. 위젯이 정상적으로 렌더되고 숫자가 표시되는지 확인.

Expected:
- 첫 렌더 시 스켈레톤 UI(회색 펄스 바)가 잠깐 보임
- 이후 `현재 접속 / 오늘 / 어제 / 누적` 숫자가 표시됨
- 네트워크 탭에서 `/api/analytics/stats` 요청이 200 OK로 성공

- [ ] **Step 10: 세션 쿠키 재사용 확인**

같은 브라우저에서 여러 페이지(`/`, `/boards`, `/contents/about` 등)를 방문한 후 DB에서 확인:

```bash
mysql -u <user> -p <db> -e "SELECT DISTINCT sessionId FROM visit_logs WHERE createdAt > NOW() - INTERVAL 5 MINUTE;"
```

Expected: 같은 `sessionId`가 여러 번 나타남 (쿠키 재사용 확인).

---

### Task 9: 문서 업데이트 (선택)

**Files:**
- Modify: `README.md` (해당 섹션이 있으면)

- [ ] **Step 1: README.md에 기능 섹션이 있는지 확인**

```bash
grep -n "## Features\|## 기능" README.md
```

없으면 이 Task 전체 skip.

- [ ] **Step 2: 기능 섹션에 한 줄 추가 (있을 경우)**

기능 목록에 다음 라인 추가:
```
- 접속자 통계 위젯 (현재 접속 / 오늘 / 어제 / 누적)
```

- [ ] **Step 3: 커밋 (변경이 있을 경우)**

```bash
git add README.md
git commit -m "docs: README에 접속자 통계 위젯 기능 추가"
```

---

## Self-Review

**Spec coverage:**

- [x] VisitLog 모델 → Task 1
- [x] logVisit() 헬퍼 (봇 필터, 경로 필터, 쿠키 관리) → Task 3
- [x] proxy.ts `x-nexibase-path` 헤더 주입 → Task 4
- [x] `after()` 비차단 로깅 → Task 5
- [x] `/api/analytics/stats` + 인메모리 캐시(120s) → Task 6
- [x] VisitorStats 위젯 + 스켈레톤 UI + 120s 폴링 → Task 7
- [x] isbot 의존성 → Task 2
- [x] 수동 검증 (빌드, 봇/경로 필터, 캐시, 위젯 등록) → Task 8

**Placeholder scan:** "TBD"/"TODO" 없음. 모든 step에 실제 코드와 커맨드가 명시됨.

**Type/Name consistency:**
- `Stats` 인터페이스: Task 6 (`route.ts`)과 Task 7 (`VisitorStats.tsx`)에서 동일한 4개 필드 `online/today/yesterday/total` 사용
- `logVisit(userId?: number | null)`: Task 3에서 정의, Task 5에서 `logVisit()` (인자 없이) 호출 — `userId` optional이라 OK
- `x-nexibase-path` 헤더: Task 4(주입)와 Task 3(읽기)에서 동일 문자열
- `nb_visit_sid` 쿠키 이름: Task 3 내부 상수 `VISIT_SESSION_COOKIE`로 통일
- `CACHE_TTL_MS`: Task 6에서 `120 * 1000` 정의, 명확함
- `POLL_INTERVAL_MS`: Task 7에서 `120_000` 정의, 캐시 TTL과 일치

**Ordering check:** Task 1(모델) → Task 2(deps) → Task 3(헬퍼, prisma 사용) → Task 4(proxy) → Task 5(layout, 헬퍼 import) → Task 6(API, prisma 사용) → Task 7(위젯, API fetch) → Task 8(검증). 각 Task의 의존성이 이전 Task에서 모두 준비됨.
