# Vibe-Recipe Code Blocks — Design

**Date:** 2026-04-24
**Scope:** `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts`, `src/plugins/vibe-coding-recipes/cron/recipe-validator.ts`, `src/plugins/vibe-coding-recipes/components/RecipeSteps.tsx`, `package.json`

## Problem

Generated recipes (example: `stock-ticker-widget`) emit `stepsEn[n].prompt` as prose paragraphs. No fenced code blocks, no file layouts, no Prisma models — every field/type/signature is described in running sentences. Two consequences:

1. **Reproducibility is low.** Downstream AI tools receiving the prompt guess field types differently ("decimal" → `Decimal` vs `Float`, "symbols as String array" → `String[]` vs JSON-encoded `String`).
2. **Reader experience is poor.** The recipe detail page renders the prompt inside `<pre>` so what the visitor sees is a wall of text, not a design doc they can skim.

## History

PR #24 (commit `85abd23`, reverted by `aaedbe1` on 2026-04-21) swapped `<pre>` for `react-markdown + remark-gfm` in both recipe description and step prompts. That PR addressed only the **rendering** half of the problem — the generation pipeline still produced prose, so the reader saw the same wall of text with a thin markdown layer on top. It was reverted because it didn't move the needle.

This spec addresses **both halves**: generation (fenced code blocks in every step) **and** rendering (markdown + syntax highlighting so those code blocks are legible).

## Goals

- Every step in every newly-generated recipe has at least one fenced code block in its `prompt` field.
- Code blocks identify the target file path (e.g. `// src/plugins/<slug>/plugin.ts` on the first line) so the reader knows where each snippet goes.
- The recipe detail page renders these code blocks with syntax highlighting, distinct from body prose.
- Validator rejects degenerate responses lacking code blocks so the cron regenerates.
- No data migration. Existing recipes stay as-is; admins can click "Generate" in the admin UI to replace them one-by-one.

## Non-goals

- Executing/compiling generated code in a sandbox.
- Reshaping the stored JSON schema (`stepsEn` / `stepsKo` stay `{step, prompt, expected}`).
- Touching description or constraints rendering — only the step prompts change shape.

## Design

### 1. `prompt-builder.ts` — demand code blocks

Add a new section to `buildUserPrompt` after the existing "Rules" block:

```
## Code Block Requirement (CRITICAL)

Every step's `prompt` field MUST contain at least one fenced code block written in
a format suitable for direct paste into an AI coding tool. The prompt is a
Markdown string rendered to the reader, so combine:

1. A short leading sentence naming the step and target file.
2. At least one fenced code block (```ts, ```tsx, ```prisma, ```json, etc.)
   whose FIRST LINE is a comment identifying the target path, e.g.:
   // src/plugins/<slug>/widgets/<Name>.meta.ts
3. The code block MUST contain the complete file contents — not an outline.
   If a component body is long, include the full component; don't abbreviate
   with `...` or `// TODO` unless the downstream AI can unambiguously finish it.

Do NOT describe field lists or API shapes in prose when a code block can show them.
"Prisma model StockCache with fields id (Int), symbol (String)..." is BAD.
The same content as a ```prisma block is GOOD.
```

Also extend the existing `WIDGET_REFERENCE_EXAMPLE` intro line to reinforce this ("Notice both files are given as complete code blocks, not described in prose").

### 2. `recipe-validator.ts` — enforce code blocks

Extend `validateRecipeCompleteness(recipe)` with a new rule that runs before the existing type/marker checks:

```ts
const FENCE = /```[a-z]*\n/i
for (const steps of [recipe.stepsEn, recipe.stepsKo]) {
  for (const s of steps) {
    if (!FENCE.test(s.prompt)) {
      throw new Error(`Recipe step ${s.step} prompt is missing a fenced code block`)
    }
  }
}
```

Same throw semantics as existing rules — cron retries, admin UI surfaces the error string.

### 3. `RecipeSteps.tsx` — render markdown with highlighting

Current implementation wraps the raw prompt string in `<pre>`. Replace with `react-markdown` + `remark-gfm` + `rehype-highlight`.

Key decisions:

- **Keep the component client-side.** It already is (`'use client'` for the CopyButton); moving to RSC would force splitting CopyButton out and shipping shiki bundles, which is heavier than `rehype-highlight`.
- **`rehype-highlight` over `shiki`.** `rehype-highlight` wraps `highlight.js` (~30kB gzipped for common languages) and runs entirely in the client without a server round-trip. `shiki` produces prettier output but requires either RSC or a WASM bundle.
- **CopyButton copies the raw `s.prompt`**, not the rendered HTML — so the AI-coding-tool flow stays identical.
- **Surrounding container keeps the `bg-muted` card styling** but drops the `<pre>` wrap; `rehype-highlight` adds its own `<pre><code class="hljs language-ts">` structure.
- **Load `highlight.js` CSS once.** Import `highlight.js/styles/github-dark.css` at the top of `RecipeSteps.tsx` so bundling is implicit.

Updated render block:

```tsx
<div className="bg-muted p-3 rounded-md overflow-x-auto prose prose-sm dark:prose-invert max-w-none">
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
    {s.prompt}
  </ReactMarkdown>
</div>
```

### 4. Dependencies

Add to `package.json`:

- `react-markdown` (~20kB gz)
- `remark-gfm` (GFM tables, strikethrough)
- `rehype-highlight` + `highlight.js` (syntax highlighting)

Total added ~60kB gz to the client bundle for this page. Acceptable — the recipe detail page is a leaf route; bundle impact is scoped.

## Testing

1. `npm run lint` + `npx tsc --noEmit` clean.
2. `npm run build` succeeds (catches any SSR/client boundary issues).
3. Generate one new recipe via admin UI "Generate" button (e.g. difficulty=advanced, type=plugin_with_widget). Verify in the database that every step's `prompt` contains at least one fenced code block; verify the detail page renders them with highlighting.
4. Temporarily mutate `validateRecipeCompleteness` test call — or reuse the cron retry flow — to confirm a prompt without fences throws and gets logged as a failure.

Manual because the plugin has no test suite and adding one is out of scope.

## Risk

- **Model produces code blocks but wraps JSON output in them too, breaking `parseClaudeResponse`.** Existing parser already strips leading/trailing ```json fences; verify nested fences inside string values don't confuse `JSON.parse`. JSON encoding handles ``` inside strings fine (it's just backticks), so this should be safe, but watch the first generation result.
- **`rehype-highlight` bundle bloat.** 60kB gz is added only to the recipe detail page. If this becomes a concern, swap to `shiki` + RSC later.
- **Repeat of PR #24 failure mode.** Last revert was because rendering changed without generation changing, so output still looked unchanged. This time generation is the primary lever; rendering is supportive.
- **Old recipes with prose-only prompts render in a `prose` container and look slightly different** (paragraphs instead of `<pre>`). Acceptable — the markdown renderer handles plain text gracefully.

## Files Touched

- `src/plugins/vibe-coding-recipes/cron/prompt-builder.ts` — add "Code Block Requirement" section
- `src/plugins/vibe-coding-recipes/cron/recipe-validator.ts` — add fenced-block check to `validateRecipeCompleteness`
- `src/plugins/vibe-coding-recipes/components/RecipeSteps.tsx` — swap `<pre>` for `ReactMarkdown` with `rehype-highlight`
- `package.json` + `package-lock.json` — add `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`
