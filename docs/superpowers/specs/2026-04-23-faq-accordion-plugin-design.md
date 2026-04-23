# FAQ Accordion Plugin — Design

**Date:** 2026-04-23
**Branch:** `feat/plugin-faq-accordion` (off `feat/github-stats-api`, the currently deployed branch)
**Scope:** Implement the `faq-accordion` recipe (full, including bonuses) as a self-contained plugin without touching core.

## 1. Goal

Build a self-service FAQ system as a standalone plugin at `src/plugins/faq-accordion/`. Admin can manage categories and FAQs with drag-to-reorder; public users browse a searchable, tabbed accordion with view tracking and helpful/not-helpful voting. No core files modified — the plugin scanner (`scripts/scan-plugins.js`) auto-wires routes, API, schema, and i18n.

## 2. Architecture

Plugin-local folder, zero core edits. The scanner generates wrappers under `src/app/`, merges the schema into `prisma/schema.prisma`, and merges locales into `src/messages/`.

```
src/plugins/faq-accordion/
├── plugin.ts                      # manifest (English — memory rule)
├── schema.prisma                  # Faq / FaqCategory
├── locales/
│   ├── en.json
│   └── ko.json
├── admin/
│   ├── menus.ts                   # sidebar item
│   ├── page.tsx                   # /[locale]/admin/faq-accordion
│   ├── components/
│   │   ├── FaqList.tsx            # tab 1 — DnD reorder
│   │   ├── CategoryList.tsx       # tab 2 — DnD reorder
│   │   ├── FaqDialog.tsx          # create/edit (MiniEditor)
│   │   └── CategoryDialog.tsx
│   └── api/route.ts               # /api/admin/faq-accordion
├── api/route.ts                   # /api/faq-accordion (public: view/vote)
├── routes/
│   ├── page.tsx                   # /[locale]/faq-accordion (server)
│   └── components/
│       ├── FaqAccordion.tsx       # client (search/filter/view/vote)
│       └── Accordion.tsx          # plugin-local accordion primitive
└── lib/sanitize.ts                # DOMPurify wrapper (server+client safe)
```

**Auto-generated (do not edit):**
- `src/app/[locale]/faq-accordion/page.tsx`
- `src/app/[locale]/admin/faq-accordion/page.tsx`
- `src/app/api/faq-accordion/route.ts`
- `src/app/api/admin/faq-accordion/route.ts`
- `src/plugins/_generated.ts`
- `prisma/schema.prisma`
- `src/messages/{en,ko}.json`

**Scanner trigger:** `npm run dev` or `node scripts/scan-plugins.js`.

**Slug** = `faq-accordion` → public URL `/{locale}/faq-accordion`.

## 3. Data Model (Prisma)

Follows project conventions: `Int` autoincrement IDs (matches boards/polls), `@@map` snake_case table names.

```prisma
model FaqCategory {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(100)
  slug      String   @unique @db.VarChar(100)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  faqs      Faq[]

  @@index([sortOrder])
  @@map("faq_categories")
}

model Faq {
  id          Int      @id @default(autoincrement())
  question    String   @db.VarChar(500)
  answer      String   @db.Text              // HTML from MiniEditor
  categoryId  Int
  sortOrder   Int      @default(0)
  views       Int      @default(0)
  helpful     Int      @default(0)
  notHelpful  Int      @default(0)
  published   Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  category    FaqCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@index([categoryId])
  @@index([views])
  @@index([published])
  @@map("faqs")
}
```

**Notes:**
- Field `sortOrder` (not `order` — SQL reserved word; matches project convention).
- Answer is HTML text; rendered with DOMPurify sanitize.
- `onDelete: Cascade` at DB level, but admin UI requires explicit `?force=true` confirmation before cascading category deletion.
- Migration name: `add_faq_accordion`.

## 4. API Endpoints

### 4.1 Public — `PATCH /api/faq-accordion`

Reads are done via direct Prisma calls in the server component; this endpoint handles only mutations from the public page.

| Body | Action | Response |
|---|---|---|
| `{ type: 'view', id }` | `faq.views += 1` | `{ views }` |
| `{ type: 'feedback', id, helpful: true }` | `faq.helpful += 1` | `{ helpful, notHelpful }` |
| `{ type: 'feedback', id, helpful: false }` | `faq.notHelpful += 1` | `{ helpful, notHelpful }` |

- Rejects if target FAQ is `published: false` → 404.
- No server-side dedup; duplicate-vote prevention lives in client localStorage.
- Rate limiting is out of scope (future PR if abuse observed).

### 4.2 Admin — `/api/admin/faq-accordion`

All methods gate on `getAdminUser()` → 401 if missing.

**GET**
- `?type=faqs` — all FAQs with category, ordered by `[category.sortOrder, faq.sortOrder]`
- `?type=categories` — all categories + `_count: { faqs }`

**POST**
- `{ type: 'faq', question, answer, categoryId, sortOrder?, published? }` → 201
- `{ type: 'category', name, slug? }` → 201
  - If `slug` omitted, auto-generate from `name` (lowercase, non-ASCII stripped). Empty result → fallback `category-<timestamp>`.
  - On unique conflict, append `-2`, `-3`, … and return final slug in response.

