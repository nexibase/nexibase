# Google Analytics Visitor Stats Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 GA4 Data API 연동을 설정하면 홈 위젯에 현재 접속자/오늘/어제/지난 7일 방문자 수를 표시한다.

**Architecture:** 관리자 설정 UI에 Property ID + Service Account JSON 입력란을 추가하고, `BetaAnalyticsDataClient`를 래핑한 `gaClient` 헬퍼로 GA Data API(Core + Realtime)를 호출한다. stats API는 인메모리 캐시(TTL 120초) + inflight promise guard로 GA 할당량/응답 시간을 절약하며, 위젯은 120초 폴링으로 데이터를 갱신한다. 설정이 없으면 위젯은 `null` 렌더로 자동 숨김.

**Tech Stack:** Next.js 16 (App Router), Prisma (MySQL), `@google-analytics/data`, React 19, shadcn/ui, TypeScript

---

## Spec Reference

`docs/superpowers/specs/2026-04-10-ga-visitor-stats-widget-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `package.json` / `package-lock.json` | `@google-analytics/data` 의존성 추가 |
| Create | `src/lib/gaClient.ts` | settings에서 credentials 읽어 `BetaAnalyticsDataClient` 인스턴스 반환, 모듈 캐시 |
| Create | `src/app/api/admin/analytics/test/route.ts` | 저장된 설정으로 GA API 호출해 연결 검증 (관리자 전용) |
| Create | `src/app/api/analytics/ga-stats/route.ts` | 4개 지표 병렬 조회 + 인메모리 캐시(TTL 120s) + inflight guard |
| Create | `src/widgets/VisitorStats.meta.ts` | 위젯 메타 정보 |
| Create | `src/widgets/VisitorStats.tsx` | 4개 숫자 표시, 120초 폴링, configured=false면 null |
| Modify | `src/app/admin/settings/page.tsx` | SettingsData 타입/기본값 확장, Google Analytics 섹션에 새 필드 2개 + 연결 테스트 버튼 |

---

## Testing Approach

NexiBase는 자동 테스트 프레임워크가 없고 수동 검증 중심이다. 각 Task는 다음 기준으로 검증한다:

- **빌드 통과**: `npx next build`가 에러 없이 끝남
- **TypeScript check**: `npx tsc --noEmit`에서 변경 파일에 오류 없음
- **실제 동작 확인**: curl / 브라우저 / 관리자 화면으로 확인

---

## 작업 전 확인: 서비스 디렉토리

모든 명령은 `/path/to/production-source`에서 실행한다. 다른 디렉토리(예: `/path/to/nexibase` upstream)와 혼동하지 말 것. 각 명령 앞에 `cd /path/to/production-source &&`를 붙인다.

---

### Task 1: `@google-analytics/data` 패키지 설치

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: 패키지 설치**

```bash
cd /path/to/production-source && npm install @google-analytics/data
```

Expected: 설치 성공, `package.json` dependencies에 `"@google-analytics/data"` 라인 추가.

- [ ] **Step 2: 설치 확인**

```bash
cd /path/to/production-source && grep '"@google-analytics/data"' package.json
```

Expected: `"@google-analytics/data": "^4.x.x"` 형태의 라인 출력.

- [ ] **Step 3: import 가능 확인**

```bash
cd /path/to/production-source && node -e "const { BetaAnalyticsDataClient } = require('@google-analytics/data'); console.log(typeof BetaAnalyticsDataClient)"
```

Expected: `function`

- [ ] **Step 4: 커밋**

```bash
cd /path/to/production-source && git add package.json package-lock.json && git commit -m "feat(ga-widget): @google-analytics/data 의존성 추가"
```

---

### Task 2: gaClient 헬퍼 작성

**Files:**
- Create: `src/lib/gaClient.ts`

- [ ] **Step 1: `src/lib/gaClient.ts` 전체 내용 작성**

```ts
import { BetaAnalyticsDataClient } from '@google-analytics/data'
import { prisma } from '@/lib/prisma'

export interface GaClient {
  propertyId: string
  dataClient: BetaAnalyticsDataClient
}

// 모듈 스코프 캐시: 한 번 생성한 클라이언트를 프로세스 동안 재사용
let cachedClient: { credentialsHash: string; client: GaClient } | null = null

