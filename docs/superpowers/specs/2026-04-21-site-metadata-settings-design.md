# 사이트 SEO 메타데이터 설정화 — Design

- **작성일:** 2026-04-21
- **Status:** Approved (brainstorming → writing-plans)
- **타겟 파일:**
  - `src/app/layout.tsx` (metadata export → generateMetadata)
  - `src/app/[locale]/admin/settings/page.tsx` (신규 필드 UI + site_name validation)
  - `src/app/install/setup/page.tsx` (site_description 필드 제거)
  - `src/lib/install/runInstall.ts` (site_description 저장 제거)
  - `src/app/api/install/route.ts` (siteDescription 파라미터 제거)
  - `src/app/api/admin/settings/route.ts` (site_name 서버측 validation)
  - `src/lib/site-settings.ts` (신규, 헬퍼)
  - `src/locales/{ko,en}.json` (신규 i18n 키)

---

## 1. 배경과 목표

### 1.1 배경

현재 [src/app/layout.tsx](../../../src/app/layout.tsx) 의 `metadata` export 는 정적 문자열로 하드코딩되어 있다.

- `title.default` = `'NexiBase - 커뮤니티 플랫폼'`
- `title.template` = `'%s | NexiBase'`
- `description`, `keywords`, `authors`, `openGraph.*`, `twitter.*`, `alternates.canonical`, JSON-LD `<script>` 모두 NexiBase 브랜드 문자열과 `https://nexibase.com` URL 로 고정.

Nexibase 를 포크하거나 셀프호스팅하는 운영자는 title·description 은 물론 canonical URL 도 교체할 방법이 없다. 실질적 SEO 버그 (잘못된 canonical, 잘못된 OG URL) 및 브랜딩 누수.

### 1.2 목표

- 사이트의 SEO 관련 텍스트·URL 을 어드민 설정에서 편집 가능하게 하고, `generateMetadata()` 를 통해 DB 설정값을 실시간 반영한다.
- 설치 마법사는 최소화한다: `site_name` 만 설치 시 입력받고, `site_description` 을 포함한 SEO 성격의 설정은 어드민에서 신중하게 편집하도록 이관한다.
- 기존 설치본 호환: 추가 마이그레이션 불필요.

### 1.3 범위 (In / Out)

**In**
- `site_name` — 기존 설정, 어드민 저장 시 required validation 추가 (지금은 install 만 required).
- `site_description` — 기존 설정, install 에서 제거.
- `site_url` — 신규 설정 필드, canonical/OG/JSON-LD URL 소스.
- `site_keywords` — 신규 설정 필드, meta keywords 배열 소스.
- metadata 생성: `generateMetadata()` 전환, JSON-LD `<script>` 도 동적화.

**Out**
- `og_image` (소셜 미리보기 이미지) — 파일 업로드가 필요해 성격이 다름. 별건 스펙.
- `robots` noindex 토글 — 필요해지면 별건.
- Twitter handle, author/creator — 거의 쓰이지 않음.
- Favicon — `site_logo` 재활용 여지. 별건.
- 단위/통합 테스트 — 프로젝트에 테스트 프레임워크 없음. 수동 검증으로.
- `<meta name="authors">` — `[{name: 'NexiBase'}]` 하드코딩은 삭제. 별도 설정 안 추가.

### 1.4 설계 원칙

- **정직한 메타데이터.** 설정이 비어있으면 해당 태그 자체를 생략한다. 하드코딩 fallback 금지 (`site_name` 제외).
- **최소 필수 필드.** `site_name` 만 required. 나머지는 optional.
- **런타임 반영.** 빌드 타임 고정 아닌 요청 시 DB 에서 읽어 동적 메타데이터 생성. 설정 변경이 재배포 없이 즉시 반영.
- **헤더 폴백.** `site_url` 미설정 시 Next.js `headers()` 로 요청 origin 감지 — 셀프호스팅 시 설정 안 해도 기본 동작.

---

## 2. 현재 상태 분석

### 2.1 metadata 하드코딩

