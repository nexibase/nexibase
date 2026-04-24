import type { SlotResult } from './slot-resolver'

const SYSTEM_PROMPT = `You are an expert at creating vibe-coding recipes that teach users how to build nexibase plugins and widgets.

Nexibase is an open-source community platform built with Next.js 15, Prisma, and TypeScript. It has a convention-based plugin system where each plugin lives in src/plugins/<name>/.

Users will follow your step-by-step prompts in AI coding tools (Claude Code, Cursor, Bolt, Lovable, etc.) to create working nexibase extensions from scratch.

You always respond with a single JSON object. No markdown, no explanation — just the JSON.`

const PLUGIN_ARCHITECTURE_CONTEXT = `## Nexibase Plugin Architecture

Each plugin is a folder in src/plugins/<name>/ with these conventions:
- plugin.ts: manifest with name, description, version, author, slug, defaultEnabled
- schema.prisma: Prisma models (merged into main schema at build time). The \`User\` model is defined in the core schema with \`id Int @id @default(autoincrement())\` — so any FK field referencing User MUST be typed \`Int\` (e.g. \`userId Int\`, \`userId Int?\`), NEVER \`String\`. Using \`String\` for userId causes \`prisma validate\` to fail on relation type mismatch.
- schema.user.prisma (REQUIRED when schema.prisma has any \`User\` relation): lists the back-relation fields to merge onto the User model. Prisma's named \`@relation("Foo")\` fields must be declared on BOTH sides, so if schema.prisma has \`createdBy User @relation("AuctionCreator", ...)\`, then schema.user.prisma must contain \`auctionsCreated Auction[] @relation("AuctionCreator")\`. Without this file \`prisma generate\` fails on validation. Include ONLY the back-relation lines (no \`model User {}\` wrapper — the build merges them).
- withdrawal-policy.ts (REQUIRED): exports a default array declaring retain/anonymize/delete policy for any model that references User. Empty array \`export default []\` is valid when there are no User references. The build fails without this file. Follow the existing-plugin shape: \`{ model: 'X', policy: 'retain' | 'anonymize' | 'delete', field: 'userIdFieldName', reason: 'why' }\` (one entry per user-referencing field) — this is the shape the withdrawal runtime consumes. This file is parsed by a JS evaluator, so do NOT use TypeScript-only syntax like \`as const\` or type annotations — plain string literals only (\`policy: 'delete'\`, not \`policy: 'delete' as const\`).
- routes/page.tsx: public pages at /[locale]/<slug>/
- routes/[param]/page.tsx: dynamic public pages
- admin/page.tsx: admin UI at /admin/<slug>
- admin/menus.ts (REQUIRED if admin/ exists): sidebar menu \`export default [{label, icon, path}]\` — without this, the admin page is inaccessible from the sidebar. The \`icon\` value is a STRING matching a lucide-react icon name (e.g. \`icon: 'Gavel'\`), NOT a component import. The sidebar renderer looks up the icon by name; do not write \`import { Gavel } from 'lucide-react'\` and pass the component — that breaks the menu scan.
- admin/api/route.ts: admin CRUD API endpoints
- api/route.ts: public API endpoints
- components/: internal React components
- locales/en.json, locales/ko.json: i18n strings (keyed by slug)
- menus/footer.ts: footer menu entries
- widgets/<Name>.tsx + widgets/<Name>.meta.ts: widget pair (both files required)

Key rules:
- Routes are Server Components by default; use "use client" only when needed
- Server Components must NEVER \`fetch()\` their own plugin's API. Call the database directly with \`prisma.*\` instead. A server component fetching \`/api/<slug>/...\` from itself is an anti-pattern that round-trips through the network (slower) and requires a correct absolute URL, which is hard to get right: \`process.env.NEXT_PUBLIC_BASE_URL\` is NOT set in this project, and the default fallback \`http://localhost:3000\` fails because the dev server listens on a different port. Move the query to the page itself (server → DB) or — if the same data is already served via an API — duplicate the read (small Prisma call is cheaper than a synthetic HTTP round-trip). Client components may freely \`fetch('/api/<slug>/...')\` because the browser already knows the origin.
- Admin auth via \`getAdminUser()\` from \`@/lib/auth\` (returns null if the current user is not an admin)
- Logged-in-user auth (non-admin public APIs): use \`getServerSession(authOptions)\` from \`next-auth\`, where authOptions is imported from \`@/app/api/auth/[...nextauth]/route\`. There is NO \`@/lib/auth-options\` module — do not invent that import path.
- Prisma client: \`import { prisma } from '@/lib/prisma'\` — \`prisma\` is a NAMED export, not a default export. \`import prisma from '@/lib/prisma'\` is wrong and gives undefined at runtime.
- Session user id quirk: \`session.user.id\` is typed as \`string\` (next-auth augmentation in src/types/next-auth.d.ts), but the real \`User.id\` column is \`Int\`. Always convert with \`parseInt(session.user.id, 10)\` before using it in Prisma \`where\` / \`data\` / comparison against \`userId\` columns. Otherwise the query fails at runtime with a type mismatch.
- UI: shadcn/ui components + lucide-react icons + Tailwind CSS
  Available shadcn components: button, card, badge, input, label, tabs, textarea, dialog, popover, select, checkbox, switch, radio-group, separator, avatar. Use any of these freely.
- NO TOAST LIBRARY is installed — do NOT import useToast, toast, sonner, or \`@/hooks/use-toast\` (these do not exist in this project). For user feedback after form submission, use plain \`alert()\` or inline state-driven message divs. This is a deliberate project convention.
- i18n imports are module-split: \`useTranslations\` (client hook) is imported from \`'next-intl'\`, but \`getTranslations\` (server async) MUST be imported from \`'next-intl/server'\`. Writing \`import { getTranslations } from 'next-intl'\` in a Server Component compiles but throws at runtime because the server entry is a different module.
- Next 15+ dynamic route \`params\` and \`searchParams\` are Promises that must be awaited: \`{ params: Promise<{ locale: string }>, searchParams: Promise<{ q?: string }> }\`, then \`const { locale } = await params; const { q } = await searchParams\`. Declaring them as plain objects (\`params: { locale: string }\`) type-checks loosely but at runtime \`params.locale\` is \`undefined\` because the actual value is still wrapped in a Promise.
- Every file you write MUST declare at the top every \`import\` it needs. Do not use a React component (Card, Badge, Button, icons, etc.) without importing it in the same file — the code block is what actually gets pasted, so a "using Card below" mention in prose is not enough. Include every shadcn/ui, lucide-react, next/*, prisma import the file's body references.

API route URL mapping (IMPORTANT — do not guess):
- \`src/plugins/<slug>/api/foo/route.ts\` is served at \`/api/<slug>/foo\` (NO locale prefix, NO plugin-slug in path twice)
- \`src/plugins/<slug>/admin/api/route.ts\` is served at \`/api/admin/<slug>\`
- Public pages \`src/plugins/<slug>/routes/page.tsx\` are at \`/[locale]/<slug>/\` (locale prefix present)
- Therefore a client component fetching its own plugin's API should call \`fetch('/api/<slug>/foo')\` — NOT \`fetch('/\${locale}/<slug>/api/foo')\` which does not exist

- Plugin scan runs at dev/build time: npm run dev triggers scripts/scan-plugins.js`