/**
 * settings 테이블에서 ga4_property_id + ga4_service_account_json을 읽어
 * BetaAnalyticsDataClient 인스턴스를 반환한다.
 * 설정이 없거나 JSON 파싱이 실패하면 null을 반환한다.
 *
 * credentials hash가 바뀌면 (설정 변경) 캐시를 새로 생성한다.
 */
export async function getGaClient(): Promise<GaClient | null> {
  try {
    const [propRow, jsonRow] = await Promise.all([
      prisma.setting.findUnique({ where: { key: 'ga4_property_id' } }),
      prisma.setting.findUnique({ where: { key: 'ga4_service_account_json' } }),
    ])

    const propertyId = propRow?.value?.trim()
    const jsonStr = jsonRow?.value?.trim()
    if (!propertyId || !jsonStr) return null

    // 설정이 바뀌면 새 클라이언트 생성
    const hash = `${propertyId}:${jsonStr.length}:${jsonStr.slice(0, 16)}`
    if (cachedClient && cachedClient.credentialsHash === hash) {
      return cachedClient.client
    }

    const credentials = JSON.parse(jsonStr)
    const dataClient = new BetaAnalyticsDataClient({ credentials })
    cachedClient = { credentialsHash: hash, client: { propertyId, dataClient } }
    return cachedClient.client
  } catch (err) {
    console.error('[gaClient] 클라이언트 생성 실패:', err)
    return null
  }
}

/**
 * 테스트 목적으로 캐시를 강제 무효화한다 (현재 사용처 없음, 향후 확장용).
 */
export function invalidateGaClientCache(): void {
  cachedClient = null
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /path/to/production-source && npx tsc --noEmit 2>&1 | grep "gaClient.ts" || echo "gaClient.ts OK"
```

Expected: `gaClient.ts OK`

- [ ] **Step 3: 커밋**

```bash
cd /path/to/production-source && git add src/lib/gaClient.ts && git commit -m "feat(ga-widget): gaClient 헬퍼 추가

settings 테이블의 ga4_property_id + ga4_service_account_json을 읽어
BetaAnalyticsDataClient 인스턴스를 생성. 설정 미완 / JSON 파싱 실패 시
null 반환. credentials hash로 모듈 캐시 관리."
```

---

### Task 3: 연결 테스트 API 작성

**Files:**
- Create: `src/app/api/admin/analytics/test/route.ts`

- [ ] **Step 1: 디렉토리 생성**

```bash
cd /path/to/production-source && mkdir -p src/app/api/admin/analytics/test
```

- [ ] **Step 2: `src/app/api/admin/analytics/test/route.ts` 전체 내용 작성**

```ts
import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getGaClient } from '@/lib/gaClient'

export const dynamic = 'force-dynamic'

/**
 * 관리자 전용 — 저장된 GA4 설정으로 실제 API 호출 1회 실행하여 연결 검증.
 * 성공 시 propertyId와 오늘 사용자 수를 함께 반환한다.
 * 설정 누락 / JSON 파싱 실패 / GA 인증 실패 / 권한 미부여 등 모든 실패는
 * 200 OK + { ok: false, error } 로 응답 (프론트가 에러 메시지 그대로 표시).
 */
export async function POST() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 })
  }

  try {
    const client = await getGaClient()
    if (!client) {
      return NextResponse.json({
        ok: false,
        error: 'GA4 설정(Property ID + Service Account JSON)이 완료되지 않았거나 JSON 형식이 올바르지 않습니다.',
      })
    }

    const { propertyId, dataClient } = client

    // 최소 쿼리로 연결만 검증: 오늘 1일치 activeUsers
    const [report] = await dataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    })

    const todayUsers = Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0)

    return NextResponse.json({
      ok: true,
      propertyId,
      todayUsers,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[analytics/test] GA API 호출 실패:', err)
    return NextResponse.json({ ok: false, error: msg })
  }
}
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
cd /path/to/production-source && npx next build 2>&1 | tail -10
```

Expected: 빌드 성공. route 목록에 `ƒ /api/admin/analytics/test` 포함.

- [ ] **Step 4: 커밋**

```bash
cd /path/to/production-source && git add src/app/api/admin/analytics/test/route.ts && git commit -m "feat(ga-widget): 관리자 GA 연결 테스트 API 추가

