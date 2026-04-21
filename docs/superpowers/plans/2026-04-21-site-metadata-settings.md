# Site Metadata Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded SEO metadata in `src/app/layout.tsx` with values sourced from the `settings` table. Expose two new admin-editable settings (`site_url`, `site_keywords`), move `site_description` out of the install wizard into admin-only editing, and validate `site_name` as required on save.

**Architecture:** A small helper `src/lib/site-settings.ts` reads the five SEO-relevant settings in one Prisma query and formats them into a typed object. `generateMetadata()` and an async `RootLayout` both consume the helper. Missing/empty values degrade gracefully: `site_url` falls back to request headers, `site_description`/`site_keywords` omit their respective meta tags entirely, `site_name` falls back to a neutral `"My Site"` string as defense in depth. Admin UI adds two new form rows; install wizard loses one.

**Tech Stack:** Next.js 15 App Router (Turbopack), TypeScript, Prisma 6 + MySQL, next-intl i18n, shadcn/ui Input/Textarea/Select.

**Spec:** [docs/superpowers/specs/2026-04-21-site-metadata-settings-design.md](../specs/2026-04-21-site-metadata-settings-design.md)

**Feedback memory to respect:**
- Core-unchanged rule does NOT apply here — the work is explicitly in core files (`src/app/layout.tsx`, `src/app/api/admin/settings/route.ts`, `src/lib/`, `src/app/install/*`, `src/locales/*`). That rule is for plugin development; this is a core feature.
- i18n generated-artifact rule still applies: edit `src/locales/{ko,en}.json`, not `src/messages/*.json`.

---

## File Structure

**New files:**

| File | Responsibility |
|---|---|
| `src/lib/site-settings.ts` | `loadSiteSettings()`, `fallbackUrlFromHeaders()`, `mapToOgLocale()` helpers |

**Modified files:**

| File | Responsibility |
|---|---|
| `src/app/layout.tsx` | Static `metadata` → async `generateMetadata()`; `RootLayout` becomes async to power JSON-LD |
| `src/locales/ko.json`, `src/locales/en.json` | New keys under `admin.*` |
| `src/app/[locale]/admin/settings/page.tsx` | Add `site_url`/`site_keywords` inputs + client-side validation |
| `src/app/api/admin/settings/route.ts` | Server-side validation for `site_name`/`site_url` |
| `src/app/install/setup/page.tsx` | Remove `siteDescription` field |
| `src/app/api/install/route.ts` | Drop `siteDescription` from body |
| `src/lib/install/runInstall.ts` | Drop `siteDescription` from params and DB writes |
| `package.json`, `package-lock.json` | Version bump |

---

## Verification Convention

Every UI- or metadata-touching step ends with a concrete check:
- For admin UI: `curl` to the admin settings page returns 200, `npx tsc --noEmit` reports no new errors in touched files.
- For metadata: `curl` to `http://localhost:3001/` then `grep` the rendered HTML for the expected `<meta>`/`<title>`/`<link rel="canonical">` strings.
- For install flow: inspect `/install/setup?locale=en` page's DOM to verify the removed field is gone.

Dev server is started in Task 0 and kept running throughout.

---

## Task 0: Setup

**Files:** none

- [ ] **Step 0.1: Create feature branch from main**

```bash
cd /home/kagla/nexibase
git checkout main
git pull --ff-only
git checkout -b feat/site-metadata-settings
```

Expected: `Switched to a new branch 'feat/site-metadata-settings'`.

- [ ] **Step 0.2: Start dev server in background**

```bash
npm run dev
```

Run in background (Bash tool `run_in_background: true`). The port is 3001 if 3000 is taken. Save the actual URL from the log.

