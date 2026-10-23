# Admin Site-Locale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin-editable "Site language" dropdown to `/admin/settings` that writes to the existing `site_locale` DB setting and reloads the page when the locale changes.

**Architecture:** Single-file frontend change. The save API (`POST /api/admin/settings`) already upserts arbitrary keys, and `src/i18n/request.ts` reads `site_locale` from DB on every request (no cache). Therefore this is pure client-side state wiring plus a UI control plus two i18n strings. No backend, schema, routing, or middleware changes.

**Tech Stack:** Next.js 16, next-intl, React 19, shadcn `Select` (Radix), Prisma (unchanged). No test framework installed in repo — verification is lint + build + manual browser check.

**Spec:** `docs/superpowers/specs/2026-04-20-admin-site-locale-design.md`

---

## File structure

One component file and two message files are modified. Nothing is created.

- Modify: `src/app/[locale]/admin/settings/page.tsx` (state, save handler, UI block, imports)
- Modify: `src/locales/ko.json` (two new keys in `admin` namespace, near the existing `siteName` entry). NOTE: `src/messages/*.json` are gitignored auto-generated outputs of `scripts/scan-plugins.js` — always edit `src/locales/*.json` (the tracked source of truth).
- Modify: `src/locales/en.json` (matching keys)

Unchanged (explicit non-goals, do not touch):
- `src/app/api/admin/settings/route.ts` — already accepts arbitrary keys
- `src/i18n/request.ts` — already reads DB + falls back cleanly
- `src/i18n/routing.ts` / `src/i18n/_generated-locales.ts` — source of truth for locales
- Prisma schema, migrations, install wizard

---

## Task 1: Create feature branch

**Files:** none

- [ ] **Step 1: Verify working tree is clean on main**

Run: `git -C /path/to/nexibase status --short`
Expected: No modified tracked files (submodule pointer changes OK; don't include in this feature). If tracked files are dirty, stop and ask.

- [ ] **Step 2: Verify main is up-to-date**

Run: `git -C /path/to/nexibase fetch origin && git -C /path/to/nexibase log HEAD..origin/main --oneline`
Expected: Empty output (no unpulled commits). If non-empty, `git -C /path/to/nexibase pull --ff-only origin main` first.

- [ ] **Step 3: Create branch**

Run: `git -C /path/to/nexibase checkout -b feat/admin-site-locale`
Expected: `Switched to a new branch 'feat/admin-site-locale'`

---

## Task 2: Add i18n keys to message files

**Files:**
- Modify: `src/locales/ko.json` — insert two keys after the `siteName` entry (around line 787). NOTE: `src/messages/*.json` are gitignored generated outputs; always edit `src/locales/*.json`.
- Modify: `src/locales/en.json` — insert two keys at the matching position

- [ ] **Step 1: Add Korean strings**

Using Edit tool on `src/locales/ko.json`. Replace:

```json
    "siteName": "사이트 이름",
    "siteDescription": "사이트 설명",
```

with:

```json
    "siteName": "사이트 이름",
    "siteLocale": "사이트 언어",
    "siteLocaleDescription": "관리자 화면과 공개 사이트 전반에 적용됩니다. 저장 시 페이지가 새로고침됩니다.",
    "siteDescription": "사이트 설명",
```

- [ ] **Step 2: Add English strings**

Using Edit tool on `src/locales/en.json`. Replace:

```json
    "siteName": "Site name",
    "siteDescription": "Site description",
```

with:

```json
    "siteName": "Site name",
    "siteLocale": "Site language",
    "siteLocaleDescription": "Applies to the admin and the public site. The page will reload when saved.",
    "siteDescription": "Site description",
```

- [ ] **Step 3: Verify JSON is still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('/path/to/nexibase/src/locales/ko.json','utf8')); JSON.parse(require('fs').readFileSync('/path/to/nexibase/src/locales/en.json','utf8')); console.log('ok')"`
Expected: `ok`. If it throws, fix the comma/brace before proceeding.

- [ ] **Step 4: Commit**

Run:
```bash
git -C /path/to/nexibase add src/locales/ko.json src/locales/en.json
git -C /path/to/nexibase commit -m "i18n(admin): add siteLocale label and description"
```

---

## Task 3: Wire `site_locale` through component state