저장된 설정으로 runReport(오늘 1일치) 1회 실행하여 연결 검증.
모든 실패는 200 OK + { ok: false, error } 로 응답하여 프론트가
에러 메시지를 그대로 표시한다."
```

---

### Task 4: stats API 작성

**Files:**
- Create: `src/app/api/analytics/ga-stats/route.ts`

- [ ] **Step 1: 디렉토리 생성**

```bash
cd /path/to/production-source && mkdir -p src/app/api/analytics/ga-stats
```

- [ ] **Step 2: `src/app/api/analytics/ga-stats/route.ts` 전체 내용 작성**

```ts
import { NextResponse } from 'next/server'
import { getGaClient } from '@/lib/gaClient'

export const dynamic = 'force-dynamic'

interface Stats {
  online: number
  today: number
  yesterday: number
  sevenDays: number
  configured: boolean
}

// 모듈 스코프 인메모리 캐시 (TTL 120초)
let cache: { data: Stats; expires: number } | null = null
const CACHE_TTL_MS = 120 * 1000

// 캐시 스탬피드 방지: 동시 요청은 동일한 promise를 공유
let inflight: Promise<Stats> | null = null

function getValue(
  report: { rows?: Array<{ metricValues?: Array<{ value?: string | null }> }> | null | undefined }
): number {
  return Number(report.rows?.[0]?.metricValues?.[0]?.value ?? 0)
}