- [ ] **Step 0.3: Smoke-test baseline**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/"
curl -s "http://localhost:3001/" | grep -oE '<title>[^<]*</title>' | head -1
```

Expected: `200` and `<title>NexiBase - 커뮤니티 플랫폼</title>` (or whatever the current hardcoded default resolves to).

Do not commit.

---

## Task 1: i18n keys for new admin settings

**Files:**
- Modify: `src/locales/ko.json`
- Modify: `src/locales/en.json`

**Goal:** Add six keys under the `"admin"` object — they will be consumed by the admin UI and its validation errors in later tasks.

- [ ] **Step 1.1: Add Korean keys**

Open `src/locales/ko.json`. Inside the top-level `"admin"` object, near the other `site*` keys (around line 785-795), add:

```json
    "siteUrl": "사이트 URL",
    "siteUrlDescription": "검색엔진·소셜카드의 canonical URL로 사용됩니다. 비워두면 요청 호스트에서 자동 감지됩니다.",
    "siteUrlPlaceholder": "https://example.com",
    "siteKeywords": "사이트 키워드",
    "siteKeywordsDescription": "SEO 키워드, 콤마로 구분. 예: 오픈소스, 커뮤니티, 게시판",
    "siteKeywordsPlaceholder": "오픈소스, 커뮤니티, 게시판",
    "siteNameRequired": "사이트 이름을 입력해주세요.",
    "siteUrlInvalid": "사이트 URL은 http:// 또는 https:// 로 시작해야 합니다.",
```

Insert them between `siteBasicDesc` and `siteName` for locality (keeps alphabetical-ish ordering near the related keys).

- [ ] **Step 1.2: Add English keys**

In `src/locales/en.json`, mirror the additions in the same `"admin"` object:

```json
    "siteUrl": "Site URL",
    "siteUrlDescription": "Canonical URL used in search engines and social cards. Leave empty to auto-detect from request host.",
    "siteUrlPlaceholder": "https://example.com",
    "siteKeywords": "Site keywords",
    "siteKeywordsDescription": "Comma-separated keywords for SEO. Example: open-source, community, board.",
    "siteKeywordsPlaceholder": "open-source, community, board",
    "siteNameRequired": "Site name is required.",
    "siteUrlInvalid": "Site URL must start with http:// or https://.",
```

- [ ] **Step 1.3: Verify both locales parse**

```bash
python3 -m json.tool src/locales/ko.json > /dev/null && echo "ko OK"
python3 -m json.tool src/locales/en.json > /dev/null && echo "en OK"
```

Expected: `ko OK` and `en OK`.

Regenerate merged locales (next-intl reads from `src/messages/` which is built from `src/locales/` + plugin locales):

```bash
node scripts/scan-plugins.js
```

Expected: no errors, merged 2 locales.

Confirm presence:

```bash
grep -c siteUrlDescription src/messages/ko.json src/messages/en.json
```

Expected: each shows 1.

- [ ] **Step 1.4: Commit**

```bash
git add src/locales/ko.json src/locales/en.json
git commit -m "$(cat <<'EOF'
i18n(admin): keys for site_url, site_keywords, and SEO validation

Eight keys added under admin.* in both ko and en: siteUrl, siteUrlDescription,
siteUrlPlaceholder, siteKeywords, siteKeywordsDescription, siteKeywordsPlaceholder,
siteNameRequired, siteUrlInvalid. Consumed in later commits by the admin
settings page and server-side validation error mapping.

---

어드민 설정 페이지와 서버 validation 에서 쓸 i18n 키 8개를 ko/en 양쪽
admin 네임스페이스에 추가: siteUrl/Description/Placeholder, siteKeywords
(동형), siteNameRequired, siteUrlInvalid. 후속 커밋에서 소비.
EOF
)"
```

---

## Task 2: `src/lib/site-settings.ts` helper

**Files:**
- Create: `src/lib/site-settings.ts`

**Goal:** Single function that reads the five SEO-relevant settings in one Prisma query and returns a typed object. Includes header-fallback for `site_url` and locale mapping for OpenGraph.

- [ ] **Step 2.1: Create the helper file**

Create `src/lib/site-settings.ts` with exactly this content:

```ts
import { headers } from 'next/headers'
import { prisma } from './prisma'

export interface SiteMetadataSettings {
  site_name: string
  site_description: string
  site_url: string
  keywords_array: string[]
  site_locale: string
}

const SETTING_KEYS = ['site_name', 'site_description', 'site_url', 'site_keywords', 'site_locale'] as const

