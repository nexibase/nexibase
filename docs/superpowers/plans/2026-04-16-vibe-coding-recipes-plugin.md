# Vibe Coding Recipes Plugin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a nexibase plugin that auto-generates bilingual (en/ko) vibe-coding recipes for nexibase plugin/widget development using Claude AI on a cron schedule.

**Architecture:** Convention-based nexibase plugin at `src/plugins/vibe-coding-recipes/`. Cron-driven generation via standalone TypeScript script (no HTTP surface). Public SSR pages for list+detail. Admin client-side UI for management. Anthropic SDK for AI calls.

**Tech Stack:** Next.js 15, Prisma, TypeScript, @anthropic-ai/sdk, shadcn/ui, next-intl, tsx (script runner)

**Spec:** `docs/superpowers/specs/2026-04-16-vibe-coding-recipes-plugin-design.md`

**Reference plugin:** `src/plugins/contents/` — follow its patterns for plugin.ts, schema, admin, routes, menus, locales.

**No test infrastructure exists.** Verification is manual: `npm run dev`, Prisma migrate, script execution, browser checks.

---

## File Structure

```
src/plugins/vibe-coding-recipes/
  plugin.ts                          — plugin manifest (slug, name, version)
  schema.prisma                      — VibeRecipe + VibeRecipeGenerationLog models
  locales/
    en.json                          — English UI strings
    ko.json                          — Korean UI strings
  admin/
    menus.ts                         — sidebar menu registration
    page.tsx                         — admin UI (recipes tab + logs tab)
    api/
      route.ts                       — GET list / DELETE bulk
      [id]/route.ts                  — GET detail / DELETE single
      generate/route.ts              — POST manual generate
      logs/route.ts                  — GET generation logs
  routes/
    page.tsx                         — public list page (SSR)
    [slug]/page.tsx                  — public detail page (SSR)
  components/
    RecipeCard.tsx                   — card in list grid
    RecipeFilter.tsx                 — difficulty/type filter tabs (client)
    RecipeSteps.tsx                  — step-by-step prompts on detail page
    CopyButton.tsx                   — copy prompt to clipboard (client)
  cron/
    generate.ts                      — CLI entrypoint (tsx)
    slot-resolver.ts                 — day/hour → { difficulty, type, slot }
    prompt-builder.ts                — system/user prompt assembly
    claude-client.ts                 — Anthropic SDK wrapper
    recipe-validator.ts              — JSON response validation
```

---

## Task 1: Install Dependencies + Environment

**Files:**
- Modify: `package.json`
- Modify: `.env` (local only, not committed)

- [ ] **Step 1: Install @anthropic-ai/sdk**

```bash
cd /path/to/production-source && npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Add environment variables to .env**

Append to `.env`:

```
# Vibe Coding Recipes
ANTHROPIC_API_KEY=sk-ant-REPLACE_ME
VIBE_RECIPES_CLAUDE_MODEL=claude-sonnet-4-5-20250929
VIBE_RECIPES_ENABLED=true
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @anthropic-ai/sdk for vibe-coding-recipes plugin"
```

---

## Task 2: Plugin Scaffold — plugin.ts + schema.prisma

**Files:**
- Create: `src/plugins/vibe-coding-recipes/plugin.ts`
- Create: `src/plugins/vibe-coding-recipes/schema.prisma`

- [ ] **Step 1: Create plugin.ts**

```typescript
// src/plugins/vibe-coding-recipes/plugin.ts
export default {
  name: 'Vibe Coding Recipes',
  description: 'AI-generated step-by-step recipes for building nexibase plugins and widgets',
  version: '1.0.0',
  author: 'nexibase',
  authorDomain: 'https://nexibase.com',
  repository: '',
  slug: 'vibe-coding-recipes',
  defaultEnabled: true,
}
```

- [ ] **Step 2: Create schema.prisma**

```prisma
// src/plugins/vibe-coding-recipes/schema.prisma
model VibeRecipe {
  id            Int      @id @default(autoincrement())
  slug          String   @unique @db.VarChar(200)
  difficulty    String   @db.VarChar(20)
  type          String   @db.VarChar(30)

  titleEn       String   @db.VarChar(300)
  descriptionEn String   @db.Text
  constraintsEn Json
  stepsEn       Json

  titleKo       String   @db.VarChar(300)
  descriptionKo String   @db.Text
  constraintsKo Json
  stepsKo       Json

  generatedAt   DateTime @default(now())
  model         String   @db.VarChar(100)

  @@index([difficulty])
  @@index([type])
  @@index([generatedAt])
  @@map("vibe_recipes")
}

model VibeRecipeGenerationLog {
  id           Int       @id @default(autoincrement())
  startedAt    DateTime  @default(now())
  finishedAt   DateTime?
  status       String    @db.VarChar(20)
  difficulty   String    @db.VarChar(20)
  type         String    @db.VarChar(30)
  slot         Int
  recipeId     Int?
  errorMessage String?   @db.Text
  tokensUsed   Int?

  @@index([startedAt])
  @@index([status])
  @@map("vibe_recipe_generation_logs")
}
```

- [ ] **Step 3: Run plugin scan + Prisma migrate**

```bash
npm run dev &
sleep 5 && kill %1
npx prisma migrate dev --name add-vibe-recipes
```

Verify: `prisma/schema.prisma` should contain both models merged in. Migration should create `vibe_recipes` and `vibe_recipe_generation_logs` tables.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/vibe-coding-recipes/plugin.ts src/plugins/vibe-coding-recipes/schema.prisma prisma/
git commit -m "feat(vibe-recipes): add plugin scaffold with Prisma schema"
```

---

## Task 3: i18n Locales

**Files:**
- Create: `src/plugins/vibe-coding-recipes/locales/en.json`
- Create: `src/plugins/vibe-coding-recipes/locales/ko.json`

- [ ] **Step 1: Create en.json**

