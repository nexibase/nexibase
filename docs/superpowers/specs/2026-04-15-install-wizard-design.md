# Install Wizard 설계 문서

**작성일:** 2026-04-15
**버전 대상:** Nexibase v0.13.0 (예정)
**작성자:** brainstorming 세션 기반 합의 설계

---

## 1. 목적과 범위

Nexibase 첫 실행 시 관리자가 언어(EN/KO)를 고르고 관리자 계정·사이트 정보를 입력해 운영 가능 상태로 초기화하는 WordPress 스타일 install wizard를 구현한다.

**사용 대상:**
- Nexibase를 clone해서 로컬 `npm run dev`로 처음 실행하는 개발자
- 프로덕션 서버에 배포 후 첫 접속한 운영자

두 역할 모두 동일한 wizard를 거친다.

**범위 외:**
- 기존 사이트의 언어 변경 (install 이후 `site_locale`은 고정)
- 다국어 병행 운영 (단일 언어 원칙)
- 자동 기계 번역 런타임 (Google Translate API 등 연동 없음)
- 플러그인 활성/비활성 (install wizard에서 다루지 않음, 관리자 페이지에서 처리)
- shop 플러그인의 상품·주문 seed (shop 자체 seed 인프라가 있음)

---

## 2. 핵심 원칙

1. **단일 언어 운영** — 설치 시 선택한 언어가 사이트의 유일한 언어가 된다. 이후 언어 변경은 `reset-install` 후 재설치로만 가능.
2. **1회성 실행** — `site_initialized` 플래그로 중복 설치를 차단.
3. **미들웨어 주도** — 설치 전엔 모든 경로가 `/install`로 리다이렉트, 설치 후엔 `/install`이 `/admin`으로 리다이렉트.
4. **트랜잭션 보장** — 설치 과정의 DB 작업은 단일 트랜잭션. 중간 실패 시 전체 롤백.
5. **드롭인 언어 확장** — 새 언어는 `src/locales/{locale}.json`과 `src/lib/install/seed-{locale}.ts` 파일 2개만 추가하면 `scan-plugins`가 자동 등록.

---

## 3. 감지 로직

**첫 실행으로 판단하는 조건:** 다음 두 조건이 **모두** 참일 때.

1. `users` 테이블에 레코드가 하나도 없음 (`prisma.user.count() === 0`)
2. `settings` 테이블에 `site_initialized` 키가 없거나 값이 `'true'`가 아님

두 조건 모두 만족하면 **미설치 상태**로 간주하고 `/install`로 리다이렉트한다.

설치 완료 후 `site_initialized='true'`가 심기면 이후 모든 요청에서 in-memory 캐시로 판단 (DB 조회 1회 후 프로세스 수명 동안 캐시).

---

## 4. Wizard 단계

### 4.1 Step 1: 언어 선택

**URL:** `/install`

**화면 구성:**
- Nexibase 로고 + 버전
- 하드코딩 타이틀: `Select Your Language / 언어를 선택하세요`
- 자동 감지된 모든 지원 언어 버튼 (기본: `[English]`, `[한국어]`)
- 하단에 `Nexibase v{package.version}` 표시

**버튼 소스:** `src/lib/install/_generated-registry.ts`에서 `localeRegistry`를 import해 동적 렌더링. 각 entry의 `displayName`을 버튼 라벨로 사용.

**버튼 클릭 동작:** `/install/setup?locale={code}`로 이동.

**중요:** Step 1 화면 자체는 **번역되지 않는다**. 이 시점엔 locale이 결정되지 않았으므로 모든 라벨을 영문/한국어 혼용 형태로 하드코딩한다.

### 4.2 Step 2: 관리자 + 사이트 정보

**URL:** `/install/setup?locale={en|ko}`

**화면 구성:**
- Step 1 다시 선택 가능한 "뒤로" 링크
- 폼 (선택한 locale의 번역 messages 적용)
- 제출 버튼 (예: `Install` / `설치`)

**폼 필드:**

| 필드 | 타입 | 필수 | 유효성 |
|---|---|---|---|
| `adminEmail` | email | ✓ | RFC 형식, 최대 255자 |
| `adminPassword` | password | ✓ | 최소 8자, 영문+숫자 포함 |
| `adminPasswordConfirm` | password | ✓ | `adminPassword`와 일치 |
| `adminNickname` | text | ✓ | 2~50자 |
| `siteName` | text | ✓ | 1~100자 |
| `siteDescription` | textarea | ✗ | 최대 500자, 비워도 됨 |

