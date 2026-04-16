import type { SlotResult } from './slot-resolver'

const SYSTEM_PROMPT = `You are an expert at creating vibe-coding recipes that teach users how to build nexibase plugins and widgets.

Nexibase is an open-source community platform built with Next.js 15, Prisma, and TypeScript. It has a convention-based plugin system where each plugin lives in src/plugins/<name>/.

Users will follow your step-by-step prompts in AI coding tools (Claude Code, Cursor, Bolt, Lovable, etc.) to create working nexibase extensions from scratch.

You always respond with a single JSON object. No markdown, no explanation — just the JSON.`

const PLUGIN_ARCHITECTURE_CONTEXT = `## Nexibase Plugin Architecture

Each plugin is a folder in src/plugins/<name>/ with these conventions:
- plugin.ts: manifest with name, description, version, author, slug, defaultEnabled
- schema.prisma: Prisma models (merged into main schema at build time)
- routes/page.tsx: public pages at /[locale]/<slug>/
- routes/[param]/page.tsx: dynamic public pages
- admin/page.tsx: admin UI at /admin/<slug>
- admin/menus.ts: sidebar menu array [{label, icon, path}]
- admin/api/route.ts: admin CRUD API endpoints
- api/route.ts: public API endpoints
- components/: internal React components
- locales/en.json, locales/ko.json: i18n strings (keyed by slug)
- menus/footer.ts: footer menu entries

Key rules:
- Routes are Server Components by default; use "use client" only when needed
- Admin auth via getAdminUser() from @/lib/auth
- Prisma client via prisma from @/lib/prisma
- UI: shadcn/ui components + lucide-react icons + Tailwind CSS
- i18n: useTranslations() from next-intl (client) or getTranslations() (server)
- Plugin scan runs at dev/build time: npm run dev triggers scripts/scan-plugins.js`

const WIDGET_ARCHITECTURE_CONTEXT = `## Nexibase Widget Architecture

Widgets are plugin components that can be placed on any page via the admin widget editor.
- Widget files live in src/plugins/<name>/widgets/<WidgetName>.tsx
- Each widget is a React component that receives props from the widget config
- Widgets are registered via the plugin scan system automatically`

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

## Rules

1. Practical, visually verifiable result — users should think "I want this on my site!"
2. Use latest versions: Next.js 15, React 19, Prisma 6, TypeScript 5
3. Step 1 must start with creating src/plugins/{slug}/plugin.ts
4. Each step's prompt must be detailed enough to paste directly into an AI coding tool
5. Each step builds incrementally on the previous step's result
6. Bilingual: provide both English and Korean for all text fields
7. slug must be lowercase letters, digits, and hyphens only (e.g., "faq-manager", "weather-widget")

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
  "stepsEn": [{"step": 1, "prompt": "detailed prompt to paste into AI tool", "expected": "what this step produces"}],
  "stepsKo": [{"step": 1, "prompt": "detailed Korean prompt", "expected": "Korean expected result"}]
}`

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
- Single widget component + plugin.ts only
- No schema.prisma, no admin, no API
- Simple self-contained UI (clock, quotes, weather display, counters, etc.)
- 2-3 steps`
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
- Widget component in widgets/ directory
- menus/footer.ts for footer navigation
- External API integration OR complex data relationships
- Multiple public routes (list + detail pages)
- Rich admin UI with filters, stats, or batch operations
- 6-10 steps`
}