const WIDGET_ARCHITECTURE_CONTEXT = `## Nexibase Widget Architecture

Widgets are plugin components placed on any page via the admin widget editor. Every widget is a PAIR of files in src/plugins/<name>/widgets/:

1. <WidgetName>.tsx — the React component
2. <WidgetName>.meta.ts — the registry entry (REQUIRED, not optional)

If you omit .meta.ts, the plugin scan cannot register the widget and it will not appear in the admin widget editor.

.meta.ts MUST export a default object with this exact shape:

\`\`\`ts
export default {
  title: 'Human Readable Title',
  defaultZone: 'right', // 'left' | 'right' | 'header' | 'footer' | 'main'
  defaultColSpan: 4,
  defaultRowSpan: 1,
  settingsSchema: { /* default values keyed by setting name */ },
}
\`\`\`

The widget component signature MUST be \`({ settings }: { settings?: {...} })\`. Individual props (e.g. \`{ city, apiKey }\`) are NOT supported — the renderer always passes a single \`settings\` object. Inside the component, destructure from settings with fallbacks:

\`\`\`tsx
const city = settings?.city ?? 'Seoul'
\`\`\`

Plugin scan runs at dev/build time (npm run dev triggers scripts/scan-plugins.js) and reads both files to register the widget.`

const WIDGET_REFERENCE_EXAMPLE = `## Reference Example

Below is the real WeatherWidget from src/plugins/weather-widget/. Use it ONLY as a structural anchor — do NOT copy its domain (weather). Follow the same file pair, prop signature, and settingsSchema pattern for whatever widget you are generating.

Notice both files are shown as complete fenced code blocks with a path comment on the first line — your generated steps MUST follow the same format (see the Code Block Requirement section).

### widgets/WeatherWidget.meta.ts

\`\`\`ts
// src/plugins/weather-widget/widgets/WeatherWidget.meta.ts
export default {
  title: 'Weather Widget',
  defaultZone: 'right',
  defaultColSpan: 4,
  defaultRowSpan: 1,
  settingsSchema: { city: 'Seoul', apiKey: '' },
}
\`\`\`

### widgets/WeatherWidget.tsx (first 25 lines — signature and destructuring pattern)

\`\`\`tsx
// src/plugins/weather-widget/widgets/WeatherWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

interface WeatherWidgetProps {
  settings?: {
    city?: string;
    apiKey?: string;
  };
}

export default function WeatherWidget({ settings }: WeatherWidgetProps) {
  const city = settings?.city || 'Seoul';
  const apiKey = settings?.apiKey || process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY;
  // ... component body ...
}
\`\`\``

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT
}