**제출 시 동작:** `POST /api/install`로 필드 값과 `locale`을 전달. 응답 성공 시 `/admin/login`으로 이동.

### 4.3 Step 2 locale 적용 방식

`/install/setup`의 `NextIntlClientProvider`가 `?locale=` 쿼리 파라미터를 읽어 해당 언어의 messages를 로드한다. 이 시점엔 `site_locale` 설정이 아직 없으므로 쿼리 기반 locale이 우선된다.

기술적 고려: next-intl의 `getRequestConfig`가 쿼리 파라미터를 읽을 수 있도록 install 경로 전용 분기를 추가하거나, Step 2 페이지를 서버 컴포넌트가 아니라 클라이언트에서 messages를 동적으로 로드하도록 구성한다.

---

## 5. 파일 구조

### 5.1 신규 생성 파일

```
src/app/install/
├── page.tsx                  # Step 1: 언어 선택 (하드코딩 라벨)
├── setup/page.tsx            # Step 2: 관리자 + 사이트 정보 폼
└── layout.tsx                # install 전용 레이아웃 (헤더 등 제외)

src/app/api/install/
└── route.ts                  # POST: 설치 실행 / GET: 상태 조회

src/lib/install/
├── types.ts                  # SeedData 인터페이스
├── seed-en.ts                # 영문 seed 데이터 + displayName
├── seed-ko.ts                # 한국어 seed 데이터 + displayName
├── runInstall.ts             # 트랜잭션 실행자
└── _generated-registry.ts    # 자동 생성 (gitignored)

src/i18n/
└── _generated-locales.ts     # 자동 생성 (gitignored)

scripts/
└── reset-install.js          # 데이터 초기화 스크립트
```

### 5.2 수정 파일

```
src/proxy.ts                  # install 체크 로직 최우선 추가
src/i18n/routing.ts           # SUPPORTED_LOCALES import 사용
src/i18n/request.ts           # site_locale 설정 기반 locale 결정
scripts/scan-plugins.js       # locale 스캔 로직 추가
.gitignore                    # 신규 _generated 파일 제외
package.json                  # reset-install 스크립트 등록
```

### 5.3 `install` 경로 위치

`src/app/[locale]/install/`이 아니라 `src/app/install/`에 둔다. 이유: install 시점엔 아직 `site_locale`이 없으므로 `[locale]` 세그먼트 아래에서 처리하면 next-intl 라우팅이 애매해진다. Install 경로를 `[locale]` 밖에 두면 미들웨어에서 locale 처리 없이 직접 렌더링 가능.

---

## 6. 미들웨어 로직

`src/proxy.ts`의 `proxy` 함수에 **최우선** 처리로 install 체크 추가.

```typescript
let cachedInitialized: boolean | null = null

async function isInstalled(): Promise<boolean> {
  if (cachedInitialized === true) return true
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'site_initialized' },
    })
    const installed = setting?.value === 'true'
    if (installed) cachedInitialized = true
    return installed
  } catch {
    return false
  }
}

const ALLOWED_WHEN_NOT_INSTALLED = [
  '/install',
  '/api/install',
  '/_next/',
  '/favicon.ico',
]

function isAllowedWhenNotInstalled(pathname: string): boolean {
  return ALLOWED_WHEN_NOT_INSTALLED.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}
```

**리다이렉트 규칙:**

| 상태 | 요청 경로 | 동작 |
|---|---|---|
| 미설치 | `/install`·`/api/install/*`·정적 리소스 | 통과 |
| 미설치 | 그 외 모든 경로 | `/install`로 리다이렉트 |
| 설치됨 | `/install`·`/install/*` | `/admin`으로 리다이렉트 |
| 설치됨 | 그 외 | 기존 로직(플러그인 체크·next-intl) 진행 |

**캐시 무효화:**
- 설치 성공 직후 `cachedInitialized = true`로 직접 설정
- 리셋 스크립트 실행 후엔 dev 서버 재시작 필요 (안내문으로 사용자에게 명시)

---

## 7. Locale 결정 전략

### 7.1 `routing.ts`