export async function loadSiteSettings(): Promise<SiteMetadataSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
  })
  const m = new Map(rows.map((r) => [r.key, r.value]))
  const rawKeywords = m.get('site_keywords') || ''
  return {
    site_name: (m.get('site_name') || '').trim() || 'My Site',
    site_description: (m.get('site_description') || '').trim(),
    site_url: (m.get('site_url') || '').trim(),
    keywords_array: rawKeywords.split(',').map((s) => s.trim()).filter(Boolean),
    site_locale: m.get('site_locale') || 'ko',
  }
}

export async function fallbackUrlFromHeaders(): Promise<string> {
  const h = await headers()
  const proto = h.get('x-forwarded-proto') || 'https'
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  return `${proto}://${host}`
}

export function mapToOgLocale(siteLocale: string): string {
  const map: Record<string, string> = {
    ko: 'ko_KR',
    en: 'en_US',
  }
  return map[siteLocale] || 'en_US'
}
```

- [ ] **Step 2.2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "site-settings" | head -5
```

Expected: no output (no errors in this file).

- [ ] **Step 2.3: Commit**

```bash
git add src/lib/site-settings.ts
git commit -m "$(cat <<'EOF'
feat(core): site-settings helper for SEO metadata

Adds loadSiteSettings (single Prisma query for site_name,
site_description, site_url, site_keywords, site_locale with
sensible empty-value handling), fallbackUrlFromHeaders (request
origin from x-forwarded-* or host), and mapToOgLocale (ko → ko_KR,
en → en_US). Consumed by generateMetadata and RootLayout in the
next commit.

---

SEO 메타데이터용 사이트 설정 헬퍼 추가. 5개 설정 row 를 단일 Prisma
쿼리로 읽어 타입 있는 객체로 반환하고, site_url 빈 값 대비 요청 헤더
폴백, OpenGraph locale 매핑(ko→ko_KR 등) 제공. 다음 커밋의
generateMetadata·RootLayout 에서 사용.
EOF
)"
```

---

## Task 3: Dynamic metadata + async RootLayout

**Files:**
- Modify: `src/app/layout.tsx` (full replacement of the `metadata` export and the `RootLayout` body)

**Goal:** Replace the static `metadata` export with `generateMetadata()` that consumes `loadSiteSettings()`. Make `RootLayout` async so the JSON-LD `<script>` can also use dynamic values. Drive `<html lang>` from `site_locale`.

- [ ] **Step 3.1: Rewrite `src/app/layout.tsx`**

Open `src/app/layout.tsx` and replace the entire file with:

```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/components/providers/SessionProvider'
import ThemeLoader from '@/components/theme-loader'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { loadSiteSettings, fallbackUrlFromHeaders, mapToOgLocale } from '@/lib/site-settings'
import './globals.css'
import './custom.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

async function resolveBaseUrl(settingsUrl: string): Promise<URL> {
  const raw = settingsUrl || (await fallbackUrlFromHeaders())
  try {
    return new URL(raw)
  } catch {
    return new URL(await fallbackUrlFromHeaders())
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSiteSettings()
  const base = await resolveBaseUrl(s.site_url)
  const baseStr = base.toString().replace(/\/$/, '')
  const ogLocale = mapToOgLocale(s.site_locale)

  return {
    metadataBase: base,
    title: {
      default: s.site_description ? `${s.site_name} - ${s.site_description}` : s.site_name,
      template: `%s | ${s.site_name}`,
    },
    ...(s.site_description && { description: s.site_description }),
    ...(s.keywords_array.length > 0 && { keywords: s.keywords_array }),
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: baseStr,
      siteName: s.site_name,
      title: s.site_name,
      ...(s.site_description && { description: s.site_description }),
    },
    twitter: {
      card: 'summary_large_image',
      title: s.site_name,
      ...(s.site_description && { description: s.site_description }),
    },
    alternates: { canonical: baseStr },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const s = await loadSiteSettings()
  const base = await resolveBaseUrl(s.site_url)
  const baseStr = base.toString().replace(/\/$/, '')

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: s.site_name,
    url: baseStr,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseStr}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
  if (s.site_description) ld.description = s.site_description

  return (
    <html lang={s.site_locale} suppressHydrationWarning>
      <head>
        <ThemeLoader />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
        <GoogleAnalytics />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
```

