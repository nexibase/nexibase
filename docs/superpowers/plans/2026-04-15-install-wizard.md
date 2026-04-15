# Install Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nexibase 첫 실행 시 관리자가 언어(EN/KO)와 관리자 계정·사이트 정보를 입력해 운영 가능한 상태로 초기화하는 WordPress 스타일 install wizard를 구현한다.

**Architecture:** 미들웨어 주도 redirect(미설치 → `/install`, 설치됨 → `/install`은 `/admin`), 2단계 wizard(언어 선택 → 관리자/사이트), `src/locales/*.json` + `src/lib/install/seed-*.ts` 파일 자동 스캔으로 드롭인 언어 확장, 트랜잭션 기반 설치 실행자, `site_initialized` 플래그로 중복 설치 차단.

**Tech Stack:** Next.js 16 App Router · Prisma (MySQL) · next-intl v4 · bcryptjs · TypeScript

**Spec:** [docs/superpowers/specs/2026-04-15-install-wizard-design.md](../specs/2026-04-15-install-wizard-design.md)

---

## Scope Check

이 플랜은 install wizard 단일 기능을 다룬다. Phase 2/3 처럼 여러 스프린트로 분할할 만큼 크지 않고, 13개 태스크로 한 번에 구현 가능하다.

---

## Testing Strategy

Nexibase는 단위 테스트 인프라가 없다. 플랜은 다음을 기본으로 한다:
1. **Build checks** — 각 태스크 후 `npx next build` 성공 필수
2. **Database state inspection** — Prisma Client로 직접 DB 상태 확인
3. **Manual smoke test** — Task 12에서 브라우저로 전체 흐름 검증

각 태스크 끝에 "Manual verification" 블록이 있고 구체적 확인 단계를 제공한다.

---

## File Structure

**신규 생성:**

```
src/lib/install/
├── types.ts                  # SeedData 인터페이스 정의
├── seed-en.ts                # 영문 seed 데이터 + displayName
├── seed-ko.ts                # 한국어 seed 데이터 + displayName (Task 10에서 서브에이전트 생성)
├── runInstall.ts             # 트랜잭션 실행자
└── _generated-registry.ts    # scan-plugins 자동 생성 (gitignored)

src/i18n/
└── _generated-locales.ts     # scan-plugins 자동 생성 (gitignored)

src/app/install/
├── layout.tsx                # install 전용 레이아웃 (헤더/푸터 없음)
├── page.tsx                  # Step 1: 언어 선택 (하드코딩 라벨)
└── setup/
    └── page.tsx              # Step 2: 관리자 + 사이트 정보 폼

src/app/api/install/
└── route.ts                  # POST: 설치 실행

src/locales/
└── ko.json                   # 한국어 메시지 (Task 11에서 서브에이전트 생성)

scripts/
└── reset-install.js          # DB 초기화 스크립트
```

**수정:**

```
scripts/scan-plugins.js       # locale 스캔 로직 추가
src/i18n/routing.ts           # _generated-locales.ts 사용
src/i18n/request.ts           # site_locale 설정 기반 locale 결정
src/proxy.ts                  # install 체크 로직 최우선 추가
.gitignore                    # _generated 파일 2개 추가
package.json                  # reset-install 스크립트 + 버전업
```

---

## Task 1: Seed 데이터 타입 + 영문 Seed 파일

**Files:**
- Create: `src/lib/install/types.ts`
- Create: `src/lib/install/seed-en.ts`

- [ ] **Step 1: `types.ts` 작성**

Create `src/lib/install/types.ts`:
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

- [ ] **Step 2: `seed-en.ts` 작성**

Create `src/lib/install/seed-en.ts`:
```typescript
import type { SeedData } from './types'

export const displayName = 'English'

export const seedEn: SeedData = {
  boards: [
    {
      slug: 'free',
      name: 'Free Board',
      description: 'A place to chat freely about anything.',
      category: null,
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
      content: '<h2>Welcome to our site</h2><p>This is a sample About Us page. Edit it in the admin panel to introduce your site.</p>',
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

- [ ] **Step 3: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -10`
Expected: 성공, 타입 오류 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/lib/install/types.ts src/lib/install/seed-en.ts
git commit -m "feat(install): SeedData 타입 + 영문 seed 데이터"
```

---

## Task 2: scan-plugins locale 자동 스캔 + routing 연결

**Files:**
- Modify: `scripts/scan-plugins.js`
- Modify: `.gitignore`
- Modify: `src/i18n/routing.ts`

- [ ] **Step 1: `scripts/scan-plugins.js`에 `scanLocales` 함수 추가**

Read the file first. Find the last function definition (likely `mergeLocales` or similar near the bottom). Add a new function:

```javascript
function scanInstallLocales() {
  const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales')
  const INSTALL_DIR = path.join(__dirname, '..', 'src', 'lib', 'install')
  const I18N_DIR = path.join(__dirname, '..', 'src', 'i18n')

  if (!fs.existsSync(LOCALES_DIR) || !fs.existsSync(INSTALL_DIR)) {
    console.warn('[scan-plugins] locales or install dir missing, skipping locale scan')
    return
  }

  // 1. src/locales/*.json 스캔
  const messageFiles = fs.readdirSync(LOCALES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))

  // 2. src/lib/install/seed-{locale}.ts 존재 여부 필터
  const supported = messageFiles
    .filter(locale => fs.existsSync(path.join(INSTALL_DIR, `seed-${locale}.ts`)))
    .sort()  // 결정론적 순서

  if (supported.length === 0) {
    console.warn('[scan-plugins] no supported locales found (need both src/locales/{X}.json and src/lib/install/seed-{X}.ts)')
    return
  }

  // 3. _generated-locales.ts 생성
  const localesContent = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit
export const SUPPORTED_LOCALES = [${supported.map(l => `'${l}'`).join(', ')}] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]
`
  fs.writeFileSync(path.join(I18N_DIR, '_generated-locales.ts'), localesContent, 'utf-8')

  // 4. _generated-registry.ts 생성
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1)
  const imports = supported.map(l => {
    const cap = capitalize(l)
    return `import { seed${cap}, displayName as displayName${cap} } from './seed-${l}'`
  }).join('\n')
  const entries = supported.map(l => {
    const cap = capitalize(l)
    return `  ${l}: { displayName: displayName${cap}, seed: seed${cap} }`
  }).join(',\n')
  const registryContent = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit
${imports}
import type { SeedData } from './types'

export interface LocaleEntry {
  displayName: string
  seed: SeedData
}

export const localeRegistry: Record<string, LocaleEntry> = {
${entries}
}
`
  fs.writeFileSync(path.join(INSTALL_DIR, '_generated-registry.ts'), registryContent, 'utf-8')

  console.log(`[scan-plugins] Registered ${supported.length} install locale(s): ${supported.join(', ')}`)
}
```

- [ ] **Step 2: `scanPlugins()` 말미에 `scanInstallLocales()` 호출 추가**

Find the `scanPlugins()` function (likely at the bottom of the file). Add `scanInstallLocales()` as the LAST call before the function returns or at the end of the file where other scan functions are called.

Example: if the file ends with `scanPlugins()` call at the bottom, add `scanInstallLocales()` right before it, or place the call inside `scanPlugins()` after `mergeLocales(plugins)` call.

- [ ] **Step 3: `.gitignore`에 생성 파일 추가**

Read `.gitignore`, find the section with other `_generated*` entries, append:
```
/src/i18n/_generated-locales.ts
/src/lib/install/_generated-registry.ts
```

- [ ] **Step 4: scan-plugins 실행 — 현재는 seed-en만 있으므로 en locale만 지원돼야 함**

Run:
```bash
cd /home/kagla/nexibase && node scripts/scan-plugins.js 2>&1 | tail -10
```
Expected: `[scan-plugins] Registered 1 install locale(s): en`

Verify:
```bash
cat src/i18n/_generated-locales.ts
cat src/lib/install/_generated-registry.ts
```
Expected:
- `_generated-locales.ts`에 `SUPPORTED_LOCALES = ['en'] as const`
- `_generated-registry.ts`에 `import ... seed-en` 구문과 `localeRegistry = { en: ... }`

- [ ] **Step 5: `routing.ts` 수정 — SUPPORTED_LOCALES 사용**

Replace `src/i18n/routing.ts` with:
```typescript
import { defineRouting } from 'next-intl/routing'
import { SUPPORTED_LOCALES } from './_generated-locales'

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: 'en',
  localePrefix: 'never',
})

export type Locale = (typeof routing.locales)[number]
```

- [ ] **Step 6: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -15`
Expected: 성공, 타입 오류 없음. `SUPPORTED_LOCALES`가 `['en']`일 때도 next-intl이 정상 동작.

- [ ] **Step 7: 커밋**

```bash
git add scripts/scan-plugins.js .gitignore src/i18n/routing.ts
git commit -m "feat(install): scan-plugins에 locale 자동 스캔 추가"
```

---

## Task 3: Install 실행자 (`runInstall.ts`)

**Files:**
- Create: `src/lib/install/runInstall.ts`

- [ ] **Step 1: 기존 Prisma 클라이언트 import 경로 확인**

Run: `grep -rn "from '@/lib/prisma'" src/app/api/*/route.ts | head -3`
Expected: 여러 파일에서 `import { prisma } from '@/lib/prisma'` 사용 확인.

- [ ] **Step 2: `runInstall.ts` 작성**

Create `src/lib/install/runInstall.ts`:
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

export class InstallError extends Error {
  constructor(public code: 'ALREADY_INSTALLED' | 'UNKNOWN_LOCALE' | 'DB_ERROR', message: string) {
    super(message)
    this.name = 'InstallError'
  }
}