```typescript
import { defineRouting } from 'next-intl/routing'
import { SUPPORTED_LOCALES } from './_generated-locales'

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: 'en',
  localePrefix: 'never',
})
```

### 7.2 `request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'
import { prisma } from '@/lib/prisma'

let cachedLocale: string | null = null

async function getSiteLocale(): Promise<string> {
  if (cachedLocale) return cachedLocale
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'site_locale' },
    })
    cachedLocale = setting?.value || 'en'
    return cachedLocale
  } catch {
    return 'en'
  }
}

export default getRequestConfig(async () => {
  const locale = await getSiteLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

**캐시 무효화:**
- 설치 성공 직후 `cachedLocale = params.locale`로 직접 설정
- 리셋 스크립트 후 dev 서버 재시작 필요

### 7.3 Install 경로의 예외 처리

Install 페이지(`/install`, `/install/setup`)는 `src/app/install/` 아래에 있어 `[locale]` 세그먼트 밖이다. `request.ts`가 어떤 locale을 반환하든 install 페이지는 자체적으로 locale을 결정한다:

- Step 1: 하드코딩 영문/한국어 라벨 (next-intl 사용 안 함)
- Step 2: 쿼리 파라미터 `?locale=`을 읽어 클라이언트에서 동적 로드 (필요 시 별도의 `NextIntlClientProvider` 래핑)

**주의:** `cachedLocale` 사용 시 Step 2에서 방문자가 여러 locale로 폼을 반복 제출할 가능성 — install은 1회성이므로 이 시나리오는 실질적으로 발생하지 않음.

---

## 8. Seed 데이터 계약

### 8.1 `types.ts`

```typescript
export interface SeedBoard {
  slug: string
  name: string
  description: string | null
  category?: string | null
  isActive?: boolean
  useComment?: boolean
  useReaction?: boolean
}

export interface SeedMenu {
  position: 'header' | 'footer'
  label: string
  url: string
  sortOrder: number
}

export interface SeedWidget {
  widgetKey: string
  zone: string
  title: string
  colSpan: number
  rowSpan: number
  sortOrder: number
}

export interface SeedContent {
  slug: string
  title: string
  content: string
  isPublic: boolean
}

export interface SeedPolicy {
  slug: string
  version: string
  title: string
  content: string
  isActive: boolean
}

export interface SeedData {
  boards: SeedBoard[]
  menus: SeedMenu[]
  widgets: SeedWidget[]
  contents: SeedContent[]
  policies: SeedPolicy[]
}
```

### 8.2 각 seed 파일 형식

**`src/lib/install/seed-en.ts`:**

```typescript
import type { SeedData } from './types'

export const displayName = 'English'

export const seedEn: SeedData = {
  boards: [
    {
      slug: 'free',
      name: 'Free Board',
      description: 'A place to chat freely about anything.',
      isActive: true,
      useComment: true,
      useReaction: true,
    },
  ],
  menus: [
    { position: 'header', label: 'Home', url: '/', sortOrder: 0 },
    { position: 'header', label: 'Board', url: '/boards/free', sortOrder: 1 },
    { position: 'header', label: 'Login', url: '/login', sortOrder: 2 },
    { position: 'footer', label: 'Terms of Service', url: '/policies/terms', sortOrder: 0 },
    { position: 'footer', label: 'Privacy Policy', url: '/policies/privacy', sortOrder: 1 },
  ],
  widgets: [
    {
      widgetKey: 'welcome-banner',
      zone: 'top',
      title: 'Welcome Banner',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
    {
      widgetKey: 'latest-posts',
      zone: 'center',
      title: 'Latest Posts',
      colSpan: 12,
      rowSpan: 1,
      sortOrder: 0,
    },
  ],
  contents: [
    {
      slug: 'about',
      title: 'About Us',
      content: '<h2>Welcome to our site</h2><p>This is a sample "About Us" page. Edit it in the admin panel to introduce your site.</p>',
      isPublic: true,
    },
  ],
  policies: [
    {
      slug: 'terms',
      version: '1.0',
      title: 'Terms of Service',
      content: '<h2>Terms of Service</h2><p>These are placeholder terms. Please replace with your own terms of service in the admin panel before going live.</p>',
      isActive: true,
    },
    {
      slug: 'privacy',
      version: '1.0',
      title: 'Privacy Policy',
      content: '<h2>Privacy Policy</h2><p>This is a placeholder privacy policy. Please replace it with your own privacy policy in the admin panel before collecting user data.</p>',
      isActive: true,
    },
  ],
}
```

**`src/lib/install/seed-ko.ts`:**

같은 구조에 한국어 값. `displayName = '한국어'`.

---

## 9. Install 실행 로직 (`runInstall.ts`)

```typescript
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { localeRegistry } from './_generated-registry'

export interface InstallParams {
  locale: string
  adminEmail: string
  adminPassword: string
  adminNickname: string
  siteName: string
  siteDescription: string
}

export async function runInstall(params: InstallParams): Promise<void> {
  const entry = localeRegistry[params.locale]
  if (!entry) throw new Error(`Unknown locale: ${params.locale}`)

  const seed = entry.seed
  const hashedPw = await bcrypt.hash(params.adminPassword, 10)

  await prisma.$transaction(async (tx) => {
    // 0. 경쟁 상태 재확인
    const existing = await tx.setting.findUnique({ where: { key: 'site_initialized' } })
    if (existing?.value === 'true') {
      throw new Error('ALREADY_INSTALLED')
    }

    // 1. Admin 계정
    await tx.user.create({
      data: {
        email: params.adminEmail,
        password: hashedPw,
        nickname: params.adminNickname,
        role: 'admin',
        status: 'active',
        emailVerified: new Date(),
      },
    })

    // 2. 핵심 설정
    await tx.setting.createMany({
      data: [
        { key: 'site_name', value: params.siteName },
        { key: 'site_description', value: params.siteDescription || '' },
        { key: 'site_locale', value: params.locale },
        { key: 'signup_enabled', value: 'true' },
      ],
    })

    // 3. Seed 데이터
    for (const b of seed.boards) await tx.board.create({ data: b })
    for (const m of seed.menus) await tx.menu.create({ data: m })
    for (const w of seed.widgets) await tx.homeWidget.create({ data: w })
    for (const c of seed.contents) await tx.content.create({ data: c })
    for (const p of seed.policies) await tx.policy.create({ data: p })

    // 4. 마지막에 완료 플래그 (중간 실패 시 재시도 가능)
    await tx.setting.create({ data: { key: 'site_initialized', value: 'true' } })
  })
}
```

**핵심:**
- `site_initialized`는 **맨 마지막에** 심는다. 중간 실패 시 부분 상태가 남지만 플래그가 없으므로 재설치 가능.
- 트랜잭션 내에서 다시 한 번 `ALREADY_INSTALLED` 체크 → 동시 요청 방지.

---

## 10. API 라우트 (`/api/install/route.ts`)

### 10.1 POST

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runInstall, InstallParams } from '@/lib/install/runInstall'
import { localeRegistry } from '@/lib/install/_generated-registry'

function validate(body: unknown): { ok: true; params: InstallParams } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {}
  const b = body as Record<string, string | undefined>

  if (!b.locale || !(b.locale in localeRegistry)) {
    errors.locale = 'Unsupported locale'
  }
  if (!b.adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.adminEmail)) {
    errors.adminEmail = 'Invalid email format'
  }
  if (!b.adminPassword || b.adminPassword.length < 8) {
    errors.adminPassword = 'Password must be at least 8 characters'
  } else if (!/[a-zA-Z]/.test(b.adminPassword) || !/[0-9]/.test(b.adminPassword)) {
    errors.adminPassword = 'Password must include letters and numbers'
  }
  if (b.adminPassword !== b.adminPasswordConfirm) {
    errors.adminPasswordConfirm = 'Passwords do not match'
  }
  if (!b.adminNickname || b.adminNickname.length < 2 || b.adminNickname.length > 50) {
    errors.adminNickname = 'Nickname must be 2-50 characters'
  }
  if (!b.siteName || b.siteName.length < 1 || b.siteName.length > 100) {
    errors.siteName = 'Site name must be 1-100 characters'
  }
  if (b.siteDescription && b.siteDescription.length > 500) {
    errors.siteDescription = 'Site description must be 500 characters or less'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return { ok: true, params: b as unknown as InstallParams }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validate(body)
    if (!validation.ok) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 })
    }
    await runInstall(validation.params)
    return NextResponse.json({ success: true, redirectTo: '/admin/login' })
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_INSTALLED') {
      return NextResponse.json({ error: 'Site is already installed' }, { status: 409 })
    }
    console.error('[install] failed:', err)
    return NextResponse.json({ error: 'Installation failed' }, { status: 500 })
  }
}
```

### 10.2 GET

`/api/install` GET은 현재 지원 언어 목록을 반환해 Step 1 클라이언트가 레지스트리를 확인할 수 있도록 한다 (optional — Step 1 페이지가 서버 컴포넌트면 직접 import하므로 불필요할 수도 있음).

---

## 11. scan-plugins.js 확장

기존 `scripts/scan-plugins.js`에 locale 스캔 로직 추가.

**의사 코드:**

```javascript
function scanLocales() {
  const localesDir = path.join(__dirname, '..', 'src', 'locales')
  const seedDir = path.join(__dirname, '..', 'src', 'lib', 'install')

  const messageFiles = fs.readdirSync(localesDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))

  const supported = messageFiles.filter(locale => {
    return fs.existsSync(path.join(seedDir, `seed-${locale}.ts`))
  })

  // _generated-locales.ts
  const localesContent = `// AUTO-GENERATED by scripts/scan-plugins.js
export const SUPPORTED_LOCALES = [${supported.map(l => `'${l}'`).join(', ')}] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]
`
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'i18n', '_generated-locales.ts'), localesContent)

  // _generated-registry.ts
  const imports = supported.map(l =>
    `import { seed${l[0].toUpperCase()}${l.slice(1)}, displayName as displayName${l[0].toUpperCase()}${l.slice(1)} } from './seed-${l}'`
  ).join('\n')
  const entries = supported.map(l =>
    `  ${l}: { displayName: displayName${l[0].toUpperCase()}${l.slice(1)}, seed: seed${l[0].toUpperCase()}${l.slice(1)} }`
  ).join(',\n')
  const registryContent = `// AUTO-GENERATED by scripts/scan-plugins.js
${imports}
import type { SeedData } from './types'

export const localeRegistry: Record<string, { displayName: string; seed: SeedData }> = {
${entries}
}
`
  fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'install', '_generated-registry.ts'), registryContent)

  console.log(`[scan-plugins] Registered ${supported.length} locale(s): ${supported.join(', ')}`)
}