Key changes from the previous file:
- `metadata` static export → `generateMetadata` async function
- `RootLayout` is now `async`
- `<html lang="ko">` hardcode → `<html lang={s.site_locale}>`
- JSON-LD values come from `s` (settings) rather than hardcoded strings
- `authors` field dropped
- `keywords` and `description` appear only when non-empty (conditional spread)

- [ ] **Step 3.2: Typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -E "layout\.tsx" | head -5
```

Expected: no new errors in `src/app/layout.tsx`.

- [ ] **Step 3.3: Verify baseline metadata still renders**

Wait 2-3 seconds for Turbopack to rebuild after the file change. Then:

```bash
curl -s "http://localhost:3001/" | grep -oE '<title>[^<]*</title>' | head -1
curl -s "http://localhost:3001/" | grep -oE '<link rel="canonical"[^/]*/>' | head -1
curl -s "http://localhost:3001/" | grep -c '<meta name="description"'
curl -s "http://localhost:3001/" | grep -c '<meta name="keywords"'
```

Expected (the exact value depends on what's in `settings` table from prior install):
- Title contains whatever `site_name` and optional `site_description` are set to (e.g., `<title>NexiBase - 커뮤니티 플랫폼</title>` if the demo seed had those values; or just `<title>My Site</title>` if empty).
- Canonical `<link>` uses either the configured `site_url` or, if empty, `http://localhost:3001`.
- `description` count is 0 if `site_description` is empty in DB, else 1.
- `keywords` count is 0 (no `site_keywords` row exists yet — that's added via admin UI in Task 4).

If any of these diverge, re-read the helper and metadata code to locate the mismatch before committing.

- [ ] **Step 3.4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(core): dynamic SEO metadata from settings

Replaces the static metadata export in app/layout.tsx with
generateMetadata(), and makes RootLayout async so JSON-LD uses the
same dynamic values. Title template, description, canonical URL,
OpenGraph, Twitter cards, and the WebSite schema all now read from
the settings table via loadSiteSettings(). Empty values omit their
respective meta tags; site_url falls back to request headers; html
lang mirrors site_locale.

---

app/layout.tsx 의 정적 metadata 를 generateMetadata() 로 전환하고
RootLayout 을 async 로 바꿔 JSON-LD 도 같은 동적 값을 사용. title,
description, canonical URL, OpenGraph, Twitter, JSON-LD 전부가
settings 테이블에서 읽혀 렌더됨. 빈 값은 해당 태그 생략, site_url
비면 요청 헤더 폴백, html lang 은 site_locale 그대로.
EOF
)"
```

---

## Task 4: Admin UI — `site_url` and `site_keywords` fields + client validation

**Files:**
- Modify: `src/app/[locale]/admin/settings/page.tsx`

**Goal:** Add `site_url` and `site_keywords` to the Site basics card. Require `site_name` at save time on the client. Surface `site_url` format errors.

- [ ] **Step 4.1: Extend the `SettingsData` interface and default state**

Around the top of `src/app/[locale]/admin/settings/page.tsx` where `interface SettingsData` is defined, add `site_url` and `site_keywords`:

```ts
interface SettingsData {
  site_name: string
  site_locale: string
  site_description: string
  site_url: string
  site_keywords: string
  site_logo: string
  // ...existing fields remain unchanged
}
```

Then extend the `defaultSettings` object (currently around line 88 with `site_name: 'NexiBase', site_locale: 'en', site_description: '', site_logo: '', signup_enabled: 'true'`):

```ts
const defaultSettings: SettingsData = {
  site_name: 'NexiBase',
  site_locale: 'en',
  site_description: '',
  site_url: '',
  site_keywords: '',
  site_logo: '',
  signup_enabled: 'true',
  // ...other existing defaults unchanged
}
```

Ensure the initial `useState<SettingsData>` and the load-from-fetch branch both hydrate `site_url` and `site_keywords` the same way they handle existing strings (using `data.settings.site_url ?? ''` style). If the fetch branch uses a generic `setSettings(data.settings)` pattern, no change is needed there — the new keys will be present if set and absent if not, and the interface allows string.

- [ ] **Step 4.2: Add two new form rows in the Site basics card**

Locate the Site basics card in the JSX (the region rendering `siteName`/`siteLocale`/`siteDescription`/`siteLogo`). Insert a `site_url` row **between `site_name` and `site_locale`**, and a `site_keywords` row **between `site_description` and `site_logo`**.

Insert this after the `site_name` block (currently around line 387):

```tsx
                <div className="grid gap-2">
                  <Label htmlFor="site_url">{t('siteUrl')}</Label>
                  <Input
                    id="site_url"
                    type="url"
                    value={settings.site_url}
                    onChange={(e) => handleChange('site_url', e.target.value)}
                    placeholder={t('siteUrlPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('siteUrlDescription')}
                  </p>
                </div>
```

Insert this after the `site_description` block (currently around line 423, before `siteLogo`):

```tsx
                <div className="grid gap-2">
                  <Label htmlFor="site_keywords">{t('siteKeywords')}</Label>
                  <Input
                    id="site_keywords"
                    value={settings.site_keywords}
                    onChange={(e) => handleChange('site_keywords', e.target.value)}
                    placeholder={t('siteKeywordsPlaceholder')}
                  />
                  <p className="text-sm text-muted-foreground">
                    {t('siteKeywordsDescription')}
                  </p>
                </div>
```

- [ ] **Step 4.3: Client-side validation in the save handler**

Locate the existing save handler (the function that calls `POST /api/admin/settings`). It likely reads `settings` state and posts it. Add validation at the top:

```ts
  const handleSave = async () => {
    // New validation
    if (!settings.site_name.trim()) {
      alert(t('siteNameRequired'))
      return
    }
    const url = settings.site_url.trim()
    if (url !== '' && !/^https?:\/\//.test(url)) {
      alert(t('siteUrlInvalid'))
      return
    }

    // ...existing save logic continues unchanged
  }
```

If the existing save handler name differs (e.g., `handleSubmit`, `save`, `onSave`), use whatever it is. The point is to gate the network call with both checks.

Additionally, if the save handler receives a 400 from the server with `{ error: 'site_name_required' }` or `{ error: 'site_url_invalid' }` (added in Task 5), surface those via `alert(t('siteNameRequired'))` / `alert(t('siteUrlInvalid'))`. Look for an existing `catch` or error-handling branch in the save handler and add a small switch mapping the two error codes to their keys.

- [ ] **Step 4.4: Verify admin page renders**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/ko/admin/settings"
```

Expected: `200` or `307` (redirect to login if not authenticated; both indicate the page compiled).

```bash
npx tsc --noEmit 2>&1 | grep -E "admin/settings/page\.tsx" | head -5
```

Expected: no errors in that file.

- [ ] **Step 4.5: Commit**

```bash
git add src/app/[locale]/admin/settings/page.tsx
git commit -m "$(cat <<'EOF'
feat(admin): site_url and site_keywords inputs + site_name required

Adds two Input rows to the Site basics card — site_url (with
placeholder https://example.com and a description about canonical
URL fallback) and site_keywords (comma-separated with example
placeholder). Extends SettingsData and defaults accordingly. Save
handler now blocks empty site_name and rejects non-http(s)
site_url before the POST, surfacing errors via the new i18n keys.

---

어드민 '사이트 기본 설정' 카드에 site_url, site_keywords 입력란 두 개
추가. SettingsData/defaults 도 맞춰 확장. 저장 핸들러가 site_name 빈값·
site_url 포맷 오류를 POST 전에 차단하고 새 i18n 키로 에러 표시.
EOF
)"
```

---

## Task 5: Admin API — server-side validation

**Files:**
- Modify: `src/app/api/admin/settings/route.ts`

**Goal:** Reject saves that attempt to set `site_name` to empty or `site_url` to an invalid format. Error codes match what the client expects to map to i18n.

- [ ] **Step 5.1: Insert validation before the upsert loop**

Open `src/app/api/admin/settings/route.ts`. Find the POST handler's body parsing block (around line 40). Immediately after the `if (!settings || typeof settings !== 'object')` check and before the `const promises = ...` upsert loop, insert:

```ts
    if ('site_name' in settings) {
      const v = typeof settings.site_name === 'string' ? settings.site_name.trim() : ''
      if (!v) {
        return NextResponse.json({ error: 'site_name_required' }, { status: 400 })
      }
    }

    if ('site_url' in settings) {
      const v = typeof settings.site_url === 'string' ? settings.site_url.trim() : ''
      if (v !== '' && !/^https?:\/\//.test(v)) {
        return NextResponse.json({ error: 'site_url_invalid' }, { status: 400 })
      }
    }
```

The `'site_name' in settings` check means partial updates (a save payload that doesn't include `site_name` at all) are allowed through — validation only fires if the client explicitly tries to set it. Same for `site_url`.

- [ ] **Step 5.2: Functional verification**

The dev server uses an authenticated admin session for POST. Easiest check is via TypeScript + a curl to confirm the GET side still works:

```bash
npx tsc --noEmit 2>&1 | grep -E "admin/settings/route\.ts" | head -5
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/api/admin/settings"
```

Expected: no tsc errors in the file; GET returns 401 without session (that's fine — we're checking the handler compiles and runs).

- [ ] **Step 5.3: Commit**

```bash
git add src/app/api/admin/settings/route.ts
git commit -m "$(cat <<'EOF'
feat(admin): server validation for site_name and site_url

Rejects POST /api/admin/settings when site_name (if present in the
payload) is empty after trim, or when site_url (if present and
non-empty) does not begin with http:// or https://. Returns 400
with stable error codes (site_name_required, site_url_invalid)
that the client maps to localized messages.

---

POST /api/admin/settings 에서 site_name 이 전송됐는데 trim 후 빈
값이거나, site_url 이 전송됐는데 http(s):// 로 시작 안 하면 400
응답. 에러 코드는 클라이언트에서 i18n 로 매핑할 수 있도록 안정된
문자열(site_name_required, site_url_invalid).
EOF
)"
```

---

## Task 6: Install wizard — drop `site_description`

**Files:**
- Modify: `src/app/install/setup/page.tsx`
- Modify: `src/app/api/install/route.ts`
- Modify: `src/lib/install/runInstall.ts`

**Goal:** Remove `site_description` from the install flow entirely. Admin will add it later via settings.

- [ ] **Step 6.1: Remove the Textarea from the install setup page**

In `src/app/install/setup/page.tsx`:

1. Delete the `siteDescription` entries from both locale blocks in `LABELS` (lines 18 and 31):

```diff
-    siteDescription: 'Site Description (optional)',
```
and
```diff
-    siteDescription: '사이트 설명 (선택)',
```

2. Remove `siteDescription: ''` from the `form` useState initializer (line 58):

```diff
  const [form, setForm] = useState({
    adminEmail: '',
    adminPassword: '',
    adminPasswordConfirm: '',
    adminNickname: '',
    siteName: '',
-   siteDescription: '',
  })
```

3. Delete the entire Textarea block (current lines 189-198):

```diff
-        <div>
-          <label className="block text-sm font-medium mb-1">{t.siteDescription}</label>
-          <textarea
-            value={form.siteDescription}
-            onChange={e => handleChange('siteDescription', e.target.value)}
-            rows={3}
-            className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 resize-none"
-          />
-          {errors.siteDescription && <p className="mt-1 text-xs text-red-600">{errors.siteDescription}</p>}
-        </div>
```

If the form POST body includes `siteDescription`, remove it there too. Look for a `fetch('/api/install', { body: JSON.stringify(...) })` call and drop the field.

- [ ] **Step 6.2: Remove `siteDescription` from install API body parsing**

Open `src/app/api/install/route.ts`. Find the body destructuring and drop `siteDescription` from it. Find the `runInstall(...)` call and drop `siteDescription` from the object passed in. The file is short (~95 lines); edit the two spots.

- [ ] **Step 6.3: Remove `siteDescription` from `runInstall`**

Open `src/lib/install/runInstall.ts`. Edit two places:

1. Remove `siteDescription` from the `params` TypeScript type / interface at the top.

2. Remove the `{ key: 'site_description', value: params.siteDescription || '' }` row from the `tx.setting.createMany({ data: [ ... ] })` call (current L52-55). The remaining rows stay.

- [ ] **Step 6.4: Verify install page still compiles**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3001/install/setup?locale=ko"
npx tsc --noEmit 2>&1 | grep -E "install/(setup/page|route)\.ts|runInstall" | head -5
```

Expected: 200 on the page, no tsc errors in the three modified files.

Also fetch the page and confirm the Textarea is gone:

```bash
curl -s "http://localhost:3001/install/setup?locale=ko" | grep -c "<textarea"
curl -s "http://localhost:3001/install/setup?locale=ko" | grep -c "siteDescription"
```

Expected: both 0. The Textarea was the only one on the page; references to `siteDescription` are gone.

- [ ] **Step 6.5: Commit**

```bash
git add src/app/install/setup/page.tsx src/app/api/install/route.ts src/lib/install/runInstall.ts
git commit -m "$(cat <<'EOF'
refactor(install): drop site_description from the install wizard

Site description is a SEO/branding field that operators should
write deliberately in /admin/settings rather than while rushing
through install. Removes the Textarea from the install setup page,
the body parameter from the install API, and the DB write from
runInstall. Existing installs keep their site_description row;
new installs simply don't have one, and the admin settings page
creates it on first save.

---

site_description 은 SEO·브랜딩 필드라 설치 시 성급히 채우기보단
운영자가 어드민에서 신중하게 입력하는 게 맞음. 설치 setup 페이지의
Textarea, install API body, runInstall DB 쓰기에서 모두 제거. 기존
설치본은 site_description row 유지, 새 설치본은 row 없이 시작하고
어드민에서 저장할 때 upsert 로 생성됨.
EOF
)"
```

---

## Task 7: Manual verification pass

**Files:** none (verification only)

**Goal:** Walk through the spec's verification checklist end-to-end.

- [ ] **Step 7.1: Set test values via DB**

Because only admin can POST /api/admin/settings and we aren't logged in, set values directly via Prisma Client for quick verification:

```bash
node -e "
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  await p.setting.upsert({
    where: { key: 'site_name' }, update: { value: 'My Test Site' }, create: { key: 'site_name', value: 'My Test Site' },
  })
  await p.setting.upsert({
    where: { key: 'site_description' }, update: { value: 'A place for testing' }, create: { key: 'site_description', value: 'A place for testing' },
  })
  await p.setting.upsert({
    where: { key: 'site_url' }, update: { value: 'https://mysite.example' }, create: { key: 'site_url', value: 'https://mysite.example' },
  })
  await p.setting.upsert({
    where: { key: 'site_keywords' }, update: { value: 'test, nexibase, demo' }, create: { key: 'site_keywords', value: 'test, nexibase, demo' },
  })
  console.log('settings applied')
  await p.\$disconnect()
})()
"
```

Wait 1-2 seconds for the metadata to reflect (every request rebuilds metadata — no cache).

- [ ] **Step 7.2: Verify rendered HTML reflects settings**

```bash
curl -s "http://localhost:3001/" > /tmp/home.html
grep -oE '<title>[^<]*</title>' /tmp/home.html | head -1
grep -oE '<link rel="canonical" href="[^"]*"/>' /tmp/home.html
grep -oE '<meta name="description" content="[^"]*"/>' /tmp/home.html
grep -oE '<meta name="keywords" content="[^"]*"/>' /tmp/home.html
grep -oE '<meta property="og:url" content="[^"]*"/>' /tmp/home.html
grep -oE '<meta property="og:site_name" content="[^"]*"/>' /tmp/home.html
grep -oE '<meta property="og:locale" content="[^"]*"/>' /tmp/home.html
grep -oE '<html lang="[^"]*"' /tmp/home.html
```

Expected (order may vary):
- title: `My Test Site - A place for testing`
- canonical: `https://mysite.example`
- description: `A place for testing`
- keywords: `test, nexibase, demo` (Next.js joins arrays with `,`)
- og:url: `https://mysite.example`
- og:site_name: `My Test Site`
- og:locale: `ko_KR` (default locale)
- html lang: `ko`