**PATCH**
- `{ type: 'faq', id, ...fields }` — allowed fields: `question | answer | categoryId | sortOrder | published`
- `{ type: 'category', id, ...fields }` — allowed: `name | slug | sortOrder`
- `{ type: 'reorder-faqs', items: [{id, sortOrder}] }` — bulk update in a transaction
- `{ type: 'reorder-categories', items: [{id, sortOrder}] }` — same

**DELETE**
- `?type=faq&id=<n>` → 204
- `?type=category&id=<n>` → 400 `{ error: 'has_faqs', faqCount }` if FAQs present; `?force=true` cascades → 204

**Validation:** Reject empty `question`/`answer` (after `stripHtml().trim()`) with 400.
**Error format:** `{ error: string, details?: any }` with matching HTTP status.

## 5. Admin UI

`admin/page.tsx` is a client component with a thin server wrapper enforcing `getAdminUser()`.

```
┌─ FAQ Management ─────────────────────────────────┐
│ [Tabs]  FAQs  |  Categories                      │
├──────────────────────────────────────────────────┤
│ [Category ▼ All]  [🔍 Search]       [+ Add FAQ] │
│ ┌ Card list (DnD) ────────────────────────────┐ │
│ │ ⋮⋮  Question text…                 [Billing] │ │
│ │     👁 42   ✏️ Edit  🗑 Delete   [Published] │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

**Components:**
- `FaqList.tsx` — `dnd-kit` (`DndContext` + `SortableContext` + `useSortable`); drag end → `PATCH type:'reorder-faqs'` bulk call.
- `CategoryList.tsx` — same pattern, displays `name / slug / count badge`.
- `FaqDialog.tsx` — shadcn `<Dialog>`; fields: Question `<Input>`, Answer `<MiniEditor>`, Category `<Select>`, Published `<Switch>`.
- `CategoryDialog.tsx` — fields: Name `<Input>`, Slug `<Input>` (auto if blank).

**Interactions:**
- Filter + search are client-side on the in-memory FAQ list (small dataset).
- Search matches `question` + `stripHtml(answer)`.
- Drag handle `⋮⋮` only — card clicks go to edit, not drag.
- Optimistic UI on reorder; revert on API failure + toast.
- Category delete: first 400 → confirm dialog "Delete N FAQs?" → retry with `?force=true`.
- Empty states: no categories → add-FAQ disabled with guidance banner.
- Loading: skeleton on initial fetch, spinner on dialog save.
- User feedback: native `alert()` / `confirm()` — matches existing project convention (see `src/plugins/polls/admin/page.tsx`; no toast library is installed).

**Admin menu** (`admin/menus.ts`):

```ts
export default [
  { label: 'FAQ Management', icon: 'MessageCircleQuestion', path: '/admin/faq-accordion' },
]
```

Icon is a string — scanner parses strings, not component references.

## 6. Public UI (`/[locale]/faq-accordion`)

### Server (`routes/page.tsx`)

1. Prisma fetch: categories + published FAQs with category join.
2. Most Viewed: `orderBy: { views: desc }, take: 3`.
3. Render `<FaqAccordion categories={…} faqs={…} topFaqs={…} />`.
4. `generateMetadata`: translated title/description.
5. Inject `FAQPage` JSON-LD structured data for SEO.

### Client (`components/FaqAccordion.tsx`)

```
┌─ Frequently Asked Questions ─────────────────────┐
│ [🔍 Search FAQs…]                                │
│                                                   │
│ 📊 Most Viewed  (shown only when All + empty search) │
│  1. Question 1            👁 152                 │
│  2. Question 2            👁  98                 │
│  3. Question 3            👁  87                 │
│                                                   │
│ [All (24)] [Billing (8)] [Technical (10)] …      │
│                                                   │
│ ▼ Question text                          👁 42   │
│   ─────────────────────────────────────────────   │
│   <answer HTML — DOMPurified>                     │
│   Was this helpful?  [👍 Yes]  [👎 No]          │
│ ─────────────────────────────────────────────    │
│ ▶ Other question                         👁 30   │
└───────────────────────────────────────────────────┘
```

**Interactions:**
- Category tabs: shadcn `<Tabs>` — "All" + one per category with count badge.
- Search: debounced 300ms; overrides tab filter when non-empty; matches `question` + `stripHtml(answer)`.
- Accordion: **plugin-local custom accordion** (shadcn `<Accordion>` not present in this project and no radix-accordion dep — a ~30-line React component under `routes/components/Accordion.tsx` keeps core untouched). Single-expand mode. `onValueChange` fires view ping `PATCH { type:'view', id }`. Response updates view count inline. Animation via Tailwind `transition-all` + `grid-rows-[0fr]`/`grid-rows-[1fr]` trick for height-auto animation.
- Voting: localStorage key `faq-voted:<id>`. If present, buttons disabled + "Thanks for your feedback!" shown. On vote: set localStorage, call API, update local counts.
- Most Viewed: rendered only when `selectedCategory === 'all' && searchQuery === ''`. Click scrolls to item + auto-expands (sets `expandedItem`).
- Empty states: search miss → `noResults` message; no FAQs at all → `empty` message with no search/tabs.
- Answer rendering: `dangerouslySetInnerHTML` + DOMPurify sanitize. Whitelist: `p, strong, em, u, s, a, br, ul, ol, li`. Links forced to `target="_blank" rel="noopener"`.

**JSON-LD structured data:**

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "...", "acceptedAnswer": { "@type": "Answer", "text": "<stripHtml(answer)>" } }
  ]
}
```