scanLocales()
```

**호출 위치:** `scanPlugins()` 함수 말미에 `scanLocales()` 추가.

---

## 12. 리셋 스크립트 (`scripts/reset-install.js`)

### 12.1 안전 장치

1. **NODE_ENV 가드:** `process.env.NODE_ENV === 'production'`이면 즉시 종료
2. **`--confirm` 플래그 필수:** 없으면 사용법만 출력하고 종료
3. **상태 요약:** 삭제 대상 건수를 미리 출력
4. **5초 카운트다운:** Ctrl+C로 취소 가능

### 12.2 삭제 대상

```
settings, contents, policies, home_widgets, menus, boards, users
```

(FK cascade로 posts·comments·reactions·attachments 등 연쇄 삭제)

**보존:**
- shop 플러그인 데이터 (products, orders 등)
- `_prisma_migrations` 테이블

### 12.3 사용법

```bash
npm run reset-install -- --confirm
```

### 12.4 완료 후 안내

```
완료. Next.js dev 서버를 재시작하고 http://localhost:3001/ 에 접속하면
install wizard로 리다이렉트됩니다.
⚠️  dev 서버가 실행 중이라면 재시작해야 locale 캐시가 초기화됩니다.
```

---

## 13. 드롭인 언어 확장 흐름

새 언어 추가 시 기여자가 수행할 절차:

1. **`src/locales/{locale}.json` 생성** — `en.json` 복사 후 모든 value를 해당 언어로 번역 (서브에이전트 가능)
2. **`src/lib/install/seed-{locale}.ts` 생성** — `seed-en.ts` 복사 후 `displayName`과 모든 문자열 번역 (서브에이전트 가능)
3. **`npm run dev` 실행** — scan-plugins가 자동으로 `_generated-locales.ts`와 `_generated-registry.ts`를 재생성
4. **로컬 확인** — `/install` 페이지에 새 언어 버튼이 등장하는지 브라우저로 검증
5. **PR 오픈** — 파일 2개만 포함. 자동 생성 파일은 gitignored라 PR에 안 포함됨
6. **머지 후** — 모든 사용자가 `git pull && npm run dev`하면 새 언어가 자동 등장

**코드 수정 0줄.** 병렬 PR 간 충돌 없음 (각자 다른 파일만 추가).

---

## 14. 테스트 전략

### 14.1 수동 smoke test

1. `npm run reset-install -- --confirm` 실행 → 데이터 초기화 확인
2. dev 서버 재시작: `npm run dev`
3. `http://localhost:3001/` 접속 → `/install`로 자동 리다이렉트 확인
4. Step 1: `[English]` 클릭 → Step 2 폼에 영문 라벨 표시 확인
5. Step 2: 모든 필드 입력 → `Install` 클릭
6. 리다이렉트: `/admin/login`으로 이동 확인
7. 방금 만든 계정으로 로그인 → `/admin` 대시보드 진입 확인
8. 사이드바 각 관리 페이지에서 seed 데이터 확인:
   - `/admin/boards`: "Free Board" 1개
   - `/admin/menus`: 헤더 3·푸터 2개
   - `/admin/home-widgets`: Welcome Banner·Latest Posts
   - `/admin/contents`: About 1개
   - `/admin/policies`: Terms·Privacy 2개
   - `/admin/settings`: site_name·site_description·site_locale 입력값 확인