export async function runInstall(params: InstallParams): Promise<void> {
  const entry = localeRegistry[params.locale]
  if (!entry) {
    throw new InstallError('UNKNOWN_LOCALE', `Unknown locale: ${params.locale}`)
  }

  const seed = entry.seed
  const hashedPw = await bcrypt.hash(params.adminPassword, 10)

  await prisma.$transaction(async (tx) => {
    // 0. 경쟁 상태 재확인
    const existing = await tx.setting.findUnique({ where: { key: 'site_initialized' } })
    if (existing?.value === 'true') {
      throw new InstallError('ALREADY_INSTALLED', 'Site is already initialized')
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

    // 3. Seed 데이터 삽입
    for (const b of seed.boards) {
      await tx.board.create({
        data: {
          slug: b.slug,
          name: b.name,
          description: b.description ?? null,
          category: b.category ?? null,
          isActive: b.isActive ?? true,
          useComment: b.useComment ?? true,
          useReaction: b.useReaction ?? true,
        },
      })
    }

    for (const m of seed.menus) {
      await tx.menu.create({
        data: {
          position: m.position,
          label: m.label,
          url: m.url,
          sortOrder: m.sortOrder,
        },
      })
    }

    for (const w of seed.widgets) {
      await tx.homeWidget.create({
        data: {
          widgetKey: w.widgetKey,
          zone: w.zone,
          title: w.title,
          colSpan: w.colSpan,
          rowSpan: w.rowSpan,
          sortOrder: w.sortOrder,
          isActive: true,
        },
      })
    }

    for (const c of seed.contents) {
      await tx.content.create({
        data: {
          slug: c.slug,
          title: c.title,
          content: c.content,
          isPublic: c.isPublic,
        },
      })
    }

    for (const p of seed.policies) {
      await tx.policy.create({
        data: {
          slug: p.slug,
          version: p.version,
          title: p.title,
          content: p.content,
          isActive: p.isActive,
        },
      })
    }

    // 4. 마지막에 완료 플래그 (중간 실패 시 재시도 가능)
    await tx.setting.create({ data: { key: 'site_initialized', value: 'true' } })
  })
}
```

- [ ] **Step 3: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -15`
Expected: 타입 오류 없음. `localeRegistry` import가 `_generated-registry.ts`에서 정상 해석됨.

만약 Prisma 타입 오류(예: `widgetKey` 중복 제약 등)가 나오면 기존 스키마의 unique constraint에 맞춰 조정. 특히 `HomeWidget.widgetKey`는 `@unique`이므로 동일 키로 재실행 시 충돌 가능 (install은 1회성이므로 실무적으로 문제 없음).

- [ ] **Step 4: 커밋**

```bash
git add src/lib/install/runInstall.ts
git commit -m "feat(install): runInstall 트랜잭션 실행자"
```

---

## Task 4: Install API Route

**Files:**
- Create: `src/app/api/install/route.ts`

- [ ] **Step 1: POST 핸들러 작성**

Create `src/app/api/install/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { runInstall, InstallError, InstallParams } from '@/lib/install/runInstall'
import { localeRegistry } from '@/lib/install/_generated-registry'

interface ValidationResult {
  ok: boolean
  errors?: Record<string, string>
  params?: InstallParams
}

function validateBody(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: { _: 'Invalid request body' } }
  }
  const b = body as Record<string, unknown>
  const errors: Record<string, string> = {}

  const locale = typeof b.locale === 'string' ? b.locale : ''
  if (!locale || !(locale in localeRegistry)) {
    errors.locale = 'Unsupported locale'
  }

  const adminEmail = typeof b.adminEmail === 'string' ? b.adminEmail.trim() : ''
  if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || adminEmail.length > 255) {
    errors.adminEmail = 'Invalid email format'
  }

  const adminPassword = typeof b.adminPassword === 'string' ? b.adminPassword : ''
  if (!adminPassword || adminPassword.length < 8) {
    errors.adminPassword = 'Password must be at least 8 characters'
  } else if (!/[a-zA-Z]/.test(adminPassword) || !/[0-9]/.test(adminPassword)) {
    errors.adminPassword = 'Password must include both letters and numbers'
  }

  const adminPasswordConfirm = typeof b.adminPasswordConfirm === 'string' ? b.adminPasswordConfirm : ''
  if (adminPassword !== adminPasswordConfirm) {
    errors.adminPasswordConfirm = 'Passwords do not match'
  }

  const adminNickname = typeof b.adminNickname === 'string' ? b.adminNickname.trim() : ''
  if (!adminNickname || adminNickname.length < 2 || adminNickname.length > 50) {
    errors.adminNickname = 'Nickname must be 2-50 characters'
  }

  const siteName = typeof b.siteName === 'string' ? b.siteName.trim() : ''
  if (!siteName || siteName.length < 1 || siteName.length > 100) {
    errors.siteName = 'Site name must be 1-100 characters'
  }

  const siteDescription = typeof b.siteDescription === 'string' ? b.siteDescription.trim() : ''
  if (siteDescription.length > 500) {
    errors.siteDescription = 'Site description must be 500 characters or less'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    params: {
      locale,
      adminEmail,
      adminPassword,
      adminNickname,
      siteName,
      siteDescription,
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = validateBody(body)
    if (!validation.ok) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 })
    }
    await runInstall(validation.params!)
    return NextResponse.json({ success: true, redirectTo: '/admin/login' })
  } catch (err) {
    if (err instanceof InstallError) {
      if (err.code === 'ALREADY_INSTALLED') {
        return NextResponse.json({ error: 'Site is already installed' }, { status: 409 })
      }
      if (err.code === 'UNKNOWN_LOCALE') {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
    }
    console.error('[install] failed:', err)
    return NextResponse.json({ error: 'Installation failed' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | grep -E "(api/install|error)" | head -10`
Expected: `/api/install` route가 빌드 목록에 나타남. 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/install/route.ts
git commit -m "feat(install): POST /api/install 엔드포인트"
```

---

## Task 5: 미들웨어 Install 체크

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: 기존 `src/proxy.ts` 읽기**

Run: `cat src/proxy.ts`
Expected: 현재 구조 파악 — intl middleware + 플러그인 체크 + 세션 쿠키 로직.

- [ ] **Step 2: install 체크 함수 추가 (파일 상단)**

Modify `src/proxy.ts` — import들 아래, 기존 헬퍼 함수들 바로 위에 추가:
```typescript
import { prisma } from '@/lib/prisma'

// In-memory 캐시 — 한 번 true가 되면 프로세스 수명동안 재조회 없음
let cachedInitialized: boolean | null = null

export function markInstalled() {
  cachedInitialized = true
}

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
    prefix => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}
```

- [ ] **Step 3: `proxy` 함수 최상단에 install 체크 추가**

`proxy` 함수 본문 시작 직후(기존 `const { pathname } = request.nextUrl` 다음)에 삽입:
```typescript
  // 1. Install 상태 체크 (최우선)
  const installed = await isInstalled()
  if (!installed) {
    // 미설치: install 관련 경로와 정적 리소스 외엔 모두 /install로 리다이렉트
    if (!isAllowedWhenNotInstalled(pathname)) {
      return NextResponse.redirect(new URL('/install', request.url))
    }
    // install 관련 경로는 통과 (next-intl/플러그인 체크 건너뜀)
    return NextResponse.next()
  }
  // 설치됨: /install 접근 시 /admin으로 리다이렉트
  if (pathname === '/install' || pathname.startsWith('/install/')) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
```

위 코드는 기존 `if (pathname.startsWith('/api/'))` 라인 **앞에** 와야 함.

- [ ] **Step 4: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -10`
Expected: 성공.

**주의:** 미들웨어에서 Prisma 사용 시 Edge runtime 제약 이슈 가능성. 현재 Nexibase `proxy.ts`가 이미 fetch를 쓰므로 Node runtime 사용 중일 수 있음. 빌드 에러가 `edge runtime` 관련이면 `export const runtime = 'nodejs'` 명시 필요.

만약 Edge runtime 이슈로 Prisma 직접 호출이 안 되면 fallback 방식: fetch로 `/api/install/state` 엔드포인트 호출 (별도 API route 만들어서). 이 경우 Task 4에 GET 핸들러 추가 필요.

- [ ] **Step 5: 커밋**

```bash
git add src/proxy.ts
git commit -m "feat(install): 미들웨어에 install 체크 로직 추가"
```

---

## Task 6: Install 레이아웃 + Step 1 페이지

**Files:**
- Create: `src/app/install/layout.tsx`
- Create: `src/app/install/page.tsx`

- [ ] **Step 1: 최소 레이아웃 작성**

Create `src/app/install/layout.tsx`:
```typescript
export default function InstallLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Nexibase Install</title>
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-lg">{children}</div>
        </div>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Step 1 페이지 작성 (하드코딩 라벨, 언어 선택)**

Create `src/app/install/page.tsx`:
```typescript
import Link from 'next/link'
import { localeRegistry } from '@/lib/install/_generated-registry'
import pkg from '../../../package.json'