## 7. Sanitize Utility

`src/plugins/faq-accordion/lib/sanitize.ts` — small wrapper so plugin is self-contained.

```ts
import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = ['p', 'strong', 'em', 'u', 's', 'a', 'br', 'ul', 'ol', 'li']
const ALLOWED_ATTR = ['href', 'target', 'rel']

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS, ALLOWED_ATTR })
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}
```

**Dependency:** Before writing the util, grep `package.json` for `isomorphic-dompurify`. If absent, `npm install isomorphic-dompurify` (added to root `package.json`; there is no plugin-local `package.json` in this project). The new dependency line is the only root-level edit permitted — it is a lockfile-equivalent change, not a core source change.

## 8. i18n

Edit `src/plugins/faq-accordion/locales/{en,ko}.json` only (memory rule — never edit `src/messages/*`).

**Namespace:** `faqAccordion` (camelCase — hyphenated namespaces are awkward for `useTranslations()` access).

Key tree:

```
faqAccordion
├── title, search, noResults, mostViewed, views, helpful, yes, no,
│   thanksForFeedback, empty
└── admin
    ├── title
    ├── tabs { faqs, categories }
    ├── addFaq, editFaq, deleteFaq, addCategory
    ├── question, answer, category, published, draft, allCategories
    ├── save, cancel, delete
    ├── confirmDelete, categoryHasFaqs
    ├── categoryName, categorySlug
    ├── emptyFaqs, emptyCategories
    ├── reorderSuccess, reorderFailed
    └── slugTaken
```

Korean translates the same keys.

## 9. Verification

Automated test infrastructure is not used by peer plugins (boards, polls, contents have no unit tests), so this plugin matches that convention. Manual checks:

| Step | Check |
|---|---|
| Schema merge | `node scripts/scan-plugins.js` → `prisma/schema.prisma` contains `model Faq`, `model FaqCategory` |
| Migration | `npx prisma migrate dev --name add_faq_accordion` succeeds; `SHOW TABLES` shows `faqs`, `faq_categories` |
| Route generation | Wrappers present under `src/app/[locale]/faq-accordion/`, `src/app/[locale]/admin/faq-accordion/`, `src/app/api/(admin/)faq-accordion/` |
| Type check | `npx tsc --noEmit` clean |
| Lint | `npm run lint` clean |
| Build | `npm run build` succeeds |
| Manual QA | Admin: create category → create FAQ → drag-reorder → toggle published. Public: search → tab filter → expand (view ↑) → vote (dedup works). |

## 10. Edge Cases

| Case | Handling |
|---|---|
| No categories | Public page shows empty message; admin "Add FAQ" disabled until a category exists |
| Category with all FAQs unpublished | Tab hidden on public page (count 0 → skip) |
| Duplicate category slug | Auto-suffix `-2`, `-3`; response returns final slug |
| Non-ASCII slug source (e.g., Korean name) | Strip to ASCII; empty → fallback `category-<timestamp>` |
| Drag interrupted / refresh | Server is source of truth; optimistic UI reverts on failure (no localStorage) |
| Most Viewed after FAQ delete | Re-fetched on each page visit (server component); no cache to invalidate |
| Empty MiniEditor output `<p></p>` | `stripHtml().trim() === ''` → 400 |
| Question > 500 chars | DB constraint + form maxLength |
| Image `<img>` smuggled into answer | MiniEditor has no image extension; sanitize whitelist excludes `img` anyway |

## 11. Out of Scope

- Rate limiting on public view/vote endpoints
- User-authenticated voting (would require `FaqVote` table)
- Automated tests
- Import/export of FAQs
- Analytics dashboard for admin
- AI-generated FAQ suggestions

## 12. Build Sequence

1. Branch off `feat/github-stats-api` as `feat/plugin-faq-accordion`
2. `plugin.ts` + `schema.prisma` → run scanner → migrate
3. `locales/{en,ko}.json` + `admin/menus.ts`
4. Admin API (`admin/api/route.ts`)
5. Admin UI (`admin/page.tsx` + subcomponents + DnD)
6. Public API (`api/route.ts`)
7. Public page (`routes/page.tsx` + `FaqAccordion.tsx`)
8. `lib/sanitize.ts` + JSON-LD
9. Manual QA → commit → push to `origin` only (memory rule: no upstream push; nexibase.com is private, no PR workflow)