- [ ] **Step 7.3: Verify JSON-LD reflects settings**

```bash
grep -oE '<script type="application/ld\+json">[^<]*</script>' /tmp/home.html | head -1
```

Expected: a JSON string containing `"name":"My Test Site"`, `"url":"https://mysite.example"`, `"description":"A place for testing"`.

- [ ] **Step 7.4: Verify empty-value handling**

Clear the three optional settings:

```bash
node -e "
const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()
;(async () => {
  await p.setting.update({ where: { key: 'site_description' }, data: { value: '' } })
  await p.setting.update({ where: { key: 'site_url' }, data: { value: '' } })
  await p.setting.update({ where: { key: 'site_keywords' }, data: { value: '' } })
  console.log('cleared')
  await p.\$disconnect()
})()
"
sleep 2
curl -s "http://localhost:3001/" > /tmp/home-empty.html
grep -c '<meta name="description"' /tmp/home-empty.html
grep -c '<meta name="keywords"' /tmp/home-empty.html
grep -oE '<link rel="canonical" href="[^"]*"/>' /tmp/home-empty.html
grep -oE '<title>[^<]*</title>' /tmp/home-empty.html | head -1
```

Expected:
- description count: 0 (tag omitted)
- keywords count: 0 (tag omitted)
- canonical: `http://localhost:3001` (header fallback since site_url is empty)
- title: `My Test Site` (no `- description` appended when description is empty)