async function fetchStats(): Promise<Stats> {
  const client = await getGaClient()
  if (!client) {
    return { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: false }
  }

  const { propertyId, dataClient } = client
  const property = `properties/${propertyId}`

  const [realtime, today, yesterday, sevenDays] = await Promise.all([
    dataClient.runRealtimeReport({
      property,
      metrics: [{ name: 'activeUsers' }],
    }),
    dataClient.runReport({
      property,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    }),
    dataClient.runReport({
      property,
      dateRanges: [{ startDate: 'yesterday', endDate: 'yesterday' }],
      metrics: [{ name: 'activeUsers' }],
    }),
    dataClient.runReport({
      property,
      // 오늘 포함 지난 7일 (6일 전 ~ 오늘)
      dateRanges: [{ startDate: '6daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    }),
  ])

  return {
    online: getValue(realtime[0]),
    today: getValue(today[0]),
    yesterday: getValue(yesterday[0]),
    sevenDays: getValue(sevenDays[0]),
    configured: true,
  }
}

/**
 * 홈 위젯용 GA4 방문자 통계.
 * - online: 현재 접속자 (Realtime API, 지난 30분)
 * - today: 오늘 activeUsers
 * - yesterday: 어제 activeUsers
 * - sevenDays: 오늘 포함 지난 7일 activeUsers
 *
 * 설정 미완 시 configured: false 로 응답 (위젯이 자신을 숨김).
 * GA API 실패 시 configured: true + 모든 값 0 (위젯은 0으로 표시).
 * 인메모리 캐시(TTL 120s) + inflight guard로 GA 할당량/응답 시간 절약.
 */
export async function GET() {
  // 캐시 히트 시 DB/외부 호출 없이 즉시 반환
  if (cache && cache.expires > Date.now()) {
    return NextResponse.json(cache.data)
  }

  // 이미 진행 중인 조회가 있으면 그 promise를 공유
  if (inflight) {
    try {
      const data = await inflight
      return NextResponse.json(data)
    } catch {
      return NextResponse.json(
        { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: false },
        { status: 200 }
      )
    }
  }

  // 첫 요청자가 실제 조회 실행
  inflight = fetchStats()
    .then((data) => {
      // configured=true일 때만 캐시 (설정 변경을 다음 요청에서 즉시 반영)
      if (data.configured) {
        cache = { data, expires: Date.now() + CACHE_TTL_MS }
      }
      return data
    })
    .finally(() => {
      inflight = null
    })

  try {
    const data = await inflight
    return NextResponse.json(data)
  } catch (err) {
    console.error('[ga-stats] GA API 호출 실패:', err)
    return NextResponse.json(
      { online: 0, today: 0, yesterday: 0, sevenDays: 0, configured: true },
      { status: 200 }
    )
  }
}
```

- [ ] **Step 3: 빌드 통과 확인**

```bash
cd /path/to/production-source && npx next build 2>&1 | tail -10
```

Expected: 빌드 성공. route 목록에 `ƒ /api/analytics/ga-stats` 포함.

- [ ] **Step 4: 커밋**

```bash
cd /path/to/production-source && git add src/app/api/analytics/ga-stats/route.ts && git commit -m "feat(ga-widget): /api/analytics/ga-stats API 추가

GA4 Realtime(현재 접속자) + Core Reporting(오늘/어제/7일)을 병렬 조회.
인메모리 캐시 TTL 120초 + inflight promise guard로 캐시 스탬피드 방지.
설정 없으면 configured: false 반환하여 위젯이 자신을 숨기게 함."
```

---

### Task 5: VisitorStats 위젯 메타 파일

**Files:**
- Create: `src/widgets/VisitorStats.meta.ts`

- [ ] **Step 1: `src/widgets/VisitorStats.meta.ts` 전체 내용 작성**

```ts
export default {
  title: '방문자 통계',
  description: '현재 접속자, 오늘/어제/7일간 방문자 수 (Google Analytics)',
  defaultZone: 'sidebar',
  defaultColSpan: 1,
  defaultRowSpan: 1,
  settingsSchema: null,
}
```

- [ ] **Step 2: 파일 생성 확인**

```bash
cd /path/to/production-source && cat src/widgets/VisitorStats.meta.ts
```

Expected: 작성한 내용 그대로 출력.

---

### Task 6: VisitorStats 위젯 컴포넌트 작성

**Files:**
- Create: `src/widgets/VisitorStats.tsx`

- [ ] **Step 1: `src/widgets/VisitorStats.tsx` 전체 내용 작성**

```tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Activity } from "lucide-react"

interface Stats {
  online: number
  today: number
  yesterday: number
  sevenDays: number
  configured: boolean
}

const POLL_INTERVAL_MS = 120_000 // 120초

export default function VisitorStats() {
  // null = 아직 첫 fetch 완료 전 (스켈레톤 UI 표시)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    let mounted = true

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/analytics/ga-stats')
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

  // 설정 안 됨 → 위젯 자체 숨김
  if (stats && !stats.configured) {
    return null
  }

  const formatNumber = (n: number) => n.toLocaleString('ko-KR')

  const Skeleton = () => (
    <div className="h-4 w-12 bg-muted animate-pulse rounded inline-block align-middle" />
  )

  return (
    <Card className="h-full">
      <CardContent className="p-4 h-full flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">방문자 통계</h3>
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
              지난 7일
            </span>
            <span className="font-semibold">
              {stats ? formatNumber(stats.sevenDays) : <Skeleton />}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: scan-plugins 실행하여 레지스트리 재생성**

```bash
cd /path/to/production-source && node scripts/scan-plugins.js
```

Expected 출력: `Generated widget registry with N widget(s)` — N이 기존 + 1.

- [ ] **Step 3: 등록 확인**

```bash
cd /path/to/production-source && grep "visitor-stats\|VisitorStats" src/lib/widgets/_generated-registry.ts
```

Expected: `VisitorStats` 관련 라인이 dynamic import 형태로 출력됨.

```bash
cd /path/to/production-source && grep -A 7 "visitor-stats" src/lib/widgets/_generated-metadata.ts
```

Expected: `label: '방문자 통계'` 를 포함한 블록 출력.

- [ ] **Step 4: 빌드 통과 확인**

```bash
cd /path/to/production-source && npx next build 2>&1 | tail -10
```

Expected: 빌드 성공.

- [ ] **Step 5: 커밋**

```bash
cd /path/to/production-source && git add src/widgets/VisitorStats.tsx src/widgets/VisitorStats.meta.ts && git commit -m "feat(ga-widget): VisitorStats 위젯 추가

현재 접속자 / 오늘 / 어제 / 지난 7일 방문자 수를 표시.
초기 렌더 시 스켈레톤 UI, 120초 폴링으로 갱신.
configured: false 응답 시 return null 로 자신을 숨긴다."
```

---

### Task 7: 관리자 설정 UI — 타입/기본값 확장

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

이 Task는 순수 TypeScript 타입 및 state 기본값만 수정한다. UI 렌더링은 Task 8에서.

- [ ] **Step 1: 현재 관련 부분 확인**

```bash
cd /path/to/production-source && sed -n '50,85p' src/app/admin/settings/page.tsx
```

약 54라인 `google_analytics_id: string` 과 80라인 `google_analytics_id: ''` 위치를 메모.

- [ ] **Step 2: `SettingsData` 타입에 새 필드 2개 추가**

`src/app/admin/settings/page.tsx` 파일에서 `SettingsData` 인터페이스 안의 `google_analytics_id: string` 바로 아래에 다음 두 줄을 추가한다:

```ts
  ga4_property_id: string
  ga4_service_account_json: string
```

수정 후 해당 블록은 이 모습이어야 함:

```ts
  // 외부 서비스
  google_analytics_id: string
  ga4_property_id: string
  ga4_service_account_json: string
```

- [ ] **Step 3: `DEFAULT_SETTINGS` 객체에 기본값 추가**

`DEFAULT_SETTINGS`의 `google_analytics_id: ''` 아래에 다음 두 줄 추가:

```ts
  ga4_property_id: '',
  ga4_service_account_json: '',
```

수정 후:

```ts
  google_analytics_id: '',
  ga4_property_id: '',
  ga4_service_account_json: '',
```

- [ ] **Step 4: TypeScript 검증**

```bash
cd /path/to/production-source && npx tsc --noEmit 2>&1 | grep "admin/settings/page.tsx" || echo "page.tsx OK"
```

Expected: `page.tsx OK`

- [ ] **Step 5: 커밋**

```bash
cd /path/to/production-source && git add src/app/admin/settings/page.tsx && git commit -m "feat(ga-widget): 관리자 설정에 GA4 필드 타입/기본값 추가

SettingsData에 ga4_property_id, ga4_service_account_json 추가.
DEFAULT_SETTINGS에 빈 문자열 기본값 추가."
```

---

### Task 8: 관리자 설정 UI — Google Analytics 섹션 UI

**Files:**
- Modify: `src/app/admin/settings/page.tsx`

기존 `google_analytics_id` 입력란이 있는 카드(사이트 기본 설정)는 놔두고, 그 카드 **바로 아래**에 새 "Google Analytics" 카드를 삽입한다. 기존 `google_analytics_id` 입력란은 그 새 카드로 **이동**한다.

- [ ] **Step 1: 기존 google_analytics_id 블록 위치 확인**

```bash
cd /path/to/production-source && grep -n "google_analytics_id\|Google Analytics ID\|사이트 기본 설정" src/app/admin/settings/page.tsx
```

기존 `<div className="grid gap-2">` ~ `</div>` 블록 (Label = "Google Analytics ID", Input id = "google_analytics_id") 의 줄 번호를 메모.
또한 첫 카드(`사이트 기본 설정`)가 끝나는 `</Card>` 위치와, 그 다음 `{/* 회원 설정 */}` 주석이 나오는 위치를 확인.

- [ ] **Step 2: 기존 `google_analytics_id` 입력 블록 제거**

사이트 기본 설정 카드 내부의 `google_analytics_id` 입력 `<div className="grid gap-2"> ... </div>` 전체를 삭제한다. 대상 블록 원형:

```tsx
                <div className="grid gap-2">
                  <Label htmlFor="google_analytics_id">Google Analytics ID</Label>
                  <Input
                    id="google_analytics_id"
                    value={settings.google_analytics_id}
                    onChange={(e) => handleChange('google_analytics_id', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                  <p className="text-sm text-muted-foreground">
                    Google Analytics 측정 ID를 입력하면 자동으로 추적 코드가 삽입됩니다
                  </p>
                </div>
```

이 블록을 통째로 삭제 (사이트 기본 설정 카드에서 빼냄).

- [ ] **Step 3: `BarChart3` 아이콘 import 추가**

파일 상단 import 블록에서 lucide-react import를 찾아 `BarChart3`를 추가한다. 기존 import 예시:

```ts
import { Globe, Users, Image as ImageIcon, Palette, Upload, Trash2, Link as LinkIcon, X as XIcon, Plus } from "lucide-react"
```

`BarChart3`를 목록에 추가:

```ts
import { Globe, Users, Image as ImageIcon, Palette, Upload, Trash2, Link as LinkIcon, X as XIcon, Plus, BarChart3 } from "lucide-react"
```

실제 기존 파일의 import 목록에 맞춰 `BarChart3`만 추가하면 된다.

- [ ] **Step 4: "Google Analytics" 카드 상태 및 핸들러 추가**

`SettingsPage` 컴포넌트의 state 선언 근처에 다음 state를 추가한다. 위치는 `const [saving, setSaving] = useState(false)` 같은 기존 state들 바로 아래:

```ts
  // Google Analytics 섹션 전용 상태
  const [gaJsonEditing, setGaJsonEditing] = useState(false)
  const [gaJsonDraft, setGaJsonDraft] = useState('')
  const [gaTestResult, setGaTestResult] = useState<
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'success'; propertyId: string; todayUsers: number }
    | { status: 'error'; message: string }
  >({ status: 'idle' })

  const handleGaJsonEdit = () => {
    setGaJsonDraft(settings.ga4_service_account_json || '')
    setGaJsonEditing(true)
  }

  const handleGaJsonCancel = () => {
    setGaJsonEditing(false)
    setGaJsonDraft('')
  }

  const handleGaJsonApply = () => {
    handleChange('ga4_service_account_json', gaJsonDraft)
    setGaJsonEditing(false)
    setGaJsonDraft('')
  }

  const handleGaTest = async () => {
    setGaTestResult({ status: 'loading' })
    try {
      const res = await fetch('/api/admin/analytics/test', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        setGaTestResult({ status: 'success', propertyId: data.propertyId, todayUsers: data.todayUsers })
      } else {
        setGaTestResult({ status: 'error', message: data.error || '알 수 없는 오류' })
      }
    } catch (err) {
      setGaTestResult({ status: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }
```

- [ ] **Step 5: "Google Analytics" 카드 JSX 삽입**

사이트 기본 설정 카드 (`{/* 사이트 기본 설정 */}`) 가 끝나는 `</Card>` 바로 아래, `{/* 회원 설정 */}` 주석 **위**에 다음 JSX 블록을 삽입한다:

```tsx
            {/* Google Analytics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Google Analytics
                </CardTitle>
                <CardDescription>
                  방문자 통계 위젯에 사용되는 GA4 연동 설정입니다
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-3 text-sm">
                  <p className="font-medium mb-1">💡 Google Analytics 연동</p>
                  <p className="text-muted-foreground">
                    방문자 통계 위젯을 사용하려면 GA4 Data API 연동이 필요합니다.{' '}
                    <a
                      href="https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-blue-700 dark:text-blue-400"
                    >
                      설정 가이드
                    </a>
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="google_analytics_id">Measurement ID</Label>
                  <Input
                    id="google_analytics_id"
                    value={settings.google_analytics_id}
                    onChange={(e) => handleChange('google_analytics_id', e.target.value)}
                    placeholder="G-XXXXXXXXXX"
                  />
                  <p className="text-sm text-muted-foreground">
                    방문자 추적 스크립트에 사용됩니다 (1단계에서 발급)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ga4_property_id">GA4 Property ID</Label>
                  <Input
                    id="ga4_property_id"
                    value={settings.ga4_property_id}
                    onChange={(e) => handleChange('ga4_property_id', e.target.value)}
                    placeholder="412345678"
                  />
                  <p className="text-sm text-muted-foreground">
                    데이터 조회 API에 사용됩니다 (GA4 관리 → 속성 설정에서 확인)
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ga4_service_account_json">Service Account JSON</Label>
                  {!gaJsonEditing ? (
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                      {settings.ga4_service_account_json ? (
                        <span className="text-sm text-green-700 dark:text-green-400">
                          ✓ 저장됨 (Service Account 키)
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          저장된 키가 없습니다
                        </span>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="ml-auto"
                        onClick={handleGaJsonEdit}
                      >
                        {settings.ga4_service_account_json ? '변경' : '입력'}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea
                        id="ga4_service_account_json"
                        value={gaJsonDraft}
                        onChange={(e) => setGaJsonDraft(e.target.value)}
                        placeholder='{"type":"service_account","project_id":"...","private_key":"..."}'
                        rows={8}
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                      />
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={handleGaJsonApply}>
                          적용
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleGaJsonCancel}>
                          취소
                        </Button>
                      </div>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Google Cloud에서 다운로드한 JSON 키 전체 내용 (2단계에서 발급)
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGaTest}
                    disabled={gaTestResult.status === 'loading'}
                  >
                    {gaTestResult.status === 'loading' ? '테스트 중...' : '연결 테스트'}
                  </Button>
                  {gaTestResult.status === 'success' && (
                    <span className="text-sm text-green-700 dark:text-green-400">
                      ✓ 연결됨 — Property {gaTestResult.propertyId} (오늘 {gaTestResult.todayUsers.toLocaleString('ko-KR')}명)
                    </span>
                  )}
                  {gaTestResult.status === 'error' && (
                    <span className="text-sm text-red-600 dark:text-red-400">
                      ✗ {gaTestResult.message}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠ 연결 테스트는 현재 입력값이 아닌 <strong>저장된</strong> 설정을 검증합니다. 먼저 저장 버튼을 눌러주세요.
                </p>
              </CardContent>
            </Card>
```

- [ ] **Step 6: 빌드 통과 확인**

```bash
cd /path/to/production-source && npx next build 2>&1 | tail -10
```

Expected: 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
cd /path/to/production-source && git add src/app/admin/settings/page.tsx && git commit -m "feat(ga-widget): 관리자 설정에 Google Analytics 카드 추가

기존 Measurement ID 필드를 '사이트 기본 설정' 카드에서 독립된
'Google Analytics' 카드로 이동. GA4 Property ID, Service Account JSON
입력란 추가. JSON은 변경 버튼 방식으로 원문 노출 최소화. 연결 테스트
버튼으로 저장된 설정의 실제 GA API 호출을 검증."
```

---

### Task 9: 수동 검증

이 Task는 코드 변경 없이 실제 동작을 확인한다.

- [ ] **Step 1: 빌드**

```bash
cd /path/to/production-source && npx next build 2>&1 | tail -15
```

Expected: 빌드 성공. 새 라우트 두 개가 목록에 나타남:
- `ƒ /api/admin/analytics/test`
- `ƒ /api/analytics/ga-stats`

- [ ] **Step 2: 서버 재시작**

```bash
pm2 restart nexibase-home 2>&1 | tail -1
```

- [ ] **Step 3: API 동작 확인 (설정 없는 상태)**

```bash
curl -s https://nexibase.com/api/analytics/ga-stats
```

Expected: `{"online":0,"today":0,"yesterday":0,"sevenDays":0,"configured":false}`

- [ ] **Step 4: 관리자 설정 UI 확인**

브라우저에서 `https://nexibase.com/admin/settings` 접속. 로그인 후:

- "Google Analytics" 카드가 "사이트 기본 설정" 카드 바로 아래에 나타나는지 확인
- 필드 3개 표시: Measurement ID / GA4 Property ID / Service Account JSON
- Service Account JSON 필드는 "저장된 키가 없습니다" + `[입력]` 버튼
- `[입력]` 버튼 클릭 시 textarea 활성화, `[적용]` / `[취소]` 버튼 표시
- 맨 아래 `[연결 테스트]` 버튼 존재

- [ ] **Step 5: 연결 테스트 — 설정 없음 케이스**

Google Analytics 카드에서 모든 필드가 빈 상태로 `[연결 테스트]` 클릭.

Expected: 빨간 메시지 — "GA4 설정(Property ID + Service Account JSON)이 완료되지 않았거나 JSON 형식이 올바르지 않습니다."

- [ ] **Step 6: 위젯 자동 감지 확인**

`https://nexibase.com/admin/home-widgets` 접속. 미배치 위젯 목록에 **"방문자 통계"** 가 나타나는지 확인.

Expected: 항목 존재, 배치 가능.

- [ ] **Step 7: 위젯 배치 및 숨김 동작 확인 (설정 없음)**

위 화면에서 "방문자 통계" 위젯을 사이드바 영역에 배치. 홈페이지(`/`) 새로고침.

Expected: 위젯이 사이드바에 **나타나지 않음** (configured: false → return null).

네트워크 탭에서 `/api/analytics/ga-stats` 요청 확인 — 응답은 200 OK이지만 위젯은 렌더되지 않아야 함.

- [ ] **Step 8: 실제 GA 설정 입력 (사용자가 직접)**

사용자는 Google Cloud Console에서 다음을 준비:
1. GA4 속성의 Property ID (예: `412345678`)
2. 서비스 계정 JSON 키 파일 (`.json`)
3. GA4 속성 관리에서 해당 서비스 계정 이메일에 **뷰어 권한** 부여

관리자 설정 화면에서:
1. Property ID 입력
2. Service Account JSON 붙여넣기 (변경 버튼 → textarea → 적용)
3. **저장** 버튼 클릭 (DB에 upsert)
4. **연결 테스트** 버튼 클릭

Expected: 초록색 메시지 — "✓ 연결됨 — Property 412345678 (오늘 N명)"

실패 시 나타나는 에러 유형 참고:
- `PERMISSION_DENIED` → 서비스 계정에 뷰어 권한 미부여
- `NOT_FOUND` → Property ID 오타
- JSON 파싱 에러 → JSON 형식 잘못

- [ ] **Step 9: 위젯 데이터 표시 확인**

홈페이지 새로고침 후 사이드바에 "방문자 통계" 위젯 표시 확인:
- 첫 렌더 시 스켈레톤 바 (회색 pulse)
- 이후 숫자 4개 표시: 현재 접속 / 오늘 / 어제 / 지난 7일
- 현재 접속 숫자 옆에 녹색 ping 애니메이션

- [ ] **Step 10: 캐시 동작 확인**

```bash
time curl -s https://nexibase.com/api/analytics/ga-stats > /dev/null
time curl -s https://nexibase.com/api/analytics/ga-stats > /dev/null
```

Expected: 두 번째 호출이 첫 번째보다 현저히 빠름 (캐시 hit). 첫 번째는 GA API 왕복으로 수백 ms, 두 번째는 < 20ms 예상.

- [ ] **Step 11: 폴링 확인**

홈페이지에서 개발자 도구 네트워크 탭 열어둔 채 2분 기다림.

Expected: 120초 후 `/api/analytics/ga-stats` 요청이 한 번 더 발생.

---

## Self-Review

**Spec coverage:**

- [x] 관리자 설정에 Property ID + Service Account JSON 입력 (Task 7, 8)
- [x] 기존 Measurement ID는 별도 Google Analytics 카드로 이동 (Task 8)
- [x] 변경 버튼 방식 JSON 필드 (Task 8, handleGaJsonEdit/Apply/Cancel)
- [x] 연결 테스트 버튼 (Task 8, handleGaTest)
- [x] 연결 테스트 API (Task 3)
- [x] gaClient 헬퍼 — settings 읽기, credentials hash 캐시 (Task 2)
- [x] stats API — 4개 지표 병렬, 인메모리 캐시 + inflight guard (Task 4)
- [x] VisitorStats 위젯 — 스켈레톤 UI, 120s 폴링, configured: false 시 숨김 (Task 5, 6)
- [x] `@google-analytics/data` 의존성 (Task 1)
- [x] 수동 검증 (Task 9)

**Placeholder scan:** "TBD" / "TODO" / "fill in" / "similar to" 없음. 모든 step에 실제 코드/커맨드 포함.

**Type/Name consistency:**

- `Stats` 인터페이스: Task 4(API), Task 6(위젯)에서 동일 필드 `online/today/yesterday/sevenDays/configured` 사용 ✓
- `GaClient` 인터페이스: Task 2에서 정의(`propertyId`, `dataClient`), Task 3/4에서 동일하게 사용 ✓
- Settings 키 이름 `ga4_property_id`, `ga4_service_account_json`: Task 2(gaClient), Task 7(타입/기본값), Task 8(UI)에서 일관 사용 ✓
- 캐시 상수: `CACHE_TTL_MS = 120 * 1000` (Task 4), `POLL_INTERVAL_MS = 120_000` (Task 6) — 값 일치 ✓
- 위젯 키: `visitor-stats` (스캔 플러그인 자동 변환) — Task 6 검증 step 포함 ✓

**Ordering check:** Task 1(의존성) → Task 2(gaClient, 의존성 사용) → Task 3(test API, gaClient 사용) → Task 4(stats API, gaClient 사용) → Task 5(위젯 메타) → Task 6(위젯 컴포넌트, stats API 호출) → Task 7(SettingsData 타입) → Task 8(UI, test API 호출) → Task 9(전체 동작 검증). 각 Task의 의존성이 이전 Task에서 모두 준비됨.

**파일 구조 일관성:** 각 파일이 단일 책임 갖도록 분리. gaClient는 인증만, stats API는 캐시/집계, test API는 검증만, 위젯은 UI만. 관리자 settings page만 state+UI가 한 파일에 있지만 이는 기존 구조 따름.
