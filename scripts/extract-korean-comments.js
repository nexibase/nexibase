#!/usr/bin/env node
// Walk src/ recursively, find Korean text that appears inside comments or
// console.*() string literals, and emit a JSON map { "korean": null }.
// Skips: locale/message files, seed-ko.ts, *.css, *.json, _generated files.

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'src')

const SKIP_PATHS = [
  '/messages/',
  '/locales/',
  '/install/seed-ko.ts',
  '_generated',
  '/lib/widgets/_generated-metadata.ts',
  '/plugins/_generated.ts',
]

const HANGUL = /[가-힣]/

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) {
      walk(full, out)
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      if (SKIP_PATHS.some(s => full.includes(s))) continue
      out.push(full)
    }
  }
  return out
}

// Extract potential translation targets from a single line.
// Returns an array of { raw, kind } where raw is the exact string to replace
// and kind is "line-comment" | "block-comment-line" | "inline-block" | "console".
function extract(line) {
  const results = []
  if (!HANGUL.test(line)) return results

  // Line comment: take from `//` to end of line
  const lineCommentMatch = line.match(/^(\s*)(\/\/.*)$/)
  if (lineCommentMatch) {
    const text = lineCommentMatch[2]
    if (HANGUL.test(text)) results.push({ raw: text, kind: 'line-comment' })
    return results
  }

  // JSDoc style: ^\s*\*.*
  const jsdocMatch = line.match(/^(\s*\*\s?)(.*)$/)
  if (jsdocMatch && HANGUL.test(jsdocMatch[2])) {
    // Only if the raw text (after the *) has Hangul; the replacement will
    // preserve the * prefix.
    results.push({ raw: jsdocMatch[2], kind: 'block-comment-line' })
    return results
  }

  // JSX comment {/* ... */} — check first so the inner /* */ below doesn't double-match
  const jsxComments = []
  const jsxRe = /\{\/\*([\s\S]*?)\*\/\}/g
  let jm
  while ((jm = jsxRe.exec(line)) !== null) {
    if (HANGUL.test(jm[0])) {
      results.push({ raw: jm[0], kind: 'jsx-comment' })
      jsxComments.push([jm.index, jm.index + jm[0].length])
    }
  }

  // Inline /* ... */ on a single line — only if NOT inside a jsx comment we already captured
  const inlineRe = /\/\*([^*]|\*(?!\/))*\*\//g
  let im
  while ((im = inlineRe.exec(line)) !== null) {
    const start = im.index
    const end = im.index + im[0].length
    const inside = jsxComments.some(([a, b]) => start >= a && end <= b)
    if (inside) continue
    if (HANGUL.test(im[0])) results.push({ raw: im[0], kind: 'inline-block' })
  }

  // console.(log|error|warn|info)('...')  — only when the string contains Hangul
  const consoleRe = /console\.(?:log|error|warn|info)\(\s*(['"`])((?:\\.|(?!\1).)*?)\1/g
  let cm
  while ((cm = consoleRe.exec(line)) !== null) {
    const quoted = cm[0] // full match e.g. console.error('…')
    const inner = cm[2]
    if (HANGUL.test(inner)) {
      // Store the exact quoted string literal for exact replacement
      results.push({ raw: `${cm[1]}${inner}${cm[1]}`, kind: 'console' })
    }
  }

  return results
}

function main() {
  const files = walk(SRC)
  const map = Object.create(null)
  const counts = Object.create(null)
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    const lines = src.split('\n')
    for (const line of lines) {
      for (const { raw } of extract(line)) {
        if (!(raw in map)) map[raw] = null
        counts[raw] = (counts[raw] || 0) + 1
      }
    }
  }

  // Sort by count desc so the busiest phrases appear first.
  const sorted = Object.keys(map).sort((a, b) => counts[b] - counts[a])
  const output = {}
  for (const k of sorted) output[k] = null

  const outPath = path.join(ROOT, 'scripts', 'korean-translations.json')
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2))

  const totalUnique = sorted.length
  const totalOccurrences = Object.values(counts).reduce((a, b) => a + b, 0)
  console.log(`Extracted ${totalUnique} unique phrases (${totalOccurrences} occurrences) to ${outPath}`)
  console.log(`Top 10 by frequency:`)
  sorted.slice(0, 10).forEach(k => console.log(`  ${counts[k]}×  ${k}`))
}

main()
