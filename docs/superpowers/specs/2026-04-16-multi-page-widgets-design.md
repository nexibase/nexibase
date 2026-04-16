# Multi-Page Widget System — Design Spec

**Date:** 2026-04-16
**Branch:** `feat/multi-page-widgets`
**Summary:** Replace the home-only widget system with a full page builder. Admins can create custom pages with arbitrary URLs, choose layout templates, place both registry (code) and content (admin-authored) widgets, and manage everything through a visual drag-and-drop editor with live preview.

## 1. Goals

- Unify widget management: Home becomes the first "page" in a unified system, not a special case.
- Let admins create custom pages (about, landing, promo, etc.) without code changes.
- Provide 6 content widget types so admins can author rich content directly.
- Visual editor with drag-and-drop and split-view settings panel.
- Preserve all existing home widget data through migration.
- SEO metadata per page (title, description, OG, noindex/nofollow, canonical).

## 2. Non-Goals

- Inline editing (Gutenberg/Notion style) — widgets render read-only in the editor; settings are edited in the side panel.
- Content widget sharing across pages — each page owns its widget instances independently.
- Draft/publish workflow — pages have a simple isActive on/off toggle.
- Scheduling or timed publish.
- Nested/child pages or page hierarchy.

## 3. Data Model

### 3.1 WidgetPage (new)

```prisma
model WidgetPage {
  id              Int          @id @default(autoincrement())
  title           String       @db.VarChar(200)
  slug            String       @unique @db.VarChar(200)   // "" = home, "about", "promo/summer"
  layoutTemplate  String       @default("full-width") @db.VarChar(30)  // "full-width" | "with-sidebar" | "minimal"
  isActive        Boolean      @default(true)
  sortOrder       Int          @default(0)

  // SEO
  seoTitle        String?      @db.VarChar(200)
  seoDescription  String?      @db.VarChar(500)
  seoOgImage      String?      @db.VarChar(500)
  seoOgTitle      String?      @db.VarChar(200)
  seoOgDescription String?     @db.VarChar(500)
  seoCanonical    String?      @db.VarChar(500)
  seoNoIndex      Boolean      @default(false)
  seoNoFollow     Boolean      @default(false)

  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  widgets         PageWidget[]

  @@index([slug])
  @@index([isActive])
  @@map("widget_pages")
}
```

### 3.2 PageWidget (replaces HomeWidget)

```prisma
model PageWidget {
  id         Int         @id @default(autoincrement())
  pageId     Int
  widgetKey  String      @db.VarChar(50)    // registry: "site-stats"; content: "rich-text"
  widgetType String      @default("registry") @db.VarChar(20)  // "registry" | "content"
  zone       String      @db.VarChar(20)
  title      String      @db.VarChar(100)
  settings   String?     @db.Text           // JSON
  colSpan    Int         @default(1)
  rowSpan    Int         @default(1)
  isActive   Boolean     @default(true)
  sortOrder  Int         @default(0)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt

  page       WidgetPage  @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@index([pageId, zone, sortOrder])
  @@map("page_widgets")
}
```

Key changes from `HomeWidget`:
- Added `pageId` FK to `WidgetPage` (cascade delete — deleting a page removes its widgets).
- Added `widgetType` field: `"registry"` for code widgets looked up in `widgetRegistry`, `"content"` for admin-authored widgets rendered by content renderers.
- Removed `@unique` on `widgetKey` — the same key (e.g., `latest-posts`) can appear on multiple pages.
- Table renamed from `home_widgets` to `page_widgets`.

### 3.3 Layout Templates

Each template defines which zones are available:

| Template | Zones | Use case |
|---|---|---|
| `full-width` | `top`, `main`, `bottom` | Landing pages, about, promo |
| `with-sidebar` | `top`, `left`, `center`, `right`, `bottom` | Home, community hubs |
| `minimal` | `main` | Simple content pages, notices |

Templates are defined as a TypeScript constant (not DB), consumed by both admin UI (zone rendering) and public renderer (layout structure). Adding a new template requires a code change (intentional — templates define rendering structure).