```json
{
  "vibe-coding-recipes": {
    "title": "Vibe Coding Recipes",
    "subtitle": "AI-generated step-by-step tutorials for building nexibase plugins and widgets",
    "filterAll": "All",
    "filterBeginner": "Beginner",
    "filterIntermediate": "Intermediate",
    "filterAdvanced": "Advanced",
    "filterPlugin": "Plugin",
    "filterWidget": "Widget",
    "filterPluginWidget": "Plugin + Widget",
    "difficulty": "Difficulty",
    "type": "Type",
    "steps": "Steps",
    "step": "Step",
    "prompt": "Prompt",
    "expected": "Expected Result",
    "constraints": "Constraints",
    "copyPrompt": "Copy",
    "copied": "Copied!",
    "empty": "No recipes yet. Check back soon!",
    "prev": "Previous",
    "next": "Next",
    "backToList": "Back to recipes",
    "generatedAt": "Generated",
    "admin": {
      "menu": "Vibe Recipes",
      "title": "Vibe Coding Recipes",
      "headerDesc": "Manage AI-generated plugin/widget development recipes",
      "tabRecipes": "Recipes",
      "tabLogs": "Generation Logs",
      "generateBtn": "Generate Now",
      "generating": "Generating...",
      "generateSuccess": "Recipe generated successfully",
      "generateFailed": "Failed to generate recipe",
      "deleteConfirm": "Delete this recipe?",
      "deleted": "Recipe deleted",
      "deleteFailed": "Failed to delete",
      "colTitle": "Title",
      "colSlug": "Slug",
      "colDifficulty": "Difficulty",
      "colType": "Type",
      "colGeneratedAt": "Generated",
      "colActions": "Actions",
      "logColTime": "Time",
      "logColSlot": "Slot",
      "logColDifficulty": "Difficulty",
      "logColType": "Type",
      "logColStatus": "Status",
      "logColTokens": "Tokens",
      "logColError": "Error",
      "logColRecipe": "Recipe",
      "statusSuccess": "Success",
      "statusFailed": "Failed",
      "statusSkipped": "Skipped",
      "selectDifficulty": "Select difficulty",
      "selectType": "Select type",
      "cancel": "Cancel",
      "generate": "Generate"
    }
  }
}
```

- [ ] **Step 2: Create ko.json**

```json
{
  "vibe-coding-recipes": {
    "title": "바이브코딩 레시피",
    "subtitle": "AI가 생성한 nexibase 플러그인/위젯 개발 단계별 튜토리얼",
    "filterAll": "전체",
    "filterBeginner": "입문",
    "filterIntermediate": "중급",
    "filterAdvanced": "고급",
    "filterPlugin": "플러그인",
    "filterWidget": "위젯",
    "filterPluginWidget": "플러그인 + 위젯",
    "difficulty": "난이도",
    "type": "유형",
    "steps": "단계",
    "step": "단계",
    "prompt": "프롬프트",
    "expected": "예상 결과",
    "constraints": "제약 조건",
    "copyPrompt": "복사",
    "copied": "복사됨!",
    "empty": "아직 레시피가 없습니다. 곧 추가됩니다!",
    "prev": "이전",
    "next": "다음",
    "backToList": "레시피 목록으로",
    "generatedAt": "생성일",
    "admin": {
      "menu": "바이브 레시피",
      "title": "바이브코딩 레시피",
      "headerDesc": "AI 생성 플러그인/위젯 개발 레시피 관리",
      "tabRecipes": "레시피",
      "tabLogs": "생성 로그",
      "generateBtn": "지금 생성",
      "generating": "생성 중...",
      "generateSuccess": "레시피가 생성되었습니다",
      "generateFailed": "레시피 생성에 실패했습니다",
      "deleteConfirm": "이 레시피를 삭제하시겠습니까?",
      "deleted": "삭제되었습니다",
      "deleteFailed": "삭제에 실패했습니다",
      "colTitle": "제목",
      "colSlug": "슬러그",
      "colDifficulty": "난이도",
      "colType": "유형",
      "colGeneratedAt": "생성일",
      "colActions": "관리",
      "logColTime": "시간",
      "logColSlot": "슬롯",
      "logColDifficulty": "난이도",
      "logColType": "유형",
      "logColStatus": "상태",
      "logColTokens": "토큰",
      "logColError": "오류",
      "logColRecipe": "레시피",
      "statusSuccess": "성공",
      "statusFailed": "실패",
      "statusSkipped": "건너뜀",
      "selectDifficulty": "난이도 선택",
      "selectType": "유형 선택",
      "cancel": "취소",
      "generate": "생성"
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/vibe-coding-recipes/locales/
git commit -m "feat(vibe-recipes): add i18n locales (en + ko)"
```

---

## Task 4: Admin Menu

**Files:**
- Create: `src/plugins/vibe-coding-recipes/admin/menus.ts`

- [ ] **Step 1: Create admin/menus.ts**

```typescript
// src/plugins/vibe-coding-recipes/admin/menus.ts
export default [
  { label: 'admin.menu', icon: 'Sparkles', path: '/admin/vibe-coding-recipes' },
]
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/vibe-coding-recipes/admin/menus.ts
git commit -m "feat(vibe-recipes): add admin sidebar menu"
```

---

## Task 5: Cron — slot-resolver.ts

**Files:**
- Create: `src/plugins/vibe-coding-recipes/cron/slot-resolver.ts`

- [ ] **Step 1: Create slot-resolver.ts**

This module maps the current day-of-week and hour to (difficulty, type, slot). It also needs to query the DB for the last beginner recipe's type to alternate plugin/widget.

```typescript
// src/plugins/vibe-coding-recipes/cron/slot-resolver.ts
import { PrismaClient } from '@prisma/client'

export interface SlotResult {
  slot: 1 | 2 | 3
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  type: 'plugin' | 'widget' | 'plugin_with_widget'
}

const SCHEDULE: Record<string, ('beginner' | 'intermediate' | 'advanced')[]> = {
  mon: ['beginner', 'beginner', 'advanced'],
  thu: ['beginner', 'beginner', 'advanced'],
  _default: ['beginner', 'beginner', 'intermediate'],
}

const DAY_MAP: Record<number, string> = {
  0: '_default', // Sun
  1: 'mon',
  2: '_default', // Tue
  3: '_default', // Wed
  4: 'thu',
  5: '_default', // Fri
  6: '_default', // Sat
}

const HOUR_TO_SLOT: Record<number, 1 | 2 | 3> = {
  9: 1,
  14: 2,
  20: 3,
}

export async function resolveSlot(
  prisma: PrismaClient,
  overrides?: { difficulty?: SlotResult['difficulty']; type?: SlotResult['type'] }
): Promise<SlotResult> {
  const now = new Date()
  const hour = now.getHours()
  const dayOfWeek = now.getDay()

  const slot = HOUR_TO_SLOT[hour] ?? inferSlotFromHour(hour)
  const dayKey = DAY_MAP[dayOfWeek] ?? '_default'
  const schedule = SCHEDULE[dayKey] ?? SCHEDULE['_default']

  const difficulty = overrides?.difficulty ?? schedule[slot - 1]

  let type: SlotResult['type']
  if (overrides?.type) {
    type = overrides.type
  } else if (difficulty === 'advanced') {
    type = 'plugin_with_widget'
  } else if (difficulty === 'intermediate') {
    type = 'plugin'
  } else {
    type = await getNextBeginnerType(prisma)
  }

  return { slot, difficulty, type }
}

function inferSlotFromHour(hour: number): 1 | 2 | 3 {
  if (hour < 12) return 1
  if (hour < 17) return 2
  return 3
}

async function getNextBeginnerType(
  prisma: PrismaClient
): Promise<'plugin' | 'widget'> {
  const last = await prisma.vibeRecipe.findFirst({
    where: { difficulty: 'beginner' },
    orderBy: { generatedAt: 'desc' },
    select: { type: true },
  })
  return last?.type === 'plugin' ? 'widget' : 'plugin'
}
```