**Files:**
- Modify: `src/app/[locale]/admin/settings/page.tsx`

This task adds the type field, the default, and a ref for comparing the persisted locale. It does NOT yet add the UI control or change the save flow — those come in Tasks 4 and 5. This ordering keeps each commit independently shippable without lint/type errors.

- [ ] **Step 1: Add `site_locale` to the `SettingsData` interface**

In `src/app/[locale]/admin/settings/page.tsx`, find the `SettingsData` interface (around line 35). Replace:

```ts
interface SettingsData {
  // Site basics
  site_name: string
  site_description: string
  site_logo: string
```

with:

```ts
interface SettingsData {
  // Site basics
  site_name: string
  site_locale: string
  site_description: string
  site_logo: string
```

- [ ] **Step 2: Add `site_locale` to `DEFAULT_SETTINGS`**

Find the `DEFAULT_SETTINGS` const (around line 75). Replace:

```ts
const DEFAULT_SETTINGS: SettingsData = {
  site_name: 'NexiBase',
  site_description: '',
```

with:

```ts
const DEFAULT_SETTINGS: SettingsData = {
  site_name: 'NexiBase',
  site_locale: 'en',
  site_description: '',
```

Rationale: matches `routing.defaultLocale` in `src/i18n/routing.ts`. This value is overwritten by the GET response on mount, so it only governs the brief pre-load flash.

- [ ] **Step 3: Import `useRef`**

Find the existing import near line 3:

```ts
import { useState, useEffect, useCallback } from "react"
```

Replace with:

```ts
import { useState, useEffect, useCallback, useRef } from "react"
```

- [ ] **Step 4: Add `localeOnLoadRef` inside the component and set it in `fetchSettings`**

Find the state declarations near line 95 (`const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS)`) and add a new line directly after the existing refs/state where the useState block ends (after line 102 `const [themes, setThemes] = useState<ThemeInfo[]>([])`). Add:

```ts
  const localeOnLoadRef = useRef<string | null>(null)
```

Then find the `fetchSettings` function (around line 166). Replace:

```ts
      if (response.ok && data.settings) {
        const hasAny = Object.keys(data.settings).length > 0
        setHasSettings(hasAny)
        const newSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings
        }
        setSettings(newSettings)
        setFooterLinks(parseFooterLinks(newSettings.footer_links))
      }
```

with:

```ts
      if (response.ok && data.settings) {
        const hasAny = Object.keys(data.settings).length > 0
        setHasSettings(hasAny)
        const newSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings
        }
        setSettings(newSettings)
        setFooterLinks(parseFooterLinks(newSettings.footer_links))
        localeOnLoadRef.current = newSettings.site_locale
      }
```

- [ ] **Step 5: Verify types and build succeed**

Run: `cd /path/to/nexibase && npm run lint`
Expected: No new errors mentioning `site_locale` or `localeOnLoadRef`.

Run: `cd /path/to/nexibase && npm run build`
Expected: Build succeeds. (Build is slow — 60-120s is normal.)

- [ ] **Step 6: Commit**

Run:
```bash
git -C /path/to/nexibase add src/app/\[locale\]/admin/settings/page.tsx
git -C /path/to/nexibase commit -m "feat(admin-settings): thread site_locale through settings state"
```

---

## Task 4: Reload page on locale change after save

**Files:**
- Modify: `src/app/[locale]/admin/settings/page.tsx`

- [ ] **Step 1: Update `handleSave` success branch to reload when locale changed**

Find `handleSave` (around line 207). Replace this block:

```ts
      if (response.ok) {
        alert(data.message)
        setHasSettings(true)
        setGaTestResult({ status: 'idle' })
      } else {
        alert(data.error || t('settingsSaveFailed'))
      }
```

with:

```ts
      if (response.ok) {
        alert(data.message)
        setHasSettings(true)
        setGaTestResult({ status: 'idle' })
        if (localeOnLoadRef.current !== null && settings.site_locale !== localeOnLoadRef.current) {
          window.location.reload()
          return
        }
      } else {
        alert(data.error || t('settingsSaveFailed'))
      }
```

Notes on the guard:
- `localeOnLoadRef.current !== null` — skip the comparison if the ref was never set (e.g., GET failed on mount). In that case there is no reliable "previous" value.
- `return` immediately after reload so `setSaving(false)` in the `finally` block does not flash a "not saving" state right before the navigation. (The `finally` still runs because `return` happens inside `try`.)