```ts
// src/lib/widgets/layout-templates.ts
export const LAYOUT_TEMPLATES = {
  'full-width': {
    label: 'Full Width',
    zones: ['top', 'main', 'bottom'],
  },
  'with-sidebar': {
    label: 'With Sidebar',
    zones: ['top', 'left', 'center', 'right', 'bottom'],
  },
  'minimal': {
    label: 'Minimal',
    zones: ['main'],
  },
} as const
```

## 4. Content Widgets (6 types)

Content widgets use `widgetType: "content"` and store all data in the `settings` JSON field. Each has a dedicated renderer component and a dedicated admin editor component.

### 4.1 Rich Text (`rich-text`)

**Settings:** `{ html: string }`
**Renderer:** Renders sanitized HTML output.
**Editor:** TipTap WYSIWYG editor (reuse existing TipTap setup from the boards post editor). Supports headings, bold/italic/underline, links, images (via existing `/api/tiptap-image-upload`), lists.

### 4.2 Image Banner (`image-banner`)

**Settings:** `{ src: string, alt: string, href?: string, height?: number }`
**Renderer:** `<img>` wrapped in optional `<a>` link. Responsive, `object-cover`.
**Editor:** Image upload button (reuse `/api/tiptap-image-upload`), alt text input, optional link URL, optional height.

### 4.3 HTML Embed (`html-embed`)

**Settings:** `{ code: string }`
**Renderer:** `dangerouslySetInnerHTML`. Only admins can create these, so XSS risk is accepted.
**Editor:** Code textarea with monospace font. Preview toggle.

### 4.4 Button / CTA (`button-cta`)

**Settings:** `{ text: string, href: string, variant?: "default"|"outline"|"destructive", size?: "sm"|"default"|"lg", align?: "left"|"center"|"right" }`
**Renderer:** shadcn `<Button>` inside `<a>`, wrapped in alignment div.
**Editor:** Text input, URL input, variant/size/align selects.

### 4.5 Spacer (`spacer`)

**Settings:** `{ height: number }`
**Renderer:** Empty `<div>` with the specified height. Default 40px.
**Editor:** Number input for pixel height.

### 4.6 Video Embed (`video-embed`)

**Settings:** `{ url: string, aspectRatio?: "16:9"|"4:3" }`
**Renderer:** Parse YouTube/Vimeo URL → extract embed ID → render responsive `<iframe>` in aspect-ratio container.
**Editor:** URL input, aspect ratio select. Preview of parsed embed.

## 5. Visual Preview Editor (Split View)

### 5.1 Layout

The page editor screen (`/admin/pages/[id]`) uses a split-view layout:

- **Top toolbar:** Back button, page title + slug + template badge, "Preview ↗" (opens public URL in new tab), "Save Layout" button.
- **Left panel (flex:3):** Live preview showing zones according to the page's layout template. Each zone is a dashed-border droppable area containing widget cards. Widgets are draggable within and between zones using `@dnd-kit`.
- **Right panel (flex:1.2):** Settings panel for the currently selected widget. Switches content based on widget type.

### 5.2 Widget Cards in Preview

Each widget appears as a card showing:
- Widget title
- Type badge (`registry` or `content`)
- Column span indicator
- Drag handle (⋮⋮)
- Selected state (highlighted border)

Clicking a card selects it and populates the right settings panel.

### 5.3 Settings Panel

For **registry widgets**: dynamic form generated from `settingsSchema` (existing pattern) + zone select + colSpan/rowSpan + isActive toggle + Remove/Duplicate buttons.

For **content widgets**: type-specific editor UI:
- `rich-text` → TipTap editor
- `image-banner` → image upload + fields
- `html-embed` → code textarea
- `button-cta` → text/href/variant/size/align fields
- `spacer` → height input
- `video-embed` → URL input + aspect ratio

### 5.4 Adding Widgets