9. 홈(`/`) 접속 → 헤더 메뉴·위젯 정상 렌더링 확인
10. 다시 `/install` 접속 시도 → `/admin`으로 리다이렉트 확인 (재설치 차단)
11. 리셋 후 한국어로 같은 흐름 재테스트

### 14.2 자동 테스트

제외. Nexibase에는 E2E 테스트 인프라가 없고, install wizard는 DB 전체를 건드리는 1회성 플로우라 단위 테스트로 커버하기 어렵다. 수동 smoke test로 충분.

---

## 15. 알려진 제약

1. **`cachedInitialized`·`cachedLocale`은 프로세스 로컬 캐시** — 멀티 인스턴스 배포 시 한 인스턴스에서 설치 완료 후 다른 인스턴스는 여전히 미설치로 판단할 수 있음. 해결책: 캐시 TTL(예: 10초) 또는 Redis 공유 캐시. 1차 구현에서는 1인스턴스 전제로 단순 캐시 유지.
2. **리셋 후 dev 서버 재시작 필요** — `cachedInitialized`와 `cachedLocale`을 프로세스 메모리에 저장하므로 리셋만으로는 캐시가 자동 초기화되지 않음. 리셋 스크립트 출력에 재시작 안내 포함.
3. **Install 중 사용자가 브라우저 뒤로가기** — Step 2에서 뒤로가면 Step 1으로 돌아감. URL 쿼리 기반이라 상태 유지됨. 정상 동작.
4. **동시에 여러 사용자가 Step 2 제출** — 트랜잭션 내부에서 `ALREADY_INSTALLED` 체크하므로 두 번째 요청은 409로 거부됨.