- [ ] **Step 2: Lint + build**

Run: `cd /path/to/nexibase && npm run lint && npm run build`
Expected: Both succeed with no new warnings.

- [ ] **Step 3: Commit**

Run:
```bash
git -C /path/to/nexibase add src/app/\[locale\]/admin/settings/page.tsx
git -C /path/to/nexibase commit -m "feat(admin-settings): reload page when site_locale changes on save"
```

---

## Task 5: Add the dropdown UI

**Files:**
- Modify: `src/app/[locale]/admin/settings/page.tsx`

- [ ] **Step 1: Add Select imports**

Find the existing import block near line 11 (`import { Separator } from "@/components/ui/separator"`). Directly below the existing shadcn ui imports, add:

```ts
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
```

Place it with the other `@/components/ui/*` imports (near the `Separator` import) — ordering is alphabetical by specifier path in this file's existing pattern, so after `Label` and before `Separator` is a reasonable slot; but any position within that cluster is acceptable as long as lint passes.

- [ ] **Step 2: Add `SUPPORTED_LOCALES` import and `LOCALE_LABELS` constant**

Add this import near the other imports (near the top of the file, below the React/lucide imports and above the `FooterLink` interface):

```ts
import { SUPPORTED_LOCALES } from "@/i18n/_generated-locales"
```

Then, directly **above** the `interface FooterLink` declaration (around line 30), add:

```ts
const LOCALE_LABELS: Record<string, string> = {
  ko: '한국어',
  en: 'English',
}
```

If `SUPPORTED_LOCALES` grows to include a locale not in this map, the dropdown falls back to the raw locale code — see Step 4 below.

- [ ] **Step 3: Insert the UI block**

Find the `site_name` input block inside the "Site basic settings" Card (around line 355-363):

```tsx
                <div className="grid gap-2">
                  <Label htmlFor="site_name">{t('siteName')}</Label>
                  <Input
                    id="site_name"
                    value={settings.site_name}
                    onChange={(e) => handleChange('site_name', e.target.value)}
                    placeholder="NexiBase"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_description">{t('siteDescription')}</Label>
```

Insert a new `<div className="grid gap-2">` block between them. The final result should be:

```tsx
                <div className="grid gap-2">
                  <Label htmlFor="site_name">{t('siteName')}</Label>
                  <Input
                    id="site_name"
                    value={settings.site_name}
                    onChange={(e) => handleChange('site_name', e.target.value)}
                    placeholder="NexiBase"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_locale">{t('siteLocale')}</Label>
                  <Select
                    value={settings.site_locale}
                    onValueChange={(value) => handleChange('site_locale', value)}
                  >
                    <SelectTrigger id="site_locale">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_LOCALES.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {LOCALE_LABELS[loc] ?? loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {t('siteLocaleDescription')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="site_description">{t('siteDescription')}</Label>
```

- [ ] **Step 4: Lint + build**

Run: `cd /path/to/nexibase && npm run lint && npm run build`
Expected: Both succeed. If `SUPPORTED_LOCALES` type is readonly, TypeScript should accept `.map` without complaint — the generator emits `as const`.

- [ ] **Step 5: Commit**

Run:
```bash
git -C /path/to/nexibase add src/app/\[locale\]/admin/settings/page.tsx
git -C /path/to/nexibase commit -m "feat(admin-settings): add site_locale dropdown to site basics"
```

---

## Task 6: Manual verification

**Files:** none

No automated test infrastructure exists in this repo. Verify in a running dev server.

- [ ] **Step 1: Start the dev server**

Run: `cd /path/to/nexibase && npm run dev`
Expected: Server listens on `http://localhost:3000` (or whatever port the repo uses — check terminal output). Leave the dev server running for the remaining steps. If port 3000 is taken by demo.nexibase.com, stop the demo container or run dev on a different port.

- [ ] **Step 2: Log in as admin and open `/admin/settings`**

Expected:
- The "Site basic settings" card shows a "Site language" (or "사이트 언어") label between the "Site name" input and the "Site description" textarea.
- The dropdown's current value matches the DB's `site_locale` value. Verify with:

```bash
docker exec <db-container> mysql -unexibase -pnexibase nexibase -e "SELECT value FROM settings WHERE \`key\`='site_locale'"
```

(or use `npx prisma studio`). Substitute `<db-container>` with the container name shown by `docker ps`.
- A helper paragraph appears below the dropdown with the description text.

- [ ] **Step 3: Scenario A — change locale**

- Change the dropdown to the other locale.
- Click "Save".
- Expected: success alert, then the page reloads automatically, and admin UI strings (sidebar labels, card titles) now render in the new language.

- [ ] **Step 4: Scenario B — save without locale change**

- Reload the page manually (to refresh `localeOnLoadRef`).
- Edit only `site_name`. Save.
- Expected: success alert, **no automatic reload**. The page stays on the same scroll position.

- [ ] **Step 5: Scenario C — change locale back**

- Change the dropdown back to the original value. Save.
- Expected: page reloads; admin returns to original language.

- [ ] **Step 6: Verify DB state**

Run:

```bash
docker exec <db-container> mysql -unexibase -pnexibase nexibase -e "SELECT value FROM settings WHERE \`key\`='site_locale'"
```

Substitute `<db-container>` with the container name shown by `docker ps`.
Expected: value matches the last saved dropdown value.

- [ ] **Step 7: Stop dev server**

`Ctrl-C` in the terminal running `npm run dev`.

If any scenario fails, DO NOT proceed to Task 7. Fix, amend the relevant commit (or add a fixup commit), and re-verify.

---

## Task 7: Push and open PR

**Files:** none

- [ ] **Step 1: Review the full diff once more**

Run: `git -C /path/to/nexibase diff origin/main...HEAD`
Expected: Changes span exactly three files: `src/app/[locale]/admin/settings/page.tsx`, `src/locales/ko.json`, `src/locales/en.json`. No stray edits.

- [ ] **Step 2: Push branch**

Run: `git -C /path/to/nexibase push -u origin feat/admin-site-locale`

- [ ] **Step 3: Create PR against `nexibase/nexibase:main`**

Run (from `/path/to/nexibase`):

```bash
gh pr create --title "feat(admin-settings): editable site language" --body "$(cat <<'EOF'
## Summary

- Adds a **Site language** dropdown to `/admin/settings` (Site basics card), editing the existing `site_locale` row in the `settings` table.
- Reloads the page automatically after save **only when** the persisted locale changed, so SSR strings refresh into the new language. Non-locale saves behave as before (no reload).
- Pure frontend change: no API, schema, routing, or middleware modifications. `POST /api/admin/settings` already accepts arbitrary keys; `src/i18n/request.ts` already reads `site_locale` on every request without caching.

## Test plan

- [ ] Dropdown pre-fills from DB `site_locale` on load.
- [ ] Changing the dropdown and saving reloads the page; admin + public strings render in the new language.
- [ ] Saving without a locale change does not trigger a reload.
- [ ] Editing while the dropdown is open does not lose other unsaved fields (save persists all fields before reloading).
- [ ] DB reflects the saved value (``SELECT value FROM settings WHERE `key`='site_locale'``).

Design doc: `docs/superpowers/specs/2026-04-20-admin-site-locale-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL in the final response.

---

## Self-review checklist

This plan's spec coverage:

- Spec §1.2 "drop-down below site_name" → Task 5 Step 3
- Spec §1.2 "site_locale in SettingsData + DEFAULT_SETTINGS" → Task 3 Steps 1-2
- Spec §1.2 "options from SUPPORTED_LOCALES + LOCALE_LABELS" → Task 5 Step 2 + Step 3
- Spec §1.2 "auto-reload when locale differs from load-time" → Task 3 Step 4 (ref) + Task 4 Step 1 (comparison + reload)
- Spec §1.2 "two i18n keys in admin namespace" → Task 2 Steps 1-2
- Spec §2.1 "no API change, no schema change" → enforced by file list in Task 7 Step 1
- Spec §4 manual verification checklist → Task 6 Steps 2-6
- Spec §6 "single PR against nexibase/nexibase main, branch feat/admin-site-locale" → Task 1 Step 3 + Task 7

No placeholders, no TBDs. Function/property names consistent throughout (`localeOnLoadRef`, `site_locale`, `LOCALE_LABELS`, `SUPPORTED_LOCALES`, `handleChange`).
