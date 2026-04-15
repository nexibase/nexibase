#!/usr/bin/env node
// Apply translations from scripts/korean-translations.json to all src files.
// Only replaces exact matches (comment lines, jsx comments, console strings).
// Skips entries where the value is null.

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

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = fs.statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      if (SKIP_PATHS.some(s => full.includes(s))) continue
      out.push(full)
    }
  }
  return out
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function main() {
  const mapPath = path.join(ROOT, 'scripts', 'korean-translations.json')
  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

  // Prepare entries sorted by length desc so longer phrases are replaced first.
  const entries = Object.entries(map)
    .filter(([, v]) => typeof v === 'string' && v.length > 0)
    .sort((a, b) => b[0].length - a[0].length)

  if (entries.length === 0) {
    console.log('No filled translations found. Fill in korean-translations.json first.')
    return
  }

  const files = walk(SRC)
  let totalReplacements = 0
  let filesChanged = 0

  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8')
    let next = src
    let fileChanges = 0
    for (const [ko, en] of entries) {
      // Global literal replacement using split/join (avoids regex pitfalls).
      if (next.includes(ko)) {
        const parts = next.split(ko)
        fileChanges += parts.length - 1
        next = parts.join(en)
      }
    }
    if (fileChanges > 0) {
      fs.writeFileSync(f, next)
      filesChanged++
      totalReplacements += fileChanges
    }
  }

  console.log(`Replaced ${totalReplacements} occurrence(s) across ${filesChanged} file(s).`)
}

main()