- [ ] **Step 2: Verify syntax**

```bash
npx tsx --eval "import('./src/plugins/vibe-coding-recipes/cron/slot-resolver.ts').then(() => console.log('OK'))"
```

Expected: `OK` (module parses without errors)

- [ ] **Step 3: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/slot-resolver.ts
git commit -m "feat(vibe-recipes): add cron slot resolver (day/hour → difficulty/type)"
```

---

## Task 6: Cron — claude-client.ts

**Files:**
- Create: `src/plugins/vibe-coding-recipes/cron/claude-client.ts`

- [ ] **Step 1: Create claude-client.ts**

```typescript
// src/plugins/vibe-coding-recipes/cron/claude-client.ts
import Anthropic from '@anthropic-ai/sdk'

export interface ClaudeResponse {
  text: string
  inputTokens: number
  outputTokens: number
}

export async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<ClaudeResponse> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const model = process.env.VIBE_RECIPES_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

  const response = await client.messages.create({
    model,
    max_tokens: 32768,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in Claude response')
  }

  if (response.stop_reason === 'max_tokens') {
    console.warn('[vibe-recipes] Claude response truncated (max_tokens)')
  }

  return {
    text: textBlock.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/claude-client.ts
git commit -m "feat(vibe-recipes): add Claude API client wrapper"
```

---

## Task 7: Cron — prompt-builder.ts

**Files:**
- Create: `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts`

- [ ] **Step 1: Create prompt-builder.ts**

```typescript
// src/plugins/vibe-coding-recipes/cron/prompt-builder.ts
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
  existingRecipes: { titleEn: string; slug: string }[]
): string {
  const difficultyGuide = getDifficultyGuide(slot.difficulty, slot.type)

  let prompt = `Generate 1 vibe-coding recipe for building a nexibase ${slot.type.replace(/_/g, ' ')}.

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
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/prompt-builder.ts
git commit -m "feat(vibe-recipes): add AI prompt builder with nexibase architecture context"
```

---

## Task 8: Cron — recipe-validator.ts

**Files:**
- Create: `src/plugins/vibe-coding-recipes/cron/recipe-validator.ts`

- [ ] **Step 1: Create recipe-validator.ts**

```typescript
// src/plugins/vibe-coding-recipes/cron/recipe-validator.ts
import { PrismaClient } from '@prisma/client'

export interface ValidatedRecipe {
  slug: string
  titleEn: string
  titleKo: string
  descriptionEn: string
  descriptionKo: string
  difficulty: string
  type: string
  constraintsEn: string[]
  constraintsKo: string[]
  stepsEn: { step: number; prompt: string; expected: string }[]
  stepsKo: { step: number; prompt: string; expected: string }[]
}

const STEP_LIMITS: Record<string, [number, number]> = {
  beginner: [2, 3],
  intermediate: [4, 6],
  advanced: [6, 10],
}

export function parseClaudeResponse(raw: string): Record<string, unknown> {
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '')
  cleaned = cleaned.replace(/\s*```$/, '')

  const parsed = JSON.parse(cleaned)
  if (Array.isArray(parsed)) return parsed[0]
  return parsed
}

export function validateRecipe(data: Record<string, unknown>): ValidatedRecipe {
  const required = [
    'slug', 'titleEn', 'titleKo', 'descriptionEn', 'descriptionKo',
    'difficulty', 'type', 'constraintsEn', 'constraintsKo', 'stepsEn', 'stepsKo',
  ] as const

  for (const key of required) {
    if (!data[key]) {
      throw new Error(`Missing required field: ${key}`)
    }
  }

  const slug = String(data.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-')
  const difficulty = String(data.difficulty)
  const type = String(data.type)

  if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
    throw new Error(`Invalid difficulty: ${difficulty}`)
  }
  if (!['plugin', 'widget', 'plugin_with_widget'].includes(type)) {
    throw new Error(`Invalid type: ${type}`)
  }

  const stepsEn = data.stepsEn as ValidatedRecipe['stepsEn']
  const stepsKo = data.stepsKo as ValidatedRecipe['stepsKo']
  const [min, max] = STEP_LIMITS[difficulty] ?? [2, 10]

  if (stepsEn.length < min || stepsEn.length > max) {
    console.warn(`[vibe-recipes] Steps count ${stepsEn.length} outside expected range [${min}, ${max}] for ${difficulty}`)
  }

  return {
    slug,
    titleEn: String(data.titleEn),
    titleKo: String(data.titleKo),
    descriptionEn: String(data.descriptionEn),
    descriptionKo: String(data.descriptionKo),
    difficulty,
    type,
    constraintsEn: (data.constraintsEn as string[]) ?? [],
    constraintsKo: (data.constraintsKo as string[]) ?? [],
    stepsEn,
    stepsKo,
  }
}

