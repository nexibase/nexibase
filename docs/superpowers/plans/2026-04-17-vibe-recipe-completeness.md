# Vibe-Recipe Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `vibe-coding-recipes` plugin generate complete, working recipes by beefing up the Claude prompt and rejecting structurally incomplete output at validation time.

**Architecture:** Two files in `src/plugins/vibe-coding-recipes/cron/` change. `prompt-builder.ts` gains a stronger widget contract, a reference example snippet, and a corrected beginner-widget difficulty guide. `recipe-validator.ts` gains a `validateRecipeCompleteness()` function that throws on missing critical-file mentions (`.meta.ts`, `plugin.ts`, `{ settings }` prop) and warns on missing quality markers. `generate.ts` calls the new validator in sequence with the existing one.

**Tech Stack:** TypeScript, Node.js (tsx runner), Prisma, Claude API. No test framework is used — verification is via `tsc --noEmit` and manual regeneration through the admin UI.

---

## Spec Reference

Follows `docs/superpowers/specs/2026-04-17-vibe-recipe-completeness-design.md`. Read the spec before starting for problem context.

## File Structure

**Modify:**
- `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts` — expand widget contract, add reference snippet, fix beginner-widget guide
- `src/plugins/vibe-coding-recipes/cron/recipe-validator.ts` — add `validateRecipeCompleteness()` export
- `src/plugins/vibe-coding-recipes/cron/generate.ts` — call new validator after `validateRecipe()`

**No new files, no deletions.**

---

### Task 1: Expand `WIDGET_ARCHITECTURE_CONTEXT` with explicit `.meta.ts` contract

**Files:**
- Modify: `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts` (lines 34-39)

- [ ] **Step 1: Replace the `WIDGET_ARCHITECTURE_CONTEXT` constant**

Open `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts`. Replace lines 34–39 (the current `WIDGET_ARCHITECTURE_CONTEXT` constant) with:

```ts
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
```

- [ ] **Step 2: Type-check**

Run: `cd /home/kagla/_nexibase.com && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompt-builder|recipe-validator|generate\.ts" || echo "clean"`
Expected: `clean` (or no output referencing the three cron files).

- [ ] **Step 3: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/prompt-builder.ts
git commit -m "feat(vibe-recipes): expand widget architecture context in prompt"
```

---

### Task 2: Add reference-example section to user prompt for widget recipes

**Files:**
- Modify: `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts` (inside `buildUserPrompt`, after the architecture context block)

- [ ] **Step 1: Add a `WIDGET_REFERENCE_EXAMPLE` constant near the other constants (after `WIDGET_ARCHITECTURE_CONTEXT`)**

Add this constant immediately after the closing backtick of `WIDGET_ARCHITECTURE_CONTEXT`:

```ts
const WIDGET_REFERENCE_EXAMPLE = `## Reference Example

Below is the real WeatherWidget from src/plugins/weather-widget/. Use it ONLY as a structural anchor — do NOT copy its domain (weather). Follow the same file pair, prop signature, and settingsSchema pattern for whatever widget you are generating.

### widgets/WeatherWidget.meta.ts

\`\`\`ts
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
```

- [ ] **Step 2: Inject the reference in `buildUserPrompt` when type involves a widget**

Locate the line (currently line ~56):

```ts
${slot.type !== 'plugin' ? WIDGET_ARCHITECTURE_CONTEXT : ''}
```

Replace it with:

```ts
${slot.type !== 'plugin' ? WIDGET_ARCHITECTURE_CONTEXT : ''}

${slot.type !== 'plugin' ? WIDGET_REFERENCE_EXAMPLE : ''}
```

- [ ] **Step 3: Type-check**

Run: `cd /home/kagla/_nexibase.com && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompt-builder|recipe-validator|generate\.ts" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/prompt-builder.ts
git commit -m "feat(vibe-recipes): inject WeatherWidget reference example for widget prompts"
```

---

### Task 3: Fix `getDifficultyGuide()` for widget-containing slots

**Files:**
- Modify: `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts` (`getDifficultyGuide`, lines 109–148)

- [ ] **Step 1: Replace the `beginner widget` branch**

Find the block (currently lines 113–119):

```ts
  if (difficulty === 'beginner' && type === 'widget') {
    return `Beginner Widget:
- Single widget component + plugin.ts only
- No schema.prisma, no admin, no API
- Simple self-contained UI (clock, quotes, weather display, counters, etc.)
- 2-3 steps`
  }
```

Replace with:

```ts
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
```

- [ ] **Step 2: Replace the advanced branch**

Find the block (currently lines 140–147):

```ts
  return `Advanced Plugin + Widget:
- Everything from intermediate PLUS:
- Widget component in widgets/ directory
- menus/footer.ts for footer navigation
- External API integration OR complex data relationships
- Multiple public routes (list + detail pages)
- Rich admin UI with filters, stats, or batch operations
- 6-10 steps`
```

Replace with:

```ts
  return `Advanced Plugin + Widget:
- Everything from intermediate PLUS:
- Widget PAIR in widgets/: <Name>.tsx + <Name>.meta.ts (both files required)
- Widget component accepts { settings } prop, never individual props
- menus/footer.ts for footer navigation
- External API integration OR complex data relationships
- Multiple public routes (list + detail pages)
- Rich admin UI with filters, stats, or batch operations
- 6-10 steps`
```

- [ ] **Step 3: Type-check**

Run: `cd /home/kagla/_nexibase.com && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompt-builder|recipe-validator|generate\.ts" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/prompt-builder.ts
git commit -m "fix(vibe-recipes): beginner-widget guide now requires .meta.ts pair"
```

---

### Task 4: Add `validateRecipeCompleteness()` to `recipe-validator.ts`

**Files:**
- Modify: `src/plugins/vibe-coding-recipes/cron/recipe-validator.ts` (append new exported function after `validateRecipe`)

- [ ] **Step 1: Append the new exported function**

Open `src/plugins/vibe-coding-recipes/cron/recipe-validator.ts`. Add this function after `validateRecipe` (after the closing brace of `validateRecipe`, before `ensureUniqueSlug`):

```ts
function concatStepsText(recipe: ValidatedRecipe): string {
  return recipe.stepsEn
    .map((s) => `${s.prompt} ${s.expected}`)
    .join('\n')
    .toLowerCase()
}

export function validateRecipeCompleteness(recipe: ValidatedRecipe): void {
  const haystack = concatStepsText(recipe)
  const hasWidget = recipe.type === 'widget' || recipe.type === 'plugin_with_widget'
  const hasPlugin = recipe.type === 'plugin' || recipe.type === 'plugin_with_widget'

  if (hasWidget) {
    if (!haystack.includes('.meta.ts')) {
      throw new Error('Recipe is missing widget .meta.ts step')
    }
    if (!haystack.includes('{ settings }') && !haystack.includes('settings?:')) {
      throw new Error('Recipe is missing widget { settings } prop signature')
    }
  }

  if (hasPlugin) {
    if (!haystack.includes('plugin.ts')) {
      throw new Error('Recipe is missing plugin.ts step')
    }
  }

  if (recipe.difficulty === 'intermediate' && recipe.type === 'plugin') {
    for (const marker of ['schema.prisma', 'admin/', 'locales/']) {
      if (!haystack.includes(marker)) {
        console.warn(`[vibe-recipes] Intermediate plugin recipe missing marker: ${marker}`)
      }
    }
  }

  if (recipe.difficulty === 'advanced') {
    for (const marker of ['menus/', 'routes/']) {
      if (!haystack.includes(marker)) {
        console.warn(`[vibe-recipes] Advanced recipe missing marker: ${marker}`)
      }
    }
  }
}
```

- [ ] **Step 2: Type-check**

Run: `cd /home/kagla/_nexibase.com && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompt-builder|recipe-validator|generate\.ts" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Smoke-test the function from a one-liner**

Run:

```bash
cd /home/kagla/_nexibase.com && npx tsx -e "
import { validateRecipeCompleteness } from './src/plugins/vibe-coding-recipes/cron/recipe-validator';
try {
  validateRecipeCompleteness({
    slug: 'x', titleEn: 'x', titleKo: 'x', descriptionEn: 'x', descriptionKo: 'x',
    difficulty: 'beginner', type: 'widget',
    constraintsEn: [], constraintsKo: [],
    stepsEn: [{ step: 1, prompt: 'create plugin.ts', expected: 'file' }],
    stepsKo: [{ step: 1, prompt: 'x', expected: 'x' }],
  });
  console.log('FAIL: should have thrown');
} catch (e) { console.log('OK:', (e as Error).message); }
"
```
Expected output: `OK: Recipe is missing widget .meta.ts step`.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/recipe-validator.ts
git commit -m "feat(vibe-recipes): add validateRecipeCompleteness for structural checks"
```

