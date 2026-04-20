# Widget i18n — nexibase.com Landing Widgets

**Date:** 2026-04-21
**Scope:** Runtime user-facing widgets only. Admin UI plugin/widget metadata stays English (per existing project rule).

## Problem

`src/messages/ko.json` has a full `widgets` namespace, but four widgets in `src/widgets/` contain hardcoded English strings that bypass i18n. Switching the site to Korean via the DB `site_locale` setting leaves these widgets rendering English.

Plugins under `src/plugins/*` are already i18n-correct (they use `useTranslations`).

## Approach

Refactor four widget files to call `useTranslations('widgets')` instead of using inline English literals. Add the missing keys to both `src/messages/en.json` and `src/messages/ko.json` under the existing `widgets` namespace.

No new modules, no routing changes, no DB changes. `site_locale` already controls language via [src/i18n/request.ts](../../../src/i18n/request.ts).

## Out of Scope

- `plugin.ts` name/description (English by existing rule — admin UI only)
- `*.meta.ts` title/description (English — admin widget catalog only)
- Widgets inside `src/plugins/*` (already use i18n)
- `i18n/routing.ts` `defaultLocale` (DB `site_locale` is authoritative; no change)
- Merging `NexibaseHero.tsx` and `NexibaseHomeHero.tsx` duplication (separate concern)

## Files to Change

### `src/widgets/NexibaseLandingHero.tsx`
Largest scope. Current unstaged diff (GitHub tag fallback fix) must be preserved — it will be committed separately before this refactor.

Hardcoded strings to move under `widgets.landingHero.*`:
- Badge: `Open source · Next.js 16`
- Headline: `The community CMS, in one Next.js app.`
- Tagline (multi-line marketing copy)
- Copy button `aria-label`: `Copy install command`
- CTA buttons: `Star on GitHub`, `Live demo`, `Docs`
- FEATURES array labels: `Plugins`, `Themes`, `Widgets`, `Boards`, `Auth`, `EN / 한국어`
- Footer: `MIT · Self-hostable`
- `formatRelativeTime` outputs: `today`, `Xd ago`, `Xw ago`, `Xmo ago`, `Xy ago`

Structural changes required:
- `FEATURES` array must move inside the component body (labels depend on `t()`).
- `formatRelativeTime` must become a `useCallback`/inline function inside the component so it can call `t()` with interpolation.

### `src/widgets/NexibaseHero.tsx`
No new keys needed — reuses existing `widgets.*` keys:
- `widgets.welcome` → "Welcome" badge
- `widgets.welcomeUser` (`{nickname}`) → "Welcome back, X!"
- `widgets.welcomeSite` (`{siteName}`) → "Welcome to NexiBase"
- `widgets.defaultDesc` → fallback description
- `widgets.startBtn` → "Get started"
- `widgets.learnMore` → "Learn more"
- `GitHub` button label: **stays hardcoded** (brand name)

`siteName` can be derived from the `site_name` setting already fetched, or fall back to `NexiBase`.

### `src/widgets/NexibaseHomeHero.tsx`
Same treatment as `NexibaseHero.tsx`. Reuses same keys.

### `src/widgets/DemoGuide.tsx`
New keys under `widgets.demoGuide.*`:
- `title` → "Try the demo site"
- `description` → "Experience every NexiBase feature yourself."
- `visitBtn` → "Visit the demo site"

`ID:` and `PW:` labels **stay hardcoded** (short tokens clearer in Latin script, confirmed by user).

## New Translation Keys

Under `widgets` namespace in both `src/messages/en.json` and `src/messages/ko.json`. Existing flat keys (`welcome`, `welcomeUser`, `defaultDesc`, `startBtn`, `learnMore`, etc.) are preserved unchanged.