[src/app/layout.tsx:13-49](../../../src/app/layout.tsx#L13-L49) 전체가 정적. 수정 불가.

### 2.2 설정 테이블 상태

설치 시 ([src/lib/install/runInstall.ts:50-55](../../../src/lib/install/runInstall.ts#L50-L55)) 다음이 `settings` 테이블에 upsert 됨:

```
site_name         = params.siteName
site_description  = params.siteDescription || ''
site_locale       = params.locale
signup_enabled    = 'true'
```

어드민 settings 페이지는 `site_name`, `site_description`, `site_locale`, `site_logo`, `signup_enabled` 등을 편집 가능. 단 서버측 validation 없이 빈 문자열 저장 허용.

### 2.3 Install 수집 필드

[src/app/install/setup/page.tsx:52-59](../../../src/app/install/setup/page.tsx#L52-L59):
- adminEmail, adminPassword, adminPasswordConfirm, adminNickname — 관리자 계정
- **siteName** (required), **siteDescription** (optional) — 사이트 정보

---

## 3. 설계

### 3.1 설정 키 정의

| key | 타입 | 기본 | 편집 경로 | validation |
|---|---|---|---|---|
| `site_name` | string | (install 시 required) | install + admin | 어드민 저장 시에도 trim 후 빈값 거부 |
| `site_description` | string | `''` | admin only | 없음 |
| `site_url` | string | `''` | admin only (신규) | 비거나 `http://`/`https://` 로 시작 |
| `site_keywords` | string (콤마 구분) | `''` | admin only (신규) | 없음 |

### 3.2 metadata 생성 (`generateMetadata`)

```ts
// src/app/layout.tsx (발췌, 전체는 기존 구조 유지)
export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSiteSettings()
  const siteUrl = s.site_url || await fallbackUrlFromHeaders()
  const ogLocale = mapToOgLocale(s.site_locale)

  let base: URL
  try { base = new URL(siteUrl) } catch { base = new URL(await fallbackUrlFromHeaders()) }

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
      url: base.toString(),
      siteName: s.site_name,
      title: s.site_name,
      ...(s.site_description && { description: s.site_description }),
    },
    twitter: {
      card: 'summary_large_image',
      title: s.site_name,
      ...(s.site_description && { description: s.site_description }),
    },
    alternates: { canonical: base.toString() },
    robots: { /* 기존 그대로 */ },
  }
}
```

- `authors` 필드는 삭제 (SEO 영향 없음).
- 모든 optional 값은 spread 조건부(`...(cond && {...})`) 로 처리해 빈 경우 키 자체가 JSON에 들어가지 않음.
- Next.js 는 metadata 객체에서 `undefined`/`null` 키를 생략하지만, optional spread 가 더 확실하다.

### 3.3 헬퍼 (`src/lib/site-settings.ts` — 신규)

```ts
import { prisma } from './prisma'
import { headers } from 'next/headers'

export interface SiteMetadataSettings {
  site_name: string
  site_description: string
  site_url: string
  keywords_array: string[]
  site_locale: string
}

export async function loadSiteSettings(): Promise<SiteMetadataSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['site_name', 'site_description', 'site_url', 'site_keywords', 'site_locale'] } },
  })
  const m = new Map(rows.map(r => [r.key, r.value]))
  const raw = m.get('site_keywords') || ''
  return {
    site_name: (m.get('site_name') || '').trim() || 'My Site',
    site_description: (m.get('site_description') || '').trim(),
    site_url: (m.get('site_url') || '').trim(),
    keywords_array: raw.split(',').map(s => s.trim()).filter(Boolean),
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

- `'My Site'` 폴백은 이중 방어 — 정상 운영 경로(install + admin save validation)에선 빈 값이 저장되지 않지만, DB 직접 수정·수동 seed 등 비정상 경로 대비.

### 3.4 JSON-LD 동적화

[src/app/layout.tsx:57-74](../../../src/app/layout.tsx#L57-L74) 의 WebSite 스키마도 `loadSiteSettings()` 결과로 생성. RootLayout 컴포넌트를 `async` 로 변환:

```tsx
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const s = await loadSiteSettings()
  const siteUrl = s.site_url || await fallbackUrlFromHeaders()
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: s.site_name,
    url: siteUrl,
    ...(s.site_description && { description: s.site_description }),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl.replace(/\/$/, '')}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang={s.site_locale} suppressHydrationWarning>
      <head>
        <ThemeLoader />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
        <GoogleAnalytics />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ... */}
      </body>
    </html>
  )
}
```

- `<html lang>` 도 `site_locale` 에서 가져와 정적 `"ko"` 하드코딩 제거.
- `loadSiteSettings()` 는 RootLayout 과 `generateMetadata` 각각에서 호출 (두 번). 각각 독립 요청이므로 DB 쿼리도 두 번. Prisma 쿼리 캐싱이 있으면 재사용됨. 마이크로 최적화 가능하지만 이번 범위 외.

### 3.5 어드민 설정 UI

[src/app/[locale]/admin/settings/page.tsx](../../../src/app/[locale]/admin/settings/page.tsx) "Site basics" 카드 내부:

1. 기존 `site_name` Input — `required` 속성 추가, 저장 핸들러에서 trim 후 빈값 확인.
2. 신규 `site_url` Input — `type="url"`, placeholder `https://example.com`, 헬프 텍스트 아래.
3. 기존 `site_description` Textarea — 변경 없음.
4. 신규 `site_keywords` Input (단일 라인), placeholder `오픈소스, 커뮤니티, 게시판`, 헬프 텍스트.
5. 기존 `site_logo`, `site_locale` — 변경 없음.