export function buildUserPrompt(
  slot: SlotResult,
  existingRecipes: { titleEn: string; slug: string }[],
  topic?: string
): string {
  const difficultyGuide = getDifficultyGuide(slot.difficulty, slot.type)

  let prompt = `Generate 1 vibe-coding recipe for building a nexibase ${slot.type.replace(/_/g, ' ')}.${topic ? `\n\n## Requested Topic\n\nThe recipe MUST be about: ${topic}` : ''}

${PLUGIN_ARCHITECTURE_CONTEXT}

${slot.type !== 'plugin' ? WIDGET_ARCHITECTURE_CONTEXT : ''}

${slot.type !== 'plugin' ? WIDGET_REFERENCE_EXAMPLE : ''}

## Rules

1. Practical, visually verifiable result — users should think "I want this on my site!"
2. Use latest versions: Next.js 15, React 19, Prisma 6, TypeScript 5
3. Step 1 must start with creating src/plugins/{slug}/plugin.ts
4. Each step's prompt must be detailed enough to paste directly into an AI coding tool
5. Each step builds incrementally on the previous step's result
6. Bilingual: provide both English and Korean for all text fields
7. slug must be lowercase letters, digits, and hyphens only (e.g., "faq-manager", "weather-widget")
8. **Recipe must be SELF-CONTAINED.** Every file referenced by the recipe — every \`import\` path, every \`fetch('/api/<slug>/...')\` URL, every child component rendered by an admin/page.tsx — MUST have its own step that creates that file. Do NOT write "we'll create this in the next step" if you are already near the step limit and cannot fit another step. Prefer to inline small files (a tiny stats API route, locale JSON, admin sub-components) into the final step as an additional code block rather than omitting them. A recipe that builds but crashes at runtime because a fetched endpoint returns HTML 404 is worse than a recipe with one fewer feature.
9. **User display name field is \`nickname\`, not \`name\`.** The core User model in this project has \`nickname String @unique\` (no \`name\` column). When selecting user fields for display: \`select: { nickname: true, email: true }\`. Accessing \`user.name\` at runtime returns undefined and often crashes the page.

## Code Block Requirement (CRITICAL)

Every step's \`prompt\` field MUST contain at least one fenced code block. The prompt is rendered as Markdown to the reader, so combine:

1. A short leading sentence naming the step and target file.
2. At least one fenced code block (\`\`\`ts, \`\`\`tsx, \`\`\`prisma, \`\`\`json, etc.) whose FIRST LINE is a comment identifying the target path, e.g.:
   \`// src/plugins/<slug>/widgets/<Name>.meta.ts\`
3. The code block MUST contain the complete file contents — not an outline. Don't abbreviate a component body with \`// ...\` unless the remaining work is trivial and unambiguous.

Do NOT describe field lists, component props, or API shapes in prose when a code block can show them directly.

BAD (prose):
> "Create the Prisma schema with model StockCache having fields id (Int, autoincrement), symbol (String, indexed), price (Decimal), lastUpdated (DateTime, default now)..."

GOOD (fenced code):
\`\`\`prisma
// src/plugins/stock-ticker/schema.prisma
model StockCache {
  id          Int      @id @default(autoincrement())
  symbol      String   @db.VarChar(20)
  price       Decimal  @db.Decimal(12, 4)
  lastUpdated DateTime @default(now())

  @@index([symbol])
}
\`\`\`

Since the prompt is stored inside JSON, the triple-backtick fences must be written as literal \`\`\` characters (JSON-escape newlines as \\n as usual).

## Difficulty: ${slot.difficulty}

${difficultyGuide}

## Title Diversity (IMPORTANT)

Do NOT repeat title patterns like "Build your own...". Rotate through:
- Verb-style: "Creating a live poll widget", "Crafting an image gallery plugin"
- Service-name: "Mini FAQ Manager", "Pocket Link Collector"
- Descriptive: "Real-time visitor counter widget", "Multi-language content plugin"
- Fun: "Widget Wonderland: A weather dashboard", "Plugin Power: Smart bookmarks"
- Audience: "For bloggers: a related posts widget", "For shops: product showcase plugin"

## Output JSON Schema

Respond with exactly this JSON structure (no wrapping, no markdown):

{
  "slug": "string (lowercase+hyphens, unique plugin/widget name)",
  "titleEn": "string (compelling English title)",
  "titleKo": "string (compelling Korean title)",
  "descriptionEn": "string (markdown, 300+ chars, what to build + required features + bonus features)",
  "descriptionKo": "string (markdown, 300+ chars, Korean version)",
  "difficulty": "${slot.difficulty}",
  "type": "${slot.type}",
  "constraintsEn": ["string array of constraints"],
  "constraintsKo": ["string array of constraints in Korean"],
  "stepsEn": [{"step": 1, "prompt": "Markdown prompt with at least one fenced code block — see 'Code Block Requirement' above", "expected": "what this step produces"}],
  "stepsKo": [{"step": 1, "prompt": "코드 블록을 포함한 Markdown 프롬프트", "expected": "Korean expected result"}]
}

Example of a well-formed step (just illustrative shape, not for copying):

\`\`\`json
{
  "step": 2,
  "prompt": "Define the Prisma schema at \`src/plugins/<slug>/schema.prisma\`:\\n\\n\`\`\`prisma\\n// src/plugins/<slug>/schema.prisma\\nmodel Foo {\\n  id Int @id @default(autoincrement())\\n  name String\\n}\\n\`\`\`\\n\\nAfter adding, the plugin scan will merge this into the root schema.",
  "expected": "schema.prisma file created with the Foo model."
}
\`\`\``

  if (existingRecipes.length > 0) {
    prompt += '\n\n## Already Generated (DO NOT duplicate titles, slugs, or similar topics):\n'
    for (const r of existingRecipes) {
      prompt += `- ${r.titleEn} (${r.slug})\n`
    }
  }

  return prompt
}