Two "Add" buttons at the bottom of the preview:
- **"+ Add Registry Widget"** → modal/dropdown listing available registry widgets from `widgetRegistry` (filtered to exclude disabled plugins). Clicking one creates a new `PageWidget` in the selected zone.
- **"+ Add Content Widget"** → modal/dropdown listing the 6 content types. Clicking one creates a new `PageWidget` with `widgetType: "content"` and default settings.

### 5.5 Drag and Drop

Using `@dnd-kit` (already installed in the repo):
- `DndContext` wraps the entire preview area.
- Each zone is a `useDroppable` target.
- Each widget card is a `useDraggable` + `useSortable` item.
- Dragging a widget to a different zone updates its `zone` field.
- Dropping within the same zone reorders by `sortOrder`.
- State is local until "Save Layout" is clicked → bulk PUT to the API.

### 5.6 Save

"Save Layout" sends a single bulk PUT request with the full widget layout (all zones, all widgets with their current positions, settings, and states). This matches the existing `/api/admin/home-widgets/layout` pattern.

## 6. Public Rendering

### 6.1 URL Routing

Custom pages are served at `/<slug>`:
- `/` → Home (slug: `""`)
- `/about` → WidgetPage with slug `"about"`
- `/promo/summer` → WidgetPage with slug `"promo/summer"`

Implementation: a Next.js catch-all route at `src/app/[locale]/[...slug]/page.tsx` that:
1. Joins the slug segments into a string.
2. Looks up `WidgetPage` by slug (where `isActive: true`).
3. If not found, falls through to Next.js 404.
4. If found, renders using the page's layout template.

The home page (`src/app/[locale]/page.tsx`) queries `WidgetPage` with `slug: ""` and uses the same rendering pipeline.

### 6.2 Reserved Slug Validation

When saving a page, the slug is validated against:
- Plugin slugs from `pluginManifest` (`boards`, `shop`, `contents`, `policies`, etc.)
- System routes: `admin`, `login`, `signup`, `mypage`, `api`, `install`, `setup-required`, `verify-email`, `profile`, `search`, `new`
- Existing page slugs (uniqueness)

Validation happens server-side in the admin API. The admin UI also shows a client-side warning.

### 6.3 Rendering Pipeline

```
URL hit → WidgetPage lookup → layout template → zones
  → for each zone: fetch PageWidgets (sorted by sortOrder, filtered by isActive)
    → for each widget:
      if widgetType === "registry" → look up component in widgetRegistry → render with parsed settings
      if widgetType === "content" → look up content renderer by widgetKey → render with parsed settings
```

The existing `WidgetRenderer` component is extended to handle `widgetType: "content"` in addition to `"registry"`.

### 6.4 SEO Metadata

Each `WidgetPage` has SEO fields. The catch-all route exports `generateMetadata` that reads the page's SEO fields:

```ts
export async function generateMetadata({ params }) {
  const page = await getWidgetPage(slug)
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription,
    openGraph: {
      title: page.seoOgTitle || page.seoTitle || page.title,
      description: page.seoOgDescription || page.seoDescription,
      images: page.seoOgImage ? [page.seoOgImage] : undefined,
    },
    robots: {
      index: !page.seoNoIndex,
      follow: !page.seoNoFollow,
    },
    alternates: page.seoCanonical ? { canonical: page.seoCanonical } : undefined,
  }
}
```

### 6.5 Sidebar Behavior on Non-Page Routes

Plugin pages (`/boards`, `/shop`, etc.) and system routes (`/login`, `/mypage`) do not have a `WidgetPage` entry. For these, sidebar rendering falls back to the **Home page's sidebar widgets** (left/right zones from `WidgetPage(slug: "")`). This preserves backward compatibility — currently sidebar widgets are global, and after migration they belong to Home, but still render everywhere.

For pages that DO have a `WidgetPage`, the sidebar zones come from that page's own widgets. If the page uses `full-width` or `minimal` template (no sidebar zones), no sidebar is rendered.

Summary:
- `WidgetPage` exists for this URL → use that page's widgets and layout template
- No `WidgetPage` → fall back to Home page's sidebar widgets (backward compat with current behavior)

### 6.6 Existing API Compatibility