**저장 핸들러**
- 클라이언트: `site_name` 비어있으면 에러 alert, 저장 요청 안 보냄.
- 서버: POST `/api/admin/settings` 에서도 `site_name` 비어있으면 400 에러. (클라이언트 우회 대비.)
- `site_url` 값이 있으면 `/^https?:\/\//` 매칭 검증. 미매칭 시 클라이언트에서 에러, 서버도 400.

### 3.6 i18n 키 (신규)

어드민 설정 페이지는 `useTranslations('admin')` 스코프를 사용 (확인됨 — [admin/settings/page.tsx:106](../../../src/app/[locale]/admin/settings/page.tsx#L106)). 기존 `siteName`, `siteDescription` 키는 `src/locales/{ko,en}.json` 의 `"admin"` 객체 하위에 위치. 신규 키도 동일 객체에 추가:

```
admin.siteUrl                   "Site URL" / "사이트 URL"
admin.siteUrlDescription        "Canonical URL used in search engines and social cards. Leave empty to auto-detect from request host." / "검색엔진·소셜카드의 canonical URL. 비워두면 요청 호스트에서 자동 감지됩니다."
admin.siteKeywords              "Site keywords" / "사이트 키워드"
admin.siteKeywordsDescription   "Comma-separated keywords for SEO. Example: open-source, community, board." / "SEO 키워드, 콤마로 구분. 예: 오픈소스, 커뮤니티, 게시판"
admin.siteNameRequired          "Site name is required." / "사이트 이름을 입력해주세요."
admin.siteUrlInvalid            "Site URL must start with http:// or https://." / "사이트 URL은 http:// 또는 https:// 로 시작해야 합니다."
```

컴포넌트 내부 접근은 네임스페이스 스코프가 이미 `admin` 이므로 `t('siteUrl')` 형태. 에러 메시지도 `t('siteNameRequired')` 식.

### 3.7 Install 수정

**[src/app/install/setup/page.tsx](../../../src/app/install/setup/page.tsx)**
- LABELS 객체에서 `siteDescription` 키 제거 (두 locale 모두).
- `form` state 에서 `siteDescription: ''` 제거.
- POST body 에서 `siteDescription` 제거.
- Textarea UI 블록 제거 (L189-L198).

**[src/app/api/install/route.ts](../../../src/app/api/install/route.ts)**
- body 파싱·runInstall 호출에서 siteDescription 제거.

**[src/lib/install/runInstall.ts](../../../src/lib/install/runInstall.ts)**
- `params` 타입에서 `siteDescription?: string` 제거.
- `tx.setting.createMany` 에서 `{ key: 'site_description', value: params.siteDescription || '' }` row 제거.

### 3.8 API — `site_name`, `site_url` 서버 validation

**[src/app/api/admin/settings/route.ts](../../../src/app/api/admin/settings/route.ts)** POST 핸들러의 body shape 은 `{ settings: Record<string, string> }` (확인됨, L40). upsert 반복 시작 전에 validation 추가:

```ts
if ('site_name' in settings) {
  const v = typeof settings.site_name === 'string' ? settings.site_name.trim() : ''
  if (!v) return NextResponse.json({ error: 'site_name_required' }, { status: 400 })
}
if ('site_url' in settings) {
  const v = typeof settings.site_url === 'string' ? settings.site_url.trim() : ''
  if (v !== '' && !/^https?:\/\//.test(v)) {
    return NextResponse.json({ error: 'site_url_invalid' }, { status: 400 })
  }
}
```

- 에러 코드(`site_name_required`, `site_url_invalid`)는 내부 식별자. 클라이언트는 이 값을 인식해 해당 i18n 에러 메시지(`admin.siteNameRequired`, `admin.siteUrlInvalid`)를 표시.

---

## 4. 엣지케이스

- **`site_name` 빈 값이 DB에 남아있는 비정상 상태**: `loadSiteSettings()` 이 `'My Site'` 로 폴백 → 기본 title `Home | My Site`. 브랜딩 누수 없음.
- **`site_url` 잘못된 형식**: `new URL()` try/catch 로 감싸 request host 폴백.
- **`site_keywords = ",,  ,"`**: split + trim + filter 가 빈 배열 반환. `keywords` 태그 생략.
- **기존 설치본**: `site_url`, `site_keywords` row 가 없음 → 빈 문자열로 읽힘 → 헤더 폴백 / 태그 생략. 동작 문제 없음.
- **`site_description` 제거 후에도 DB row 잔존**: 어드민 Textarea 에 정상 로드/편집. 변경 없음.
- **site_locale 이 `ko`/`en` 이외 값**: `mapToOgLocale` 에서 `'en_US'` 폴백.

---

## 5. 검증 (수동)

**설치 흐름**
- [ ] 새 설치: description 필드 없음. 설치 완료.
- [ ] 설치 후 `/admin/settings` 에 `site_url`, `site_keywords` 필드 보임. `site_description` 필드 유지.

**어드민 validation**
- [ ] `site_name` 비우고 저장 → 에러 (클라이언트 + 서버).
- [ ] `site_url = example.com` (프로토콜 없음) 저장 → 에러.
- [ ] `site_url = https://example.com` 저장 → 성공.

**메타데이터 렌더링 (브라우저 HTML 검사)**
- [ ] 홈페이지 title: `{site_name} - {site_description}` (둘 다 있을 때) / `{site_name}` (description 빈 경우).
- [ ] 게시판 상세: `{post.title} | {site_name}`.
- [ ] `<link rel="canonical">` 값이 설정된 `site_url` 과 일치.
- [ ] `<meta name="description">`: description 비면 태그 안 나감, 있으면 값 일치.
- [ ] `<meta name="keywords">`: keywords 비면 태그 안 나감, 있으면 콤마 구분 리스트.
- [ ] `<meta property="og:url">`, `<meta property="og:site_name">`, `<meta property="og:locale">` 확인.
- [ ] JSON-LD `<script>` 에 `name`, `url`, `description` 동적 값 반영.
- [ ] `<html lang>` 이 `site_locale` 반영.

**헤더 폴백**
- [ ] `site_url` 비우고 `localhost:3001` 접속 → canonical 등이 `http://localhost:3001`.
- [ ] `site_url = https://mysite.com` 저장 후 → canonical 등이 `https://mysite.com`.

**기존 설치본**
- [ ] site_description 이 이미 DB 에 있는 설치본 → 어드민 Textarea 에 로드, description 메타데이터에 반영.

---

## 6. 변경하지 않는 것

- SiteContext (client-side fetch 경로)
- `/api/settings` (public) 반환 shape — 신규 필드가 필요하면 별건.
- 게시판 상세 페이지 등 하위 페이지의 `generateMetadata()` — template 기반 title override 그대로.
- `site_logo` 처리.
- signup_enabled.

---

## 7. 열린 이슈 / 후속 작업

- OG image (`og_image` 설정 + 업로드 UI) — 별건.
- Twitter handle, Facebook App ID 같은 추가 OG/Twitter 메타 — 별건.
- robots noindex 토글 (스테이징용) — 별건.
- Favicon 교체 — `site_logo` 와 연결할지, 별도 favicon 슬롯을 둘지 — 별건.
- site_url 이 여러 개여도 되는 멀티도메인 (예: 같은 설치본을 `.kr` 과 `.com` 으로) — 이번엔 단일 기준, 헤더 폴백으로 적당히 대응.