function getDifficultyGuide(
  difficulty: SlotResult['difficulty'],
  type: SlotResult['type']
): string {
  if (difficulty === 'beginner' && type === 'widget') {
    return `Beginner Widget:
- Three files total: plugin.ts + widgets/<Name>.tsx + widgets/<Name>.meta.ts
- No schema.prisma, no admin, no API
- Simple self-contained UI (clock, quotes, counters, etc.)
- 3 steps — one per file, in this order:
  1. plugin.ts
  2. widgets/<Name>.tsx (component with { settings } prop)
  3. widgets/<Name>.meta.ts (registry entry with settingsSchema defaults)
- Widget component MUST accept { settings } prop, never individual props
- .meta.ts settingsSchema MUST define a default value for every configurable field referenced in the component`
  }

  if (difficulty === 'beginner') {
    return `Beginner Plugin:
- plugin.ts + routes/page.tsx + 1-2 simple components
- No schema.prisma (no database)
- No admin page
- Simple static or client-side interactive page
- 2-3 steps`
  }

  if (difficulty === 'intermediate') {
    return `Intermediate Plugin:
- plugin.ts + schema.prisma + routes/ + admin/page.tsx + admin/api/route.ts
- Full CRUD with Prisma models
- Admin management UI with list/create/delete
- Public page displaying data from DB
- locales/en.json + locales/ko.json for i18n
- 4-6 steps`
  }

  return `Advanced Plugin + Widget:
- Everything from intermediate PLUS:
- Widget PAIR in widgets/: <Name>.tsx + <Name>.meta.ts (both files required)
- Widget component accepts { settings } prop, never individual props
- menus/footer.ts for footer navigation
- External API integration OR complex data relationships
- Multiple public routes (list + detail pages)
- Rich admin UI with filters, stats, or batch operations
- 6-10 steps`
}