---

### Task 5: Wire `validateRecipeCompleteness` into the generation pipeline

**Files:**
- Modify: `src/plugins/vibe-coding-recipes/cron/generate.ts` (line 10 import, line ~51 call site)

- [ ] **Step 1: Add the new import**

Find line 10:

```ts
import { parseClaudeResponse, validateRecipe, ensureUniqueSlug } from './recipe-validator'
```

Replace with:

```ts
import { parseClaudeResponse, validateRecipe, validateRecipeCompleteness, ensureUniqueSlug } from './recipe-validator'
```

- [ ] **Step 2: Call the new validator after `validateRecipe`**

Find line 51:

```ts
      const validated = validateRecipe(parsed)
      const uniqueSlug = await ensureUniqueSlug(prisma, validated.slug)
```

Replace with:

```ts
      const validated = validateRecipe(parsed)
      validateRecipeCompleteness(validated)
      const uniqueSlug = await ensureUniqueSlug(prisma, validated.slug)
```

- [ ] **Step 3: Type-check**

Run: `cd /home/kagla/_nexibase.com && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "prompt-builder|recipe-validator|generate\.ts" || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/vibe-coding-recipes/cron/generate.ts
git commit -m "feat(vibe-recipes): run completeness validator in generation pipeline"
```

---

### Task 6: Manual verification via admin UI

**Files:** None — this is runtime verification.

- [ ] **Step 1: Start the dev server (if not running)**

Run: `cd /home/kagla/_nexibase.com && npm run dev` (in a separate terminal or background).

- [ ] **Step 2: Open the admin recipes page**

Navigate browser to `http://localhost:3000/admin/vibe-coding-recipes`. Log in as admin if prompted.

- [ ] **Step 3: Trigger generation of a beginner widget recipe**

Click the "Generate" button and select `difficulty=beginner, type=widget`. Wait for it to complete. If the page offers a topic field, set topic to something concrete like "flip clock widget" so you can recognize the output.

- [ ] **Step 4: Inspect the generated recipe's steps**

Open the generated recipe. Confirm that:
- There is a step that creates a file with `.meta.ts` in its path.
- There is a step where the component uses `{ settings }` (or `settings?:`) in its signature.
- Step count is exactly 3.

If any of the above fails, the recipe was persisted despite incomplete output → investigate why `validateRecipeCompleteness` did not throw. Use the generation log (`admin/api/logs/route.ts` output, visible in the admin page) to confirm the validator was invoked.

- [ ] **Step 5: Regenerate the broken countdown-timer recipe**

Find the existing countdown-timer recipe in the admin list. Click Regenerate (or delete it and generate a new beginner-widget recipe with topic "countdown timer"). Confirm the new output includes `.meta.ts` and `{ settings }`.

- [ ] **Step 6: Generate one `plugin_with_widget` advanced recipe and confirm completeness markers**

Set `difficulty=advanced, type=plugin_with_widget`. After it completes, confirm the steps mention `plugin.ts`, `.meta.ts`, `{ settings }`, and — softly — `schema.prisma` / `routes/` / `menus/`. Check the server console for any `console.warn` lines about missing markers; note them for a follow-up PR if the model is frequently skipping quality markers, but do not block this PR on them.

- [ ] **Step 7: No commit — verification only**

If all checks pass, nothing to commit. If a check reveals a bug introduced by this PR, fix it in a new commit before merging.

---

## Self-Review Notes

- Spec coverage: widget contract expansion (Task 1), reference snippet (Task 2), difficulty guide fix (Task 3), completeness validator (Task 4), integration (Task 5), manual verification (Task 6) — all spec sections covered.
- No placeholders: every code step shows the final code verbatim.
- Type consistency: `validateRecipeCompleteness` signature matches the single call site; `ValidatedRecipe` type is already exported from `recipe-validator.ts`.
- No tests added, per spec decision.