- `GET /api/home-widgets` is kept as a thin wrapper that fetches the Home page's widgets and returns them in the same format. This avoids breaking `SiteContext` and `UserLayout` sidebar rendering until they are migrated.
- New API: `GET /api/pages/[slug]/widgets` — returns widgets for any page.

## 7. Admin Pages

### 7.1 Sidebar Menu

Replace "Home widgets" with "Pages" in the admin sidebar. The menu item points to `/admin/pages`.

### 7.2 Page List (`/admin/pages`)

Client component. Table with columns:
- Title (Home has a 🏠 icon, undeletable)
- URL (`/`, `/about`, etc.)
- Layout Template
- Widget Count
- Active (toggle)
- Actions (Edit, Delete)

"+ New Page" button opens a creation modal with: Title, Slug, Layout Template select.

### 7.3 Page Editor (`/admin/pages/[id]`)

The split-view visual editor described in section 5.

### 7.4 Page Settings

Accessible from the editor toolbar (gear icon or a "Settings" tab). Contains:
- Title, Slug (with reserved-word validation)
- Layout Template select (changing template may orphan widgets in zones that no longer exist — warn the user)
- SEO fields: title, description, OG image, OG title, OG description, canonical URL, noindex checkbox, nofollow checkbox
- isActive toggle
- Delete button (with confirmation, Home page undeletable)

### 7.5 Removal of `/admin/home-widgets`

The old admin page is removed. A redirect from `/admin/home-widgets` to `/admin/pages` is added for bookmarks.

## 8. Admin API Routes