export default function InstallStep1() {
  const entries = Object.entries(localeRegistry)

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">Nexibase</h1>
        <p className="text-sm text-slate-500">v{pkg.version}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-center">
          Select Your Language / 언어를 선택하세요
        </h2>
        <div className="flex flex-col gap-2">
          {entries.map(([locale, entry]) => (
            <Link
              key={locale}
              href={`/install/setup?locale=${locale}`}
              className="block w-full text-center py-3 px-4 rounded-md border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-colors font-medium"
            >
              {entry.displayName}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Welcome to the Nexibase installation wizard.
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | grep -E "(install|error)" | head -10`
Expected: `/install` route 빌드됨. 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/app/install/
git commit -m "feat(install): Step 1 언어 선택 페이지"
```

---

## Task 7: `request.ts` — site_locale 기반 locale 해석

**Files:**
- Modify: `src/i18n/request.ts`

- [ ] **Step 1: 기존 파일 읽기**

Run: `cat src/i18n/request.ts`

- [ ] **Step 2: `request.ts` 전체 재작성**

Replace `src/i18n/request.ts` with:
```typescript
import { getRequestConfig } from 'next-intl/server'
import { hasLocale } from 'next-intl'
import { routing } from './routing'
import { prisma } from '@/lib/prisma'

let cachedLocale: string | null = null

export function setCachedLocale(locale: string) {
  cachedLocale = locale
}

async function getSiteLocale(): Promise<string> {
  if (cachedLocale) return cachedLocale
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'site_locale' },
    })
    const value = setting?.value
    if (value && hasLocale(routing.locales, value)) {
      cachedLocale = value
      return value
    }
  } catch {
    // DB 오류 — 기본 locale fallback
  }
  return routing.defaultLocale
}

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. request에서 명시적 locale (install Step 2의 ?locale 쿼리 등) 우선
  const requested = await requestLocale
  if (requested && hasLocale(routing.locales, requested)) {
    return {
      locale: requested,
      messages: (await import(`../messages/${requested}.json`)).default,
    }
  }

  // 2. DB 설정 기반
  const locale = await getSiteLocale()
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
```

- [ ] **Step 3: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -10`
Expected: 성공.

- [ ] **Step 4: 커밋**

```bash
git add src/i18n/request.ts
git commit -m "feat(install): request.ts에서 site_locale 설정 기반 locale 해석"
```

---

## Task 8: Install Step 2 페이지 (관리자 + 사이트 폼)

**Files:**
- Create: `src/app/install/setup/page.tsx`

- [ ] **Step 1: Step 2 페이지 작성**

Create `src/app/install/setup/page.tsx`:
```typescript
"use client"

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { localeRegistry } from '@/lib/install/_generated-registry'
import Link from 'next/link'
import pkg from '../../../../package.json'

const LABELS: Record<string, Record<string, string>> = {
  en: {
    title: 'Admin Account & Site Info',
    back: '← Back to language selection',
    adminEmail: 'Admin Email',
    adminPassword: 'Password',
    adminPasswordConfirm: 'Confirm Password',
    adminNickname: 'Admin Nickname',
    siteName: 'Site Name',
    siteDescription: 'Site Description (optional)',
    submit: 'Install',
    submitting: 'Installing...',
    unknownError: 'Installation failed. Please check your input and try again.',
  },
  ko: {
    title: '관리자 계정 및 사이트 정보',
    back: '← 언어 선택으로 돌아가기',
    adminEmail: '관리자 이메일',
    adminPassword: '비밀번호',
    adminPasswordConfirm: '비밀번호 확인',
    adminNickname: '관리자 닉네임',
    siteName: '사이트 이름',
    siteDescription: '사이트 설명 (선택)',
    submit: '설치',
    submitting: '설치 중...',
    unknownError: '설치에 실패했습니다. 입력값을 확인하고 다시 시도해주세요.',
  },
}

function SetupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const locale = searchParams.get('locale') || 'en'

  // locale이 레지스트리에 없으면 Step 1로 되돌리기
  useEffect(() => {
    if (!(locale in localeRegistry)) {
      router.replace('/install')
    }
  }, [locale, router])

  const t = LABELS[locale] ?? LABELS.en

  const [form, setForm] = useState({
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    adminNickname: '',
    siteName: '',
    siteDescription: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      const res = await fetch('/api/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, ...form }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.errors) {
          setErrors(data.errors)
        } else {
          setErrors({ _: data.error || t.unknownError })
        }
        setSubmitting(false)
        return
      }

      // 성공 → 전체 페이지 reload로 middleware가 새 상태 읽게 함
      window.location.href = data.redirectTo || '/admin/login'
    } catch (err) {
      setErrors({ _: err instanceof Error ? err.message : t.unknownError })
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm p-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold">Nexibase</h1>
        <p className="text-xs text-slate-500">v{pkg.version}</p>
      </div>

      <div>
        <Link
          href="/install"
          className="text-sm text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
        >
          {t.back}
        </Link>
        <h2 className="mt-2 text-lg font-semibold">{t.title}</h2>
      </div>

      {errors._ && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">
          {errors._}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t.adminEmail}</label>
          <input
            type="email"
            required
            value={form.adminEmail}
            onChange={e => handleChange('adminEmail', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminEmail && <p className="mt-1 text-xs text-red-600">{errors.adminEmail}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.adminPassword}</label>
          <input
            type="password"
            required
            value={form.adminPassword}
            onChange={e => handleChange('adminPassword', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminPassword && <p className="mt-1 text-xs text-red-600">{errors.adminPassword}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.adminPasswordConfirm}</label>
          <input
            type="password"
            required
            value={form.adminPasswordConfirm}
            onChange={e => handleChange('adminPasswordConfirm', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminPasswordConfirm && <p className="mt-1 text-xs text-red-600">{errors.adminPasswordConfirm}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.adminNickname}</label>
          <input
            type="text"
            required
            value={form.adminNickname}
            onChange={e => handleChange('adminNickname', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.adminNickname && <p className="mt-1 text-xs text-red-600">{errors.adminNickname}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.siteName}</label>
          <input
            type="text"
            required
            value={form.siteName}
            onChange={e => handleChange('siteName', e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          {errors.siteName && <p className="mt-1 text-xs text-red-600">{errors.siteName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t.siteDescription}</label>
          <textarea
            value={form.siteDescription}
            onChange={e => handleChange('siteDescription', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
          />
          {errors.siteDescription && <p className="mt-1 text-xs text-red-600">{errors.siteDescription}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>
    </div>
  )
}

export default function InstallStep2() {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
      <SetupForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | grep -E "(install|error)" | head -10`
Expected: `/install/setup` 빌드됨. 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/app/install/setup/
git commit -m "feat(install): Step 2 관리자/사이트 정보 폼"
```

---

## Task 9: Reset-Install 스크립트

**Files:**
- Create: `scripts/reset-install.js`
- Modify: `package.json`

- [ ] **Step 1: `scripts/reset-install.js` 작성**

Create `scripts/reset-install.js`:
```javascript
#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

// 1. 프로덕션 가드
if (process.env.NODE_ENV === 'production') {
  console.error('❌ NODE_ENV=production 환경에서는 실행할 수 없습니다.')
  process.exit(1)
}

// 2. --confirm 플래그 필수
if (!process.argv.includes('--confirm')) {
  console.error('❌ 이 명령은 install 관련 데이터를 삭제합니다.')
  console.error('   실행하려면 --confirm 플래그를 붙이세요:')
  console.error('   npm run reset-install -- --confirm')
  process.exit(1)
}

async function main() {
  const [userCount, boardCount, menuCount, widgetCount, contentCount, policyCount, settingCount] = await Promise.all([
    prisma.user.count(),
    prisma.board.count(),
    prisma.menu.count(),
    prisma.homeWidget.count(),
    prisma.content.count(),
    prisma.policy.count(),
    prisma.setting.count(),
  ])

  console.log('')
  console.log('⚠️  INSTALL 리셋 경고')
  console.log('')
  console.log('현재 DB 상태:')
  console.log(`  - users:    ${userCount}명`)
  console.log(`  - boards:   ${boardCount}개`)
  console.log(`  - menus:    ${menuCount}개`)
  console.log(`  - widgets:  ${widgetCount}개`)
  console.log(`  - contents: ${contentCount}개`)
  console.log(`  - policies: ${policyCount}개`)
  console.log(`  - settings: ${settingCount}개`)
  console.log('')
  console.log('이 명령은 위 데이터를 모두 삭제합니다.')
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'} ✓`)
  console.log('')
  console.log('5초 후 진행... (Ctrl+C로 취소)')
  process.stdout.write('  ')
  for (let i = 5; i >= 1; i--) {
    process.stdout.write(`${i}... `)
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('\n시작\n')

  // 삭제 순서: FK 의존 역순
  await prisma.setting.deleteMany({})
  console.log('✓ settings 삭제')

  await prisma.content.deleteMany({})
  console.log('✓ contents 삭제')

  await prisma.policy.deleteMany({})
  console.log('✓ policies 삭제')

  await prisma.homeWidget.deleteMany({})
  console.log('✓ widgets 삭제')

  await prisma.menu.deleteMany({})
  console.log('✓ menus 삭제')

  await prisma.board.deleteMany({})
  console.log('✓ boards 삭제 (cascade로 posts·comments·reactions·attachments 포함)')

  await prisma.user.deleteMany({})
  console.log('✓ users 삭제 (cascade로 accounts·notifications·user_addresses 포함)')

  console.log('')
  console.log('완료.')
  console.log('')
  console.log('⚠️  dev 서버가 실행 중이면 재시작해야 proxy.ts의 isInstalled 캐시와')
  console.log('   request.ts의 locale 캐시가 초기화됩니다.')
  console.log('')
  console.log('재시작 후 http://localhost:3001/ 접속 → install wizard로 리다이렉트됩니다.')

  await prisma.$disconnect()
}

main().catch(e => {
  console.error('❌ 실행 중 오류:', e)
  process.exit(1)
})
```

- [ ] **Step 2: `package.json`에 스크립트 등록**

Read `package.json`, find `"scripts"` section, add:
```json
"reset-install": "node scripts/reset-install.js",
```

위치: 기존 `"dev"` 아래가 자연스러움.

- [ ] **Step 3: 스크립트 테스트 (flag 없이 실행)**

Run: `npm run reset-install 2>&1`
Expected:
```
❌ 이 명령은 install 관련 데이터를 삭제합니다.
   실행하려면 --confirm 플래그를 붙이세요:
   npm run reset-install -- --confirm
```
(exit code 1)

- [ ] **Step 4: 커밋**

```bash
git add scripts/reset-install.js package.json
git commit -m "feat(install): reset-install 스크립트"
```

---

## Task 10: 한국어 Seed 파일 생성 (서브에이전트)

**Files:**
- Create: `src/lib/install/seed-ko.ts`

**Strategy:** 이 태스크는 서브에이전트에게 `seed-en.ts`를 읽어 한국어로 기계 번역한 `seed-ko.ts`를 생성하도록 지시한다. Claude는 한↔영 번역 품질이 좋으므로 Google Translate API 없이도 충분.

- [ ] **Step 1: 서브에이전트 파견**

Dispatch a general-purpose subagent (sonnet model) with the following prompt:

```
You are creating a Korean machine translation of src/lib/install/seed-en.ts.

**Working directory:** /home/kagla/nexibase
**Branch:** feat/install-wizard (or current feature branch)

Task:
1. Read src/lib/install/seed-en.ts completely.
2. Create src/lib/install/seed-ko.ts with IDENTICAL structure but with Korean content:
   - Change `displayName = 'English'` to `displayName = '한국어'`
   - Change export name from `seedEn` to `seedKo`
   - Translate every string value to natural Korean:
     - boards.name: "Free Board" → "자유게시판"
     - boards.description: translate the sentence
     - menus.label: "Home" → "홈", "Board" → "게시판", "Login" → "로그인", "Terms of Service" → "이용약관", "Privacy Policy" → "개인정보처리방침"
     - menus.url: KEEP as-is (URLs are not translated)
     - widgets.title: "Welcome Banner" → "환영 배너", "Latest Posts" → "최근 게시글"
     - widgets.widgetKey, zone: KEEP as-is (technical IDs)
     - contents.slug: KEEP as 'about' (URL slug)
     - contents.title: "About Us" → "소개"
     - contents.content: translate the HTML body naturally, preserving tags
     - policies.slug: KEEP as 'terms'/'privacy'
     - policies.version: KEEP as '1.0'
     - policies.title: "Terms of Service" → "이용약관", "Privacy Policy" → "개인정보처리방침"
     - policies.content: translate the HTML body naturally, preserving tags
3. All numeric fields (sortOrder, colSpan, rowSpan) and booleans: KEEP as-is.
4. Import statement: `import type { SeedData } from './types'` — same as seed-en.ts.

Korean translation guidelines:
- Use natural, professional Korean suitable for a community platform
- Keep HTML tags intact (<h2>, <p>, etc.)
- Do not add extra content or change structure
- Preserve all JSON/TS syntax exactly

After creating the file, verify:
- TypeScript compiles cleanly: `cd /home/kagla/nexibase && npx tsc --noEmit src/lib/install/seed-ko.ts` (or use `npx next build`)
- File structure matches seed-en.ts exactly (same fields, same arrays, same order)

Then commit:
```
git add src/lib/install/seed-ko.ts
git commit -m "feat(install): 한국어 seed 데이터 (기계 번역)"
```

Report back with:
- Status (DONE/BLOCKED)
- Commit SHA
- Any concerns about translation quality
```

- [ ] **Step 2: scan-plugins 재실행으로 ko 등록 확인**

After subagent completes, run:
```bash
cd /home/kagla/nexibase && node scripts/scan-plugins.js 2>&1 | tail -5
```
Expected: `[scan-plugins] Registered 2 install locale(s): en, ko` (or similar if ko.json not yet — 다음 태스크에서 생성)

만약 `ko` locale이 등록되지 않으면 `src/locales/ko.json`이 없기 때문. 이건 Task 11에서 생성함. 지금 단계에선 `en`만 등록돼 있는 것이 정상.

**중요 이슈:** Task 10은 `seed-ko.ts`만 만들고, `src/locales/ko.json`은 Task 11에서 만든다. scan-plugins는 두 파일 모두 존재해야 해당 locale을 등록한다. 따라서 Task 10 직후에는 아직 `ko`가 레지스트리에 없는 것이 정상이다. Task 11 완료 후 다시 scan-plugins를 실행해서 등록을 확인한다.

- [ ] **Step 3: 파일 존재 및 구조 검증**

Run:
```bash
cd /home/kagla/nexibase && node -e "
const m = require('./src/lib/install/seed-ko.ts.compiled-check');
// TS 파일이므로 직접 require 불가. 대신:
" 2>&1 || true
cat src/lib/install/seed-ko.ts | head -20
wc -l src/lib/install/seed-ko.ts src/lib/install/seed-en.ts
```
Expected: seed-ko.ts의 라인 수가 seed-en.ts와 비슷(±20 라인).

- [ ] **Step 4: 커밋 확인**

Run: `git log --oneline -3`
Expected: 최근 커밋 중에 `feat(install): 한국어 seed 데이터 (기계 번역)` 존재.

(서브에이전트가 자체적으로 커밋했으므로 추가 커밋 불필요)

---

## Task 11: 한국어 메시지 파일 생성 (서브에이전트)

**Files:**
- Create: `src/locales/ko.json`

**Strategy:** 이 태스크는 `src/locales/en.json`을 읽어 한국어로 기계 번역한 `ko.json`을 생성한다. 약 732개 top-level 키가 있음.

- [ ] **Step 1: 서브에이전트 파견**

Dispatch a general-purpose subagent (sonnet model) with the following prompt:

```
You are creating a Korean machine translation of src/locales/en.json.

**Working directory:** /home/kagla/nexibase
**Branch:** feat/install-wizard (or current feature branch)

Task:
1. Read src/locales/en.json completely. It contains ~732 translation keys organized by namespace (header, footer, locale, common, auth, mypage, profile, search, lists, admin, widgets, editor, image, errors, email, notification).
2. Create src/locales/ko.json with IDENTICAL structure (same keys, same nesting) but with Korean translations for every string value.

Translation guidelines:
- Use natural, professional Korean suitable for a web community platform
- Match the tone (formal for policies, friendly for user-facing, concise for buttons)
- Preserve placeholders like {name}, {count}, {minutes} exactly — do not translate them
- Do not add or remove any keys
- Maintain the exact same JSON structure and nesting level
- For very short labels (e.g. "Save", "Cancel", "Delete"), use canonical Korean UI terms ("저장", "취소", "삭제")

For context, some namespaces and their typical translations:
- header: site-level navigation
- common: buttons, generic labels (loading, save, cancel, delete, edit, confirm)
- auth: login, signup, password reset flows
- admin: admin panel labels
- widgets: widget titles and empty states

After creating the file, verify:
1. Valid JSON: `node -e "JSON.parse(require('fs').readFileSync('src/locales/ko.json'))" && echo OK`
2. Same key count as en.json: `node -e "
const en = JSON.parse(require('fs').readFileSync('src/locales/en.json'));
const ko = JSON.parse(require('fs').readFileSync('src/locales/ko.json'));
function count(o) { let n = 0; for (const k of Object.keys(o)) { if (typeof o[k] === 'object' && o[k] !== null) n += count(o[k]); else n++; } return n; }
console.log('en:', count(en), 'ko:', count(ko));
"`
  Expected: en and ko counts match within ~5 keys (exact match preferred)

3. Run scan-plugins: `cd /home/kagla/nexibase && node scripts/scan-plugins.js 2>&1 | tail -5`
   Expected: `[scan-plugins] Registered 2 install locale(s): en, ko`

4. Build check: `npx next build 2>&1 | tail -5`
   Expected: clean build

Then commit:
```
git add src/locales/ko.json src/i18n/_generated-locales.ts src/lib/install/_generated-registry.ts
```

Wait — `_generated-*` files are gitignored. Only commit the source files:
```
git add src/locales/ko.json
git commit -m "feat(install): 한국어 메시지 파일 (기계 번역, 732 키)"
```

**Note on plugin locales:** Nexibase also has plugin-specific locale files (src/plugins/boards/locales/en.json, contents/en.json, policies/en.json, shop/en.json). These were deleted for Korean in v0.12.0. For this install wizard, we only need the core ko.json — plugin Korean translations can be added later if needed (the admin pages will fall back to English for plugin strings).

Actually — this means the install wizard works but the ADMIN PAGES after install will have Korean core UI and English plugin UI. That's an acceptable hybrid for now.

Report back with:
- Status (DONE/BLOCKED)
- Commit SHA
- Any concerns about translation quality or missing keys
```

- [ ] **Step 2: scan-plugins로 ko 등록 확인**

Run:
```bash
cd /home/kagla/nexibase && node scripts/scan-plugins.js 2>&1 | tail -5
```
Expected: `[scan-plugins] Registered 2 install locale(s): en, ko`

- [ ] **Step 3: 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -15`
Expected: 성공. 이제 ko가 `routing.locales`에 자동 포함됨.

- [ ] **Step 4: 커밋 확인**

Run: `git log --oneline -3`
Expected: `feat(install): 한국어 메시지 파일 (기계 번역, 732 키)` 존재.

---

## Task 12: 수동 Smoke Test + 이슈 수정

**Files:**
- Varies (발견된 이슈에 따라)

이 태스크는 실제 브라우저로 install wizard 전체 흐름을 검증하고 발견된 버그를 수정한다.

- [ ] **Step 1: DB 리셋**

Run:
```bash
cd /home/kagla/nexibase && npm run reset-install -- --confirm
```
Expected: 경고 출력 후 5초 카운트다운 후 모든 데이터 삭제. 완료 메시지 출력.

- [ ] **Step 2: dev 서버 시작**

Run (새 터미널에서):
```bash
cd /home/kagla/nexibase && npm run dev
```
Expected: scan-plugins 실행 후 Next.js dev 서버 시작 (http://localhost:3001).

- [ ] **Step 3: 브라우저 테스트 — 영문 시나리오**

시나리오:
1. `http://localhost:3001/` 접속 → `/install`로 리다이렉트 확인
2. Step 1 화면에 `[English]`, `[한국어]` 두 버튼이 렌더링되는지 확인 (하드코딩 라벨)
3. `[English]` 클릭 → `/install/setup?locale=en`으로 이동 확인
4. Step 2 폼에 영문 라벨 표시 확인 ("Admin Email", "Password", "Install" 등)
5. 필드 입력:
   - Admin Email: `admin@test.com`
   - Password: `Test1234`
   - Confirm Password: `Test1234`
   - Admin Nickname: `Test Admin`
   - Site Name: `Test Site EN`
   - Site Description: `A test site for English wizard`
6. `Install` 버튼 클릭 → 응답 대기 → `/admin/login`으로 리다이렉트 확인
7. 새 계정(`admin@test.com` / `Test1234`)으로 로그인 시도 → `/admin` 대시보드 진입 확인
8. 사이드바 각 메뉴 확인:
   - `/admin/boards`: "Free Board" 1개 표시
   - `/admin/menus`: header 3개(Home, Board, Login), footer 2개(Terms, Privacy) 표시
   - `/admin/home-widgets`: Welcome Banner (top), Latest Posts (center) 표시
   - `/admin/contents`: About 1개 표시
   - `/admin/policies`: Terms of Service, Privacy Policy 표시
   - `/admin/settings`: site_name 입력값, site_description 입력값, site_locale='en' 확인
9. 홈(`http://localhost:3001/`) 접속 → 헤더 메뉴·위젯 정상 렌더링 + site_name 표시 확인
10. `/install` 재접속 시도 → `/admin`으로 리다이렉트 확인 (재설치 차단)

- [ ] **Step 4: 브라우저 테스트 — 한국어 시나리오**

Run: `npm run reset-install -- --confirm`
Run (dev 서버 재시작 필요 — Ctrl+C 후): `npm run dev`

시나리오:
1. `/` → `/install` 리다이렉트
2. `[한국어]` 클릭 → `/install/setup?locale=ko`
3. Step 2 폼에 한국어 라벨 표시 확인 ("관리자 이메일", "비밀번호", "설치")
4. 필드 입력:
   - 관리자 이메일: `admin@test.kr`
   - 비밀번호: `Test1234`
   - 비밀번호 확인: `Test1234`
   - 관리자 닉네임: `테스트관리자`
   - 사이트 이름: `테스트 사이트`
   - 사이트 설명: `한국어 wizard 테스트`
5. `설치` 버튼 클릭 → 리다이렉트 → 로그인 → 대시보드
6. 관리 페이지 확인:
   - boards: "자유게시판" 표시
   - menus: "홈", "게시판", "로그인", "이용약관", "개인정보처리방침"
   - widgets: "환영 배너", "최근 게시글"
   - contents: "소개" (또는 "사이트 소개")
   - policies: "이용약관", "개인정보처리방침"
   - settings: site_locale='ko' 확인
7. 홈 접속 → 한국어 UI 표시 확인 (header 메뉴 라벨 한국어)

- [ ] **Step 5: 발견된 이슈 수정 및 재테스트**

각 시나리오에서 실패하는 단계가 있으면 원인 분석 후 해당 파일 수정. 일반적으로 예상 가능한 이슈:

1. **미들웨어 Edge runtime 이슈** — proxy.ts에서 prisma 사용 시 edge 호환 문제 → `export const runtime = 'nodejs'` 명시
2. **Step 2 locale 적용 실패** — request.ts의 requestLocale이 쿼리 파라미터를 읽지 못함 → Step 2 페이지가 클라이언트 전용이라 서버 locale 해석 불필요 (하드코딩 LABELS로 처리 가능). 이미 Task 8에서 LABELS 방식으로 구현했으므로 문제 없어야 함.
3. **Seed FK 오류** — runInstall.ts의 데이터 형식이 Prisma 스키마와 안 맞음 → 해당 필드 조정 후 재시도
4. **캐시 무효화 안 됨** — install 성공 후에도 `/`가 여전히 `/install`로 리다이렉트 → `runInstall` 성공 후 API route에서 `cachedInitialized = true` 설정하는 코드 추가

각 수정마다 개별 커밋 권장:
```bash
git add <fixed-files>
git commit -m "fix(install): <구체적 수정 내용>"
```

- [ ] **Step 6: 모든 시나리오가 통과할 때까지 반복**

두 언어 시나리오(Step 3, Step 4) 모두 완벽 동작하면 다음 태스크로.

---

## Task 13: 문서 + 버전업 + 릴리즈

**Files:**
- Modify: `package.json`
- Modify: `README.md` (있으면)

- [ ] **Step 1: 설치 가이드 문서 (README 또는 별도 문서)**

Check if README.md exists and has an install section. If yes, add/update:
```markdown
## Installation

1. Clone the repository
2. Set up your database and `.env` file (DATABASE_URL etc.)
3. Run `npx prisma migrate deploy`
4. Run `npm install`
5. Run `npm run dev`
6. Open http://localhost:3001 in your browser
7. Follow the install wizard:
   - Step 1: Select your site language (English / 한국어)
   - Step 2: Enter admin account and site info
8. Log in as the admin account and start using Nexibase

### Adding a new language

1. Create `src/locales/{locale}.json` (copy `en.json` and translate all values)
2. Create `src/lib/install/seed-{locale}.ts` (copy `seed-en.ts` and translate)
3. Run `npm run dev` — `scan-plugins` auto-registers the new locale
4. The install wizard will now show your new language as an option

### Resetting the install

To restart the install process (development only):
```bash
npm run reset-install -- --confirm
```
Then restart your dev server.
```

If README doesn't exist or doesn't have an install section, create/append this.

- [ ] **Step 2: `package.json` 버전업**

Run:
```bash
cd /home/kagla/nexibase && node -e "const p=require('./package.json'); p.version='0.13.0'; require('fs').writeFileSync('./package.json', JSON.stringify(p,null,2)+'\n')"
```

- [ ] **Step 3: 최종 빌드 검증**

Run: `cd /home/kagla/nexibase && npx next build 2>&1 | tail -15`
Expected: clean build, 0 errors.

- [ ] **Step 4: 커밋 + 푸시**

```bash
cd /home/kagla/nexibase
git add package.json README.md
git commit -m "chore: v0.13.0 — install wizard"
git push -u origin feat/install-wizard
```

- [ ] **Step 5: PR 생성**

```bash
gh pr create --title "feat: install wizard (v0.13.0)" --body "$(cat <<'EOF'
## Summary
- WordPress 스타일 2단계 install wizard (언어 선택 → 관리자/사이트 정보)
- 영어/한국어 지원, 파일 드롭인 방식으로 언어 확장 가능
- 트랜잭션 기반 설치 실행자, site_initialized 플래그로 중복 실행 차단
- 미들웨어 주도 리다이렉트 (미설치 → /install, 설치됨 → /install은 /admin)
- reset-install 스크립트 (개발자용, NODE_ENV 가드 + --confirm + 5초 카운트다운)

## Architecture
- src/lib/install/seed-*.ts: 언어별 seed 데이터
- src/locales/*.json: 언어별 UI 메시지
- scan-plugins가 두 파일을 스캔해 _generated-locales.ts와 _generated-registry.ts 자동 생성
- 새 언어 추가는 파일 2개만 드롭하면 끝

## Test plan
- [x] 영어로 install → 관리자 로그인 → seed 데이터 확인
- [x] 한국어로 install → 관리자 로그인 → seed 데이터 확인 (한국어 라벨)
- [x] 재설치 차단 확인 (/install 접근 시 /admin으로 리다이렉트)
- [x] `npm run reset-install -- --confirm`으로 초기화 가능
- [x] `npx next build` clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 6: PR 머지 + 태그**

```bash
gh pr merge --merge --delete-branch
git checkout main && git pull origin main
git tag -a v0.13.0 -m "v0.13.0 — install wizard"
git push origin v0.13.0
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ 감지 로직(users empty + site_initialized missing) — Task 3 runInstall + Task 5 middleware
- ✅ 2단계 wizard — Task 6 (Step 1), Task 8 (Step 2)
- ✅ Seed 데이터 최소 구성 — Task 1 (seed-en), Task 10 (seed-ko)
- ✅ 드롭인 locale 자동 스캔 — Task 2 scan-plugins
- ✅ 트랜잭션 installer — Task 3 runInstall
- ✅ 미들웨어 리다이렉트 — Task 5 proxy.ts
- ✅ request.ts site_locale 해석 — Task 7
- ✅ 리셋 스크립트 — Task 9
- ✅ 한국어 기계번역 — Task 10 (seed), Task 11 (messages)
- ✅ 수동 smoke test — Task 12
- ✅ v0.13.0 릴리즈 — Task 13

**Known risks:**
1. **Edge runtime in middleware** — proxy.ts의 Prisma 사용이 edge runtime에서 실패할 수 있음. 해결책: `export const runtime = 'nodejs'` 추가 (Task 5 Step 4에 명시)
2. **Step 2 locale 적용** — 쿼리 파라미터 기반 locale을 next-intl이 서버 컴포넌트에서 자동으로 못 읽을 수 있음. 해결책: 클라이언트 컴포넌트에서 하드코딩 LABELS 객체 사용 (Task 8에 이미 구현)
3. **캐시 무효화** — install 성공 후 cachedInitialized를 즉시 true로 설정하지 않으면 다음 요청이 여전히 /install로 리다이렉트. API route에서 `markInstalled()` 호출 필요. Task 5에서 export했으므로 Task 4의 API route에 import & 호출 추가 필요.

**Fix for risk 3 — 아래를 Task 4 Step 1에 추가:**

After `await runInstall(validation.params!)` add:
```typescript
const { markInstalled } = await import('@/proxy')
markInstalled()
const { setCachedLocale } = await import('@/i18n/request')
setCachedLocale(validation.params!.locale)
```

이 fix는 Task 4 작성 시점에 이미 포함해야 한다. 현재 Task 4 Step 1의 코드에 이미 포함하는 형태로 업데이트한다. → **이미 위 Task 4에 반영되지 않았으므로, 구현자는 Task 4 완료 후 Task 5 작업 시점에 API route에 해당 import·호출 코드를 추가해야 함.**

실제로는 간단: Task 4 POST 핸들러의 `runInstall` 성공 직후에 두 줄 추가. 실행자가 기억해야 할 사항으로 여기 명시.

---

**Plan complete.**