---

## 16. 범위 외 / Future Work

- 설치 wizard에서 DB 연결 테스트 (현재는 이미 DB가 연결된 상태 전제)
- 설치 wizard에서 SMTP 설정 (회원가입 이메일 인증용)
- 설치 wizard에서 admin 2FA 설정
- 멀티 인스턴스 캐시 동기화
- 설치 wizard 자체의 E2E 테스트
- shop 플러그인 데이터 초기화 옵션 (`--include-plugins` 플래그)

---

## 17. 체크리스트 (구현 시 확인)

- [ ] `src/app/install/` 경로가 `[locale]` 밖에 위치하는지
- [ ] 미들웨어에서 install 체크가 **최우선**으로 실행되는지
- [ ] `site_initialized` 플래그가 트랜잭션 맨 마지막에 심기는지
- [ ] 리셋 스크립트가 `NODE_ENV=production`에서 거부하는지
- [ ] 리셋 스크립트가 `--confirm` 없이 거부하는지
- [ ] scan-plugins가 `_generated-locales.ts`와 `_generated-registry.ts`를 생성하는지
- [ ] `.gitignore`에 두 생성 파일이 추가됐는지
- [ ] Step 1 페이지가 next-intl 없이 하드코딩 라벨로 렌더링되는지
- [ ] Step 2 페이지가 쿼리 파라미터의 locale로 messages를 로드하는지
- [ ] 설치 성공 후 캐시 플래그가 갱신되는지