- [ ] **Step 7.5: Verify admin validation (server-side)**

Simulate a bad save via curl with a fake cookie (will 401 but shows the route still compiles), then via Prisma Client verify that trying to save empty `site_name` can be caught client-side by the admin UI when you visit it in a browser. Since we can't easily simulate an authenticated admin POST from the CLI here, mark this step as "verified via UI in Task 4.4 (page 200 check)" — the actual behavior check needs a logged-in session and is done manually in the browser.

- [ ] **Step 7.6: Verify install flow (new site smoke)**

```bash
curl -s "http://localhost:3001/install/setup?locale=ko" | grep -c "<textarea"
curl -s "http://localhost:3001/install/setup?locale=en" | grep -c "<textarea"
```

Expected: both 0 (the Textarea was only used for site_description and is now removed).

- [ ] **Step 7.7: Restore original setting values (if desired)**

If the test values in Step 7.1 should be rolled back to the original pre-feature state, run a cleanup. Otherwise just leave the cleared values — running the admin UI on your own can repopulate them.

This task has no commit.

---

## Task 8: Version bump

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

**Goal:** Bump to v0.25.0 (minor — new admin-facing feature, new DB-consumed setting keys).

- [ ] **Step 8.1: Bump version**

```bash
npm version minor --no-git-tag-version
```

Expected: `package.json` version becomes `0.25.0`.

- [ ] **Step 8.2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: v0.25.0 — SEO metadata settings (site_url, keywords) + install simplification"
```

---

## Self-Review Summary

Built against spec sections:

- **Spec §3.1 (setting keys)** → Tasks 2, 4, 5 (helper reads keys, UI edits them, API validates).
- **Spec §3.2 (generateMetadata)** → Task 3.
- **Spec §3.3 (helper)** → Task 2.
- **Spec §3.4 (JSON-LD)** → Task 3 (RootLayout async block).
- **Spec §3.5 (admin UI)** → Task 4.
- **Spec §3.6 (i18n keys)** → Task 1.
- **Spec §3.7 (install changes)** → Task 6.
- **Spec §3.8 (server validation)** → Task 5.
- **Spec §4 (edge cases)** → exercised in Task 3 (try/catch on URL), Task 7.4 (empty value rendering), Task 5 (validation paths).
- **Spec §5 (manual verification)** → Task 7.

No test framework in the project; verification is HTTP/curl/grep based.