All under `/api/admin/pages/...`, protected by `getSession()` + `role === 'admin'`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/pages` | List all pages |
| POST | `/api/admin/pages` | Create a page |
| GET | `/api/admin/pages/[id]` | Get page + widgets |
| PUT | `/api/admin/pages/[id]` | Update page metadata (title, slug, template, SEO, isActive) |
| DELETE | `/api/admin/pages/[id]` | Delete page (reject if Home) |
| PUT | `/api/admin/pages/[id]/layout` | Bulk save widget layout (create/update/delete widgets) |
| POST | `/api/admin/pages/[id]/widgets` | Add a single widget |
| DELETE | `/api/admin/pages/[id]/widgets/[widgetId]` | Remove a single widget |

## 9. Migration Strategy

### 9.1 Schema Migration Steps

1. Create `widget_pages` table.
2. Create `page_widgets` table with same columns as `home_widgets` plus `pageId` and `widgetType`.
3. Insert Home WidgetPage: `{ title: "Home", slug: "", layoutTemplate: "with-sidebar", isActive: true }`.
4. Copy all rows from `home_widgets` into `page_widgets`, setting `pageId` to the Home page ID and `widgetType` to `"registry"`.
5. Drop `home_widgets` table.

### 9.2 Code Migration Steps

1. Update all imports from `HomeWidget` to `PageWidget`.
2. Replace `/api/home-widgets` internals to read from `PageWidget` + `WidgetPage(slug: "")`.
3. Keep the old API path working (returns Home page widgets) for backwards compatibility with `SiteContext`.
4. Replace admin route `/admin/home-widgets` → `/admin/pages`.
5. Update `WidgetRenderer` to handle `widgetType: "content"`.

### 9.3 Rollback Safety

The migration is destructive (drops `home_widgets`). Before running:
- The migration SQL should copy data first, then drop. If the copy fails, the old table remains.
- A manual backup of `home_widgets` before deploying is recommended.

## 10. Content Widget Renderers

Content renderers are simple React components at `src/lib/widgets/content-renderers/`:

```
src/lib/widgets/content-renderers/
├── index.ts                    # registry: widgetKey → component mapping
├── RichTextRenderer.tsx
├── ImageBannerRenderer.tsx
├── HtmlEmbedRenderer.tsx
├── ButtonCtaRenderer.tsx
├── SpacerRenderer.tsx
└── VideoEmbedRenderer.tsx
```

Each renderer receives `{ settings: Record<string, any> }` — same interface as registry widgets.

The content renderer registry is a simple map:

```ts
export const contentRenderers: Record<string, React.ComponentType<{ settings?: Record<string, any> }>> = {
  'rich-text': RichTextRenderer,
  'image-banner': ImageBannerRenderer,
  'html-embed': HtmlEmbedRenderer,
  'button-cta': ButtonCtaRenderer,
  'spacer': SpacerRenderer,
  'video-embed': VideoEmbedRenderer,
}
```

## 11. Content Widget Admin Editors

Admin editors for content widgets live at `src/components/admin/widget-editors/`:

```
src/components/admin/widget-editors/
├── index.ts                    # registry: widgetKey → editor component mapping
├── RichTextEditor.tsx          # TipTap WYSIWYG
├── ImageBannerEditor.tsx       # Upload + fields
├── HtmlEmbedEditor.tsx         # Code textarea + preview
├── ButtonCtaEditor.tsx         # Text/href/variant/size/align
├── SpacerEditor.tsx            # Height input
└── VideoEmbedEditor.tsx        # URL + aspect ratio + preview
```

Each editor receives `{ settings: Record<string, any>, onChange: (settings: Record<string, any>) => void }`. Changes are held in local state until "Save Layout" is clicked.

## 12. Manual Verification Checklist

**Migration:**
- [ ] Existing home widgets appear under the "Home" page in `/admin/pages`
- [ ] Home page renders identically to before the migration
- [ ] `GET /api/home-widgets` still returns the same data (backwards compat)
- [ ] Sidebar widgets (left/right) still render on all pages

**Page CRUD:**
- [ ] Create a new page with slug `/about`, template "full-width"
- [ ] Page appears in the list with correct URL
- [ ] Visit `/about` — renders empty page with correct template structure
- [ ] Toggle page off — `/about` returns 404
- [ ] Delete page — removed from list
- [ ] Attempt to create page with slug `admin` — rejected (reserved)
- [ ] Attempt to create page with slug `boards` — rejected (plugin slug)
- [ ] Home page cannot be deleted

**Visual Editor:**
- [ ] Open Home page editor — existing widgets appear in correct zones
- [ ] Drag a widget from center to top zone — zone changes
- [ ] Drag to reorder within a zone — sort order changes
- [ ] Click a widget — right panel shows settings
- [ ] Edit a registry widget's settings — change persists after Save Layout
- [ ] Add a registry widget from the list — appears in selected zone
- [ ] Remove a widget — disappears from preview
- [ ] Duplicate a widget — copy appears below original
- [ ] Save Layout — reload page, layout persists

**Content Widgets:**
- [ ] Add Rich Text widget — TipTap editor in settings panel, saves HTML
- [ ] Add Image Banner — upload image, set alt/link, renders on public page
- [ ] Add HTML Embed — paste HTML code, renders on public page
- [ ] Add Button CTA — set text/href/variant, renders as shadcn Button link
- [ ] Add Spacer — set height, renders as blank space
- [ ] Add Video Embed — paste YouTube URL, renders responsive iframe

**SEO:**
- [ ] Set page seoTitle/seoDescription — inspect `<head>` on public page
- [ ] Set seoOgImage — check Open Graph meta tags
- [ ] Set noIndex — check robots meta tag
- [ ] Set canonical URL — check `<link rel="canonical">`

**Layout Templates:**
- [ ] Full Width page: only top/main/bottom zones shown in editor
- [ ] With Sidebar page: top/left/center/right/bottom zones shown
- [ ] Minimal page: only main zone shown
- [ ] Change template on existing page — warns about orphaned widgets

**Build:**
- [ ] `npm run build` succeeds
- [ ] `npx tsc --noEmit` — no new errors
- [ ] Prisma migration applied cleanly

## 13. Future Work (Not in this spec)

- Inline editing (click widget content in preview to edit directly)
- Content widget library (shared widgets across pages)
- Draft/publish workflow with preview URLs
- Scheduled publish/unpublish
- Page duplication
- Page hierarchy / nested pages
- Custom layout template creation from admin UI
- Widget access control (some widgets visible only to logged-in users)