export async function ensureUniqueSlug(
  prisma: PrismaClient,
  slug: string
): Promise<string> {
  let candidate = slug
  let counter = 1
  while (await prisma.vibeRecipe.findUnique({ where: { slug: candidate } })) {
    candidate = `${slug}-${counter++}`
  }
  return candidate
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/recipe-validator.ts
git commit -m "feat(vibe-recipes): add recipe JSON response validator"
```

---

## Task 9: Cron — generate.ts (Entrypoint)

**Files:**
- Create: `src/plugins/vibe-coding-recipes/cron/generate.ts`

- [ ] **Step 1: Create generate.ts**

```typescript
// src/plugins/vibe-coding-recipes/cron/generate.ts
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../../../../.env') })

import { PrismaClient } from '@prisma/client'
import { resolveSlot } from './slot-resolver'
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder'
import { callClaude } from './claude-client'
import { parseClaudeResponse, validateRecipe, ensureUniqueSlug } from './recipe-validator'

async function main() {
  if (process.env.VIBE_RECIPES_ENABLED !== 'true') {
    console.log('[vibe-recipes] Disabled via VIBE_RECIPES_ENABLED. Exiting.')
    return
  }

  const prisma = new PrismaClient()

  try {
    const overrides = parseCliOverrides()
    const slot = await resolveSlot(prisma, overrides)

    console.log(`[vibe-recipes] Slot ${slot.slot}: ${slot.difficulty} / ${slot.type}`)

    const log = await prisma.vibeRecipeGenerationLog.create({
      data: {
        status: 'running',
        difficulty: slot.difficulty,
        type: slot.type,
        slot: slot.slot,
      },
    })

    try {
      const existingRecipes = await prisma.vibeRecipe.findMany({
        orderBy: { generatedAt: 'desc' },
        take: 100,
        select: { titleEn: true, slug: true },
      })

      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt(slot, existingRecipes)

      console.log('[vibe-recipes] Calling Claude...')
      const response = await callClaude(systemPrompt, userPrompt)

      console.log(`[vibe-recipes] Received ${response.outputTokens} output tokens`)

      const parsed = parseClaudeResponse(response.text)
      const validated = validateRecipe(parsed)
      const uniqueSlug = await ensureUniqueSlug(prisma, validated.slug)

      const model = process.env.VIBE_RECIPES_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

      const recipe = await prisma.vibeRecipe.create({
        data: {
          slug: uniqueSlug,
          difficulty: validated.difficulty,
          type: validated.type,
          titleEn: validated.titleEn,
          titleKo: validated.titleKo,
          descriptionEn: validated.descriptionEn,
          descriptionKo: validated.descriptionKo,
          constraintsEn: validated.constraintsEn,
          constraintsKo: validated.constraintsKo,
          stepsEn: validated.stepsEn,
          stepsKo: validated.stepsKo,
          model,
        },
      })

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          recipeId: recipe.id,
          tokensUsed: response.inputTokens + response.outputTokens,
        },
      })

      console.log(`[vibe-recipes] Created recipe #${recipe.id}: "${recipe.titleEn}" (${uniqueSlug})`)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`[vibe-recipes] Generation failed: ${msg}`)

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: msg.slice(0, 2000),
        },
      })
    }
  } finally {
    await prisma.$disconnect()
  }
}

function parseCliOverrides(): {
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  type?: 'plugin' | 'widget' | 'plugin_with_widget'
} {
  const args = process.argv.slice(2)
  const overrides: Record<string, string> = {}
  for (const arg of args) {
    const [key, val] = arg.replace(/^--/, '').split('=')
    if (key && val) overrides[key] = val
  }
  return {
    difficulty: overrides.difficulty as 'beginner' | 'intermediate' | 'advanced' | undefined,
    type: overrides.type as 'plugin' | 'widget' | 'plugin_with_widget' | undefined,
  }
}

main().catch((err) => {
  console.error('[vibe-recipes] Fatal error:', err)
  process.exit(1)
})
```

- [ ] **Step 2: Verify the script runs (dry check)**

```bash
VIBE_RECIPES_ENABLED=false npx tsx src/plugins/vibe-coding-recipes/cron/generate.ts
```

Expected output: `[vibe-recipes] Disabled via VIBE_RECIPES_ENABLED. Exiting.`

- [ ] **Step 3: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/generate.ts
git commit -m "feat(vibe-recipes): add cron entrypoint script"
```

---

## Task 10: Admin API — List, Detail, Delete

**Files:**
- Create: `src/plugins/vibe-coding-recipes/admin/api/route.ts`
- Create: `src/plugins/vibe-coding-recipes/admin/api/[id]/route.ts`

- [ ] **Step 1: Create admin/api/route.ts (GET list + DELETE bulk)**