```jsonc
"widgets": {
  // ... existing keys unchanged ...

  "landingHero": {
    "badge": "Open source · Next.js 16",              // "오픈소스 · Next.js 16"
    "headline": "The community CMS, in one Next.js app.",
                                                       // "Next.js 앱 하나로, 커뮤니티 CMS를."
    "tagline": "Launch forums, boards, and membership sites in under a minute — plugin folders, CSS-variable themes, pick your language at install. One self-hostable codebase.",
                                                       // "포럼·게시판·멤버십 사이트를 1분 안에 런칭하세요 — 플러그인 폴더, CSS 변수 테마, 설치 시점에 언어 선택. 셀프 호스팅 가능한 단일 코드베이스."
    "copyAria": "Copy install command",                // "설치 명령어 복사"
    "starOnGithub": "Star on GitHub",                  // "GitHub에 스타 남기기"
    "liveDemo": "Live demo",                           // "라이브 데모"
    "docs": "Docs",                                    // "문서"
    "features": {
      "plugins": "Plugins",                            // "플러그인"
      "themes": "Themes",                              // "테마"
      "widgets": "Widgets",                            // "위젯"
      "boards": "Boards",                              // "게시판"
      "auth": "Auth",                                  // "인증"
      "i18n": "EN / 한국어"                            // "EN / 한국어"
    },
    "footer": "MIT · Self-hostable",                   // "MIT · 셀프 호스팅"
    "relativeTime": {
      "today": "today",                                // "오늘"
      "daysAgo": "{days}d ago",                        // "{days}일 전"
      "weeksAgo": "{weeks}w ago",                      // "{weeks}주 전"
      "monthsAgo": "{months}mo ago",                   // "{months}개월 전"
      "yearsAgo": "{years}y ago"                       // "{years}년 전"
    }
  },

  "demoGuide": {
    "title": "Try the demo site",                      // "데모 사이트 체험하기"
    "description": "Experience every NexiBase feature yourself.",
                                                       // "NexiBase의 모든 기능을 직접 경험해 보세요."
    "visitBtn": "Visit the demo site"                  // "데모 사이트 방문하기"
  }
}
```

### Key-collision notes

- Existing `widgets.today` (= "오늘", used for today's visitor count) is intentionally separate from new `widgets.landingHero.relativeTime.today`. Same Korean word, different semantic contexts — kept distinct.

## Implementation Order

1. Commit the existing unstaged diff in `NexibaseLandingHero.tsx` (GitHub tag fallback) as a standalone commit.
2. Add new keys to `src/messages/en.json` (`widgets.landingHero.*`, `widgets.demoGuide.*`).
3. Add mirrored keys to `src/messages/ko.json`.
4. Refactor `NexibaseLandingHero.tsx` — move `FEATURES` and `formatRelativeTime` into component body, replace literals with `t()` calls.
5. Refactor `NexibaseHero.tsx` — replace literals with `t()` calls using existing keys.
6. Refactor `NexibaseHomeHero.tsx` — same as step 5.
7. Refactor `DemoGuide.tsx` — replace literals with `t()` calls under `widgets.demoGuide.*`.
8. Run `npm run build` — must pass.
9. Visual verification: render landing page with `site_locale=ko` and `site_locale=en`.

## Verification

- **Build:** `npm run build` must succeed (type-check covers `t()` key typos via next-intl's generated types where applicable).
- **Runtime (ko):** set DB `site_locale=ko`, load `/`, confirm all four widgets render Korean. Confirm FEATURES row, relative-time label on version badge, and all CTAs.
- **Runtime (en):** set DB `site_locale=en`, reload, confirm English fallback still renders identically to pre-refactor.
- No automated tests exist for widgets; verification is visual.

## Risks

- **Missing translation keys** → next-intl shows the raw key in production. Mitigated by adding keys to both locale files before refactoring TSX.
- **Unrelated diff entanglement** → mitigated by splitting the unstaged landing-hero commit first.
- **Server/client boundary** → all four widgets are already client components (`"use client"`); no SSR hydration concerns with `useTranslations`.