```typescript
// src/plugins/vibe-coding-recipes/admin/api/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const difficulty = searchParams.get('difficulty') || ''
    const type = searchParams.get('type') || ''

    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (difficulty) where.difficulty = difficulty
    if (type) where.type = type

    const [recipes, total] = await Promise.all([
      prisma.vibeRecipe.findMany({
        where,
        skip,
        take: limit,
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          titleEn: true,
          titleKo: true,
          difficulty: true,
          type: true,
          generatedAt: true,
        },
      }),
      prisma.vibeRecipe.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      recipes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Failed to fetch vibe recipes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 })
    }

    await prisma.vibeRecipe.deleteMany({ where: { id: { in: ids } } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete vibe recipes:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create admin/api/[id]/route.ts (GET detail + DELETE single)**

```typescript
// src/plugins/vibe-coding-recipes/admin/api/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const recipe = await prisma.vibeRecipe.findUnique({
      where: { id: parseInt(id) },
    })

    if (!recipe) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, recipe })
  } catch (error) {
    console.error('Failed to fetch vibe recipe:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await prisma.vibeRecipe.delete({ where: { id: parseInt(id) } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete vibe recipe:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/vibe-coding-recipes/admin/api/
git commit -m "feat(vibe-recipes): add admin API for recipe list/detail/delete"
```

---

## Task 11: Admin API — Manual Generate + Logs

**Files:**
- Create: `src/plugins/vibe-coding-recipes/admin/api/generate/route.ts`
- Create: `src/plugins/vibe-coding-recipes/admin/api/logs/route.ts`

- [ ] **Step 1: Create admin/api/generate/route.ts**

```typescript
// src/plugins/vibe-coding-recipes/admin/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { resolveSlot } from '@/plugins/vibe-coding-recipes/cron/slot-resolver'
import { buildSystemPrompt, buildUserPrompt } from '@/plugins/vibe-coding-recipes/cron/prompt-builder'
import { callClaude } from '@/plugins/vibe-coding-recipes/cron/claude-client'
import {
  parseClaudeResponse,
  validateRecipe,
  ensureUniqueSlug,
} from '@/plugins/vibe-coding-recipes/cron/recipe-validator'

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const difficulty = body.difficulty as string
    const type = body.type as string

    if (!difficulty || !type) {
      return NextResponse.json({ error: 'difficulty and type required' }, { status: 400 })
    }

    const slot = await resolveSlot(prisma, { difficulty: difficulty as any, type: type as any })

    const log = await prisma.vibeRecipeGenerationLog.create({
      data: {
        status: 'running',
        difficulty: slot.difficulty,
        type: slot.type,
        slot: slot.slot,
      },
    })

    try {
      const existingRecipes = await prisma.vibeRecipe.findMany({
        orderBy: { generatedAt: 'desc' },
        take: 100,
        select: { titleEn: true, slug: true },
      })

      const systemPrompt = buildSystemPrompt()
      const userPrompt = buildUserPrompt(slot, existingRecipes)

      const response = await callClaude(systemPrompt, userPrompt)
      const parsed = parseClaudeResponse(response.text)
      const validated = validateRecipe(parsed)
      const uniqueSlug = await ensureUniqueSlug(prisma, validated.slug)

      const model = process.env.VIBE_RECIPES_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

      const recipe = await prisma.vibeRecipe.create({
        data: {
          slug: uniqueSlug,
          difficulty: validated.difficulty,
          type: validated.type,
          titleEn: validated.titleEn,
          titleKo: validated.titleKo,
          descriptionEn: validated.descriptionEn,
          descriptionKo: validated.descriptionKo,
          constraintsEn: validated.constraintsEn,
          constraintsKo: validated.constraintsKo,
          stepsEn: validated.stepsEn,
          stepsKo: validated.stepsKo,
          model,
        },
      })

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          recipeId: recipe.id,
          tokensUsed: response.inputTokens + response.outputTokens,
        },
      })

      return NextResponse.json({ success: true, recipe })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)

      await prisma.vibeRecipeGenerationLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          errorMessage: msg.slice(0, 2000),
        },
      })

      return NextResponse.json({ error: msg }, { status: 500 })
    }
  } catch (error) {
    console.error('Failed to generate vibe recipe:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create admin/api/logs/route.ts**

```typescript
// src/plugins/vibe-coding-recipes/admin/api/logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '30')
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    where.startedAt = { gte: thirtyDaysAgo }

    const [logs, total] = await Promise.all([
      prisma.vibeRecipeGenerationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { startedAt: 'desc' },
      }),
      prisma.vibeRecipeGenerationLog.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('Failed to fetch generation logs:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/vibe-coding-recipes/admin/api/generate/ src/plugins/vibe-coding-recipes/admin/api/logs/
git commit -m "feat(vibe-recipes): add admin API for manual generation and logs"
```

---

## Task 12: Public Components

**Files:**
- Create: `src/plugins/vibe-coding-recipes/components/CopyButton.tsx`
- Create: `src/plugins/vibe-coding-recipes/components/RecipeFilter.tsx`
- Create: `src/plugins/vibe-coding-recipes/components/RecipeCard.tsx`
- Create: `src/plugins/vibe-coding-recipes/components/RecipeSteps.tsx`

- [ ] **Step 1: Create CopyButton.tsx**

```tsx
// src/plugins/vibe-coding-recipes/components/CopyButton.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function CopyButton({ text }: { text: string }) {
  const t = useTranslations('vibe-coding-recipes')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? t('copied') : t('copyPrompt')}
    </Button>
  )
}
```

- [ ] **Step 2: Create RecipeFilter.tsx**

```tsx
// src/plugins/vibe-coding-recipes/components/RecipeFilter.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'

const DIFFICULTIES = ['', 'beginner', 'intermediate', 'advanced'] as const
const TYPES = ['', 'plugin', 'widget', 'plugin_with_widget'] as const

const DIFF_KEYS: Record<string, string> = {
  '': 'filterAll',
  beginner: 'filterBeginner',
  intermediate: 'filterIntermediate',
  advanced: 'filterAdvanced',
}

const TYPE_KEYS: Record<string, string> = {
  '': 'filterAll',
  plugin: 'filterPlugin',
  widget: 'filterWidget',
  plugin_with_widget: 'filterPluginWidget',
}

export function RecipeFilter() {
  const t = useTranslations('vibe-coding-recipes')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentDifficulty = searchParams.get('difficulty') || ''
  const currentType = searchParams.get('type') || ''

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium self-center mr-1">{t('difficulty')}:</span>
        {DIFFICULTIES.map((d) => (
          <Button
            key={d || 'all-diff'}
            variant={currentDifficulty === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('difficulty', d)}
          >
            {t(DIFF_KEYS[d])}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium self-center mr-1">{t('type')}:</span>
        {TYPES.map((tp) => (
          <Button
            key={tp || 'all-type'}
            variant={currentType === tp ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('type', tp)}
          >
            {t(TYPE_KEYS[tp])}
          </Button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create RecipeCard.tsx**

```tsx
// src/plugins/vibe-coding-recipes/components/RecipeCard.tsx
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface RecipeCardProps {
  slug: string
  title: string
  description: string
  difficulty: string
  type: string
  generatedAt: string
  locale: string
}

const DIFF_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
}

const TYPE_COLORS: Record<string, string> = {
  plugin: 'bg-blue-100 text-blue-800',
  widget: 'bg-purple-100 text-purple-800',
  plugin_with_widget: 'bg-indigo-100 text-indigo-800',
}

export function RecipeCard({
  slug,
  title,
  description,
  difficulty,
  type,
  generatedAt,
  locale,
}: RecipeCardProps) {
  const plainDesc = description.replace(/[#*`_\[\]]/g, '').slice(0, 120)
  const relativeTime = getRelativeTime(generatedAt, locale)
  const typeLabel = type.replace(/_/g, ' ')

  return (
    <Link href={`/${locale}/vibe-coding-recipes/${slug}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="secondary" className={DIFF_COLORS[difficulty]}>
              {difficulty}
            </Badge>
            <Badge variant="secondary" className={TYPE_COLORS[type]}>
              {typeLabel}
            </Badge>
          </div>
          <CardTitle className="text-base leading-snug line-clamp-2">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">{plainDesc}</p>
          <p className="text-xs text-muted-foreground mt-3">{relativeTime}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function getRelativeTime(dateStr: string, locale: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return locale === 'ko' ? '오늘' : 'Today'
  if (diffDays === 1) return locale === 'ko' ? '어제' : 'Yesterday'
  if (diffDays < 7) return locale === 'ko' ? `${diffDays}일 전` : `${diffDays}d ago`
  if (diffDays < 30) return locale === 'ko' ? `${Math.floor(diffDays / 7)}주 전` : `${Math.floor(diffDays / 7)}w ago`
  return date.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', { month: 'short', day: 'numeric' })
}
```

- [ ] **Step 4: Create RecipeSteps.tsx**

```tsx
// src/plugins/vibe-coding-recipes/components/RecipeSteps.tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CopyButton } from './CopyButton'
import { useTranslations } from 'next-intl'

interface Step {
  step: number
  prompt: string
  expected: string
}

export function RecipeSteps({ steps }: { steps: Step[] }) {
  const t = useTranslations('vibe-coding-recipes')

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">{t('steps')}</h2>
      {steps.map((s) => (
        <Card key={s.step}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t('step')} {s.step}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-muted-foreground">{t('prompt')}</span>
                <CopyButton text={s.prompt} />
              </div>
              <pre className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap overflow-x-auto">
                {s.prompt}
              </pre>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">{t('expected')}</span>
              <p className="text-sm mt-1">{s.expected}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add src/plugins/vibe-coding-recipes/components/
git commit -m "feat(vibe-recipes): add public UI components (card, filter, steps, copy)"
```

---

## Task 13: Public Pages — List + Detail

**Files:**
- Create: `src/plugins/vibe-coding-recipes/routes/page.tsx`
- Create: `src/plugins/vibe-coding-recipes/routes/[slug]/page.tsx`

- [ ] **Step 1: Create routes/page.tsx (list page)**

```tsx
// src/plugins/vibe-coding-recipes/routes/page.tsx
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { getLocale } from 'next-intl/server'
import { RecipeCard } from '@/plugins/vibe-coding-recipes/components/RecipeCard'
import { RecipeFilter } from '@/plugins/vibe-coding-recipes/components/RecipeFilter'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Vibe Coding Recipes',
  description: 'AI-generated step-by-step tutorials for building nexibase plugins and widgets',
}

const PAGE_SIZE = 12

export default async function RecipeListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const locale = await getLocale()
  const page = Math.max(1, parseInt(params.page || '1'))
  const difficulty = params.difficulty || ''
  const type = params.type || ''

  const where: Record<string, unknown> = {}
  if (difficulty) where.difficulty = difficulty
  if (type) where.type = type

  const [recipes, total] = await Promise.all([
    prisma.vibeRecipe.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { generatedAt: 'desc' },
    }),
    prisma.vibeRecipe.count({ where }),
  ])

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const isKo = locale === 'ko'

  const buildPageUrl = (p: number) => {
    const sp = new URLSearchParams()
    if (difficulty) sp.set('difficulty', difficulty)
    if (type) sp.set('type', type)
    sp.set('page', String(p))
    return `/${locale}/vibe-coding-recipes?${sp.toString()}`
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {isKo ? '바이브코딩 레시피' : 'Vibe Coding Recipes'}
        </h1>
        <p className="text-muted-foreground">
          {isKo
            ? 'AI가 생성한 nexibase 플러그인/위젯 개발 단계별 튜토리얼'
            : 'AI-generated step-by-step tutorials for building nexibase plugins and widgets'}
        </p>
      </div>

      <div className="mb-6">
        <RecipeFilter />
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {isKo ? '아직 레시피가 없습니다. 곧 추가됩니다!' : 'No recipes yet. Check back soon!'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                slug={recipe.slug}
                title={isKo ? recipe.titleKo : recipe.titleEn}
                description={isKo ? recipe.descriptionKo : recipe.descriptionEn}
                difficulty={recipe.difficulty}
                type={recipe.type}
                generatedAt={recipe.generatedAt.toISOString()}
                locale={locale}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              {page > 1 && (
                <Link href={buildPageUrl(page - 1)}>
                  <Button variant="outline" size="sm">
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {isKo ? '이전' : 'Previous'}
                  </Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground px-3">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link href={buildPageUrl(page + 1)}>
                  <Button variant="outline" size="sm">
                    {isKo ? '다음' : 'Next'}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create routes/[slug]/page.tsx (detail page)**

```tsx
// src/plugins/vibe-coding-recipes/routes/[slug]/page.tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getLocale } from 'next-intl/server'
import { RecipeSteps } from '@/plugins/vibe-coding-recipes/components/RecipeSteps'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const recipe = await prisma.vibeRecipe.findUnique({
    where: { slug },
    select: { titleEn: true, descriptionEn: true },
  })
  if (!recipe) return {}

  const description = recipe.descriptionEn.replace(/[#*`_\[\]]/g, '').slice(0, 160)
  return {
    title: recipe.titleEn,
    description,
    openGraph: {
      title: recipe.titleEn,
      description,
      url: `https://nexibase.com/en/vibe-coding-recipes/${slug}`,
    },
    alternates: {
      canonical: `https://nexibase.com/en/vibe-coding-recipes/${slug}`,
    },
  }
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const locale = await getLocale()
  const isKo = locale === 'ko'

  const recipe = await prisma.vibeRecipe.findUnique({ where: { slug } })
  if (!recipe) notFound()

  const title = isKo ? recipe.titleKo : recipe.titleEn
  const description = isKo ? recipe.descriptionKo : recipe.descriptionEn
  const constraints = (isKo ? recipe.constraintsKo : recipe.constraintsEn) as string[]
  const steps = (isKo ? recipe.stepsKo : recipe.stepsEn) as {
    step: number
    prompt: string
    expected: string
  }[]
  const typeLabel = recipe.type.replace(/_/g, ' ')

  const DIFF_COLORS: Record<string, string> = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800',
  }
  const TYPE_COLORS: Record<string, string> = {
    plugin: 'bg-blue-100 text-blue-800',
    widget: 'bg-purple-100 text-purple-800',
    plugin_with_widget: 'bg-indigo-100 text-indigo-800',
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Link href={`/${locale}/vibe-coding-recipes`}>
        <Button variant="ghost" size="sm" className="mb-4 gap-1">
          <ArrowLeft className="h-4 w-4" />
          {isKo ? '레시피 목록으로' : 'Back to recipes'}
        </Button>
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="secondary" className={DIFF_COLORS[recipe.difficulty]}>
            {recipe.difficulty}
          </Badge>
          <Badge variant="secondary" className={TYPE_COLORS[recipe.type]}>
            {typeLabel}
          </Badge>
        </div>
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground">
          {isKo ? '생성일' : 'Generated'}: {recipe.generatedAt.toLocaleDateString(isKo ? 'ko-KR' : 'en-US')}
        </p>
      </div>

      <div className="prose dark:prose-invert max-w-none mb-8">
        <ReactMarkdown>{description}</ReactMarkdown>
      </div>

      {constraints.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-3">
            {isKo ? '제약 조건' : 'Constraints'}
          </h2>
          <ul className="list-disc list-inside space-y-1">
            {constraints.map((c, i) => (
              <li key={i} className="text-sm">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <RecipeSteps steps={steps} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: recipe.titleEn,
            description: recipe.descriptionEn.replace(/[#*`_\[\]]/g, '').slice(0, 300),
            step: (recipe.stepsEn as { step: number; prompt: string; expected: string }[]).map(
              (s) => ({
                '@type': 'HowToStep',
                position: s.step,
                text: s.expected,
              })
            ),
          }),
        }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Verify react-markdown is installed**

```bash
grep '"react-markdown"' package.json || npm install react-markdown
```

If not installed, also commit `package.json` and `package-lock.json`.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/vibe-coding-recipes/routes/
git commit -m "feat(vibe-recipes): add public list and detail pages (SSR)"
```

---

## Task 14: Admin UI Page

**Files:**
- Create: `src/plugins/vibe-coding-recipes/admin/page.tsx`

- [ ] **Step 1: Create admin/page.tsx**

This is the largest single file. It has two tabs (Recipes, Logs) and a Generate modal. It follows the contents plugin admin pattern: `"use client"`, shadcn/ui components, `useTranslations`, fetch from admin API.

```tsx
// src/plugins/vibe-coding-recipes/admin/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/admin/Sidebar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Trash2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  FileText,
  ScrollText,
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface Recipe {
  id: number
  slug: string
  titleEn: string
  titleKo: string
  difficulty: string
  type: string
  generatedAt: string
}

interface GenerationLog {
  id: number
  startedAt: string
  finishedAt: string | null
  status: string
  difficulty: string
  type: string
  slot: number
  recipeId: number | null
  errorMessage: string | null
  tokensUsed: number | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const DIFF_COLORS: Record<string, string> = {
  beginner: 'bg-green-100 text-green-800',
  intermediate: 'bg-yellow-100 text-yellow-800',
  advanced: 'bg-red-100 text-red-800',
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
  skipped: 'bg-gray-100 text-gray-800',
}

export default function VibeRecipesAdminPage() {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [tab, setTab] = useState<'recipes' | 'logs'>('recipes')

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="text-muted-foreground text-sm">{t('headerDesc')}</p>
          </div>

          <div className="flex gap-2 mb-6">
            <Button
              variant={tab === 'recipes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('recipes')}
              className="gap-1"
            >
              <FileText className="h-4 w-4" />
              {t('tabRecipes')}
            </Button>
            <Button
              variant={tab === 'logs' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab('logs')}
              className="gap-1"
            >
              <ScrollText className="h-4 w-4" />
              {t('tabLogs')}
            </Button>
          </div>

          {tab === 'recipes' ? <RecipesTab /> : <LogsTab />}
        </div>
      </div>
    </div>
  )
}

function RecipesTab() {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [difficulty, setDifficulty] = useState('')
  const [type, setType] = useState('')
  const [showGenerate, setShowGenerate] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)

  const fetchRecipes = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (difficulty) params.set('difficulty', difficulty)
      if (type) params.set('type', type)

      const res = await fetch(`/api/vibe-coding-recipes/admin/api?${params}`)
      const data = await res.json()
      if (data.success) {
        setRecipes(data.recipes)
        setPagination(data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [difficulty, type])

  useEffect(() => {
    fetchRecipes()
  }, [fetchRecipes])

  const handleDelete = async (id: number) => {
    if (!confirm(t('deleteConfirm'))) return
    const res = await fetch(`/api/vibe-coding-recipes/admin/api/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchRecipes(pagination.page)
    } else {
      alert(t('deleteFailed'))
    }
  }

  const handleGenerate = async (genDifficulty: string, genType: string) => {
    setGenerating(true)
    try {
      const res = await fetch('/api/vibe-coding-recipes/admin/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: genDifficulty, type: genType }),
      })
      const data = await res.json()
      if (data.success) {
        alert(t('generateSuccess'))
        setShowGenerate(false)
        fetchRecipes()
      } else {
        alert(`${t('generateFailed')}: ${data.error || ''}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  const handleViewDetail = async (id: number) => {
    const res = await fetch(`/api/vibe-coding-recipes/admin/api/${id}`)
    const data = await res.json()
    if (data.success) setDetail(data.recipe)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={difficulty} onValueChange={(v) => setDifficulty(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder={t('colDifficulty')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="beginner">Beginner</SelectItem>
            <SelectItem value="intermediate">Intermediate</SelectItem>
            <SelectItem value="advanced">Advanced</SelectItem>
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={(v) => setType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder={t('colType')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="plugin">Plugin</SelectItem>
            <SelectItem value="widget">Widget</SelectItem>
            <SelectItem value="plugin_with_widget">Plugin + Widget</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex-1" />

        <Button onClick={() => setShowGenerate(true)} className="gap-1">
          <Sparkles className="h-4 w-4" />
          {t('generateBtn')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No recipes</div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">{t('colTitle')}</th>
                <th className="text-left p-3">{t('colSlug')}</th>
                <th className="text-left p-3">{t('colDifficulty')}</th>
                <th className="text-left p-3">{t('colType')}</th>
                <th className="text-left p-3">{t('colGeneratedAt')}</th>
                <th className="text-right p-3">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {recipes.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <button
                      className="text-left hover:underline font-medium"
                      onClick={() => handleViewDetail(r.id)}
                    >
                      {r.titleEn}
                    </button>
                  </td>
                  <td className="p-3 text-muted-foreground">{r.slug}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className={DIFF_COLORS[r.difficulty]}>{r.difficulty}</Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary">{r.type.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.generatedAt).toLocaleDateString()}
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchRecipes(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchRecipes(pagination.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {showGenerate && (
        <GenerateModal
          onClose={() => setShowGenerate(false)}
          onGenerate={handleGenerate}
          generating={generating}
        />
      )}

      {detail && (
        <DetailModal detail={detail} onClose={() => setDetail(null)} />
      )}
    </>
  )
}

function LogsTab() {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [logs, setLogs] = useState<GenerationLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 30, total: 0, totalPages: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  const fetchLogs = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' })
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/vibe-coding-recipes/admin/api/logs?${params}`)
      const data = await res.json()
      if (data.success) {
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder={t('logColStatus')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="success">{t('statusSuccess')}</SelectItem>
            <SelectItem value="failed">{t('statusFailed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No logs</div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3">{t('logColTime')}</th>
                <th className="text-left p-3">{t('logColSlot')}</th>
                <th className="text-left p-3">{t('logColDifficulty')}</th>
                <th className="text-left p-3">{t('logColType')}</th>
                <th className="text-left p-3">{t('logColStatus')}</th>
                <th className="text-left p-3">{t('logColTokens')}</th>
                <th className="text-left p-3">{t('logColError')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className={`border-t ${log.status === 'failed' ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/30'}`}
                >
                  <td className="p-3 text-muted-foreground">
                    {new Date(log.startedAt).toLocaleString()}
                  </td>
                  <td className="p-3">{log.slot}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className={DIFF_COLORS[log.difficulty]}>{log.difficulty}</Badge>
                  </td>
                  <td className="p-3">{log.type.replace(/_/g, ' ')}</td>
                  <td className="p-3">
                    <Badge variant="secondary" className={STATUS_COLORS[log.status]}>{log.status}</Badge>
                  </td>
                  <td className="p-3">{log.tokensUsed?.toLocaleString() ?? '-'}</td>
                  <td className="p-3 text-xs max-w-xs truncate" title={log.errorMessage ?? ''}>
                    {log.errorMessage ? log.errorMessage.slice(0, 80) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => fetchLogs(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">{pagination.page} / {pagination.totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchLogs(pagination.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </>
  )
}

function GenerateModal({
  onClose,
  onGenerate,
  generating,
}: {
  onClose: () => void
  onGenerate: (difficulty: string, type: string) => void
  generating: boolean
}) {
  const t = useTranslations('vibe-coding-recipes.admin')
  const [difficulty, setDifficulty] = useState('beginner')
  const [type, setType] = useState('plugin')

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-96">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('generateBtn')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t('selectDifficulty')}</label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t('selectType')}</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="plugin">Plugin</SelectItem>
                <SelectItem value="widget">Widget</SelectItem>
                <SelectItem value="plugin_with_widget">Plugin + Widget</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={generating}>
              {t('cancel')}
            </Button>
            <Button onClick={() => onGenerate(difficulty, type)} disabled={generating} className="gap-1">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t('generating') : t('generate')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function DetailModal({
  detail,
  onClose,
}: {
  detail: Record<string, unknown>
  onClose: () => void
}) {
  const recipe = detail as unknown as {
    id: number
    slug: string
    titleEn: string
    titleKo: string
    descriptionEn: string
    difficulty: string
    type: string
    stepsEn: { step: number; prompt: string; expected: string }[]
    generatedAt: string
    model: string
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{recipe.titleEn}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{recipe.titleKo}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary" className={DIFF_COLORS[recipe.difficulty]}>{recipe.difficulty}</Badge>
              <Badge variant="secondary">{recipe.type.replace(/_/g, ' ')}</Badge>
              <Badge variant="outline">{recipe.model}</Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{recipe.descriptionEn}</p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Steps ({recipe.stepsEn.length})</h3>
            {recipe.stepsEn.map((s) => (
              <div key={s.step} className="mb-3 border-l-2 pl-3">
                <p className="text-sm font-medium">Step {s.step}</p>
                <pre className="text-xs bg-muted p-2 rounded mt-1 whitespace-pre-wrap">{s.prompt}</pre>
                <p className="text-xs text-muted-foreground mt-1">{s.expected}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <a
              href={`/en/vibe-coding-recipes/${recipe.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1">
                <ExternalLink className="h-3 w-3" />
                View public page
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/plugins/vibe-coding-recipes/admin/page.tsx
git commit -m "feat(vibe-recipes): add admin UI with recipes list, generation logs, and generate modal"
```

---

## Task 15: Plugin Scan + End-to-End Verification

- [ ] **Step 1: Run dev to trigger plugin scan**

```bash
cd /path/to/production-source && npm run dev
```

Watch for errors. The scan script should detect the new plugin and generate route wrappers at:
- `src/app/[locale]/vibe-coding-recipes/page.tsx`
- `src/app/[locale]/vibe-coding-recipes/[slug]/page.tsx`
- `src/app/api/vibe-coding-recipes/admin/api/...`

- [ ] **Step 2: Verify generated routes exist**

```bash
ls -la src/app/\[locale\]/vibe-coding-recipes/ 2>/dev/null
ls -la src/app/api/vibe-coding-recipes/ 2>/dev/null
```

Both directories should exist with wrapper files.

- [ ] **Step 3: Run Prisma migrate if not already done**

```bash
npx prisma migrate dev --name add-vibe-recipes
```

- [ ] **Step 4: Open in browser and verify**

Open `http://localhost:9119/en/vibe-coding-recipes` — should show empty state.

Open `http://localhost:9119/admin/vibe-coding-recipes` (logged in as admin) — should show admin UI with empty table and Generate Now button.

- [ ] **Step 5: Test manual generation from admin**

Click "Generate Now", select Beginner + Plugin, click Generate. Wait for Claude response (~30s). Recipe should appear in table.

Click recipe title → detail modal should show full recipe data.

Open public page → recipe card should appear in list. Click → detail with copyable prompts.

- [ ] **Step 6: Test cron script manually**

```bash
cd /path/to/production-source && VIBE_RECIPES_ENABLED=true npx tsx src/plugins/vibe-coding-recipes/cron/generate.ts
```

Should output recipe creation log. Check DB for new recipe.

- [ ] **Step 7: Test with overrides**

```bash
npx tsx src/plugins/vibe-coding-recipes/cron/generate.ts --difficulty=advanced --type=plugin_with_widget
```

Should generate an advanced recipe.

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "feat(vibe-recipes): complete vibe-coding-recipes plugin — end-to-end verified"
```

---

## Task 16: Crontab Setup (Production)

- [ ] **Step 1: Add crontab entry**

```bash
crontab -e
```

Add:
```
0 9,14,20 * * * cd /path/to/production-source && /usr/bin/env npx tsx src/plugins/vibe-coding-recipes/cron/generate.ts >> /var/log/vibe-recipes-cron.log 2>&1
```

- [ ] **Step 2: Verify crontab**

```bash
crontab -l | grep vibe
```

Expected: the cron entry above.

- [ ] **Step 3: Create log file with correct permissions**

```bash
sudo touch /var/log/vibe-recipes-cron.log && sudo chown "$(id -u):$(id -g)" /var/log/vibe-recipes-cron.log
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 9 spec sections mapped to tasks. Overview/Scope→T1-T2, Data Model→T2, AI Pipeline→T5-T9, Prompt Design→T7, Public Pages→T12-T13, Admin UI→T4/T10-T11/T14, Environment→T1, File Structure→all tasks, Deployment→T15-T16.
- [x] **Placeholder scan:** No TBD/TODO/implement-later. All steps have complete code.
- [x] **Type consistency:** `SlotResult`, `ValidatedRecipe`, `ClaudeResponse` types used consistently across cron modules. Admin API response shapes match admin page fetch expectations. `Recipe`/`GenerationLog` interfaces in admin match Prisma model fields.
