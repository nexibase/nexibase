# User Withdrawal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship user-initiated account withdrawal with plugin-declared data policy, build-time validation, and 2-phase execution per the design doc at `docs/superpowers/specs/2026-04-23-user-withdrawal-design.md`.

**Architecture:** On withdrawal, anonymize the User row (email/nickname rewritten to release unique constraints) while preserving the row id so FK references remain valid. Per-plugin `withdrawal-policy.ts` files declare how each User-referencing model is handled (retain / delete / retain-via-parent / custom). A build-time validator scans every plugin Prisma schema and fails the build if any User reference lacks a declaration. Phase 1 is synchronous (anonymize + Account delete + insert withdrawal_jobs row); Phase 2 is fire-and-forget batched cleanup driven by the aggregated policy manifest.

**Tech Stack:** Next.js 15 App Router, Prisma ORM (MySQL dev.db), NextAuth v4, React, TypeScript, Node.js (scan-plugins.js code generator).

---

## Task 1: Add `WithdrawalJob` Prisma model

**Files:**
- Modify: `prisma/schema.base.prisma`

- [ ] **Step 1: Open the base schema and locate the end-of-User-related section**

Run:
```bash
grep -n "@@map(\"users\")" prisma/schema.base.prisma
```

Expected: one line number (the closing line of the User model). New model will be added immediately after the `Account` model (near lines 46–80) to keep user-related models together.

- [ ] **Step 2: Append the `WithdrawalJob` model to `prisma/schema.base.prisma`**

Insert after the Account model (or at end of file if simpler):

```prisma
/// Audit log + retry queue for user withdrawals. One row per withdrawal event. Retained indefinitely.
model WithdrawalJob {
  id           Int       @id @default(autoincrement())
  userId       Int
  status       String    @default("pending") @db.VarChar(20)   // 'pending' | 'running' | 'done' | 'failed'
  attempts     Int       @default(0)
  lastError    String?   @db.Text
  reasonCode   String?   @db.VarChar(40)                         // 'rarely_used' | 'no_feature' | 'moved_service' | 'privacy' | 'other' | null
  reasonText   String?   @db.VarChar(500)                        // free text when reasonCode = 'other'
  createdAt    DateTime  @default(now())
  startedAt    DateTime?
  completedAt  DateTime?
  user         User      @relation(fields: [userId], references: [id])

  @@index([status, createdAt])
  @@index([userId])
  @@map("withdrawal_jobs")
}
```

- [ ] **Step 3: Add the back-relation to the User model**

In the same file, inside the `User { ... }` block, add `withdrawalJobs WithdrawalJob[]` alongside the other relation fields (e.g., near `accounts Account[]`).

- [ ] **Step 4: Regenerate the merged schema and Prisma client**

Run:
```bash
node scripts/scan-plugins.js && npx prisma generate
```

Expected: `[scan-plugins] Merged N plugin schema(s)` and Prisma client regenerated without errors.

- [ ] **Step 5: Create and apply the migration**

Run:
```bash
npx prisma migrate dev --name add_withdrawal_jobs
```

Expected: migration SQL generated in `prisma/migrations/YYYYMMDD_add_withdrawal_jobs/migration.sql`, applied to dev.db. No errors.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.base.prisma prisma/schema.prisma prisma/migrations/
git commit -m "feat(withdrawal): add WithdrawalJob model

Audit log + retry queue table for user withdrawals. One row per
withdrawal with status/attempts/reason columns.

---

회원 탈퇴 감사 로그 겸 재시도 큐 테이블 추가. 탈퇴 1건당 1행,
상태/시도 횟수/사유 컬럼 포함."
```

---

## Task 2: Withdrawal types + core policy file

**Files:**
- Create: `src/lib/withdrawal/types.ts`
- Create: `src/lib/core-withdrawal-policy.ts`

- [ ] **Step 1: Create `src/lib/withdrawal/types.ts`**

```ts
export type UserDataPolicyKind =
  | 'retain'              // row kept; User is anonymized via join
  | 'retain-via-parent'   // row kept because its parent model is kept
  | 'delete'              // row deleted on withdrawal
  | 'custom'              // handler function handles it

export interface BaseWithdrawalEntry {
  model: string                     // Prisma model name as written in schema
  reason?: string                   // human-readable justification, surfaced in admin audit page
}

export interface RetainEntry extends BaseWithdrawalEntry {
  policy: 'retain'
}

export interface RetainViaParentEntry extends BaseWithdrawalEntry {
  policy: 'retain-via-parent'
  parent: string                    // model name whose lifetime governs this one
}

export interface DeleteEntry extends BaseWithdrawalEntry {
  policy: 'delete'
  field?: string                    // user-id column (defaults to 'userId')
}

export interface CustomEntry extends BaseWithdrawalEntry {
  policy: 'custom'
  handler: string                   // name of exported function from plugin's cleanup module
}

export type WithdrawalPolicyEntry =
  | RetainEntry
  | RetainViaParentEntry
  | DeleteEntry
  | CustomEntry

export interface PluginWithdrawalPolicy {
  plugin: string                    // plugin folder name, or 'core'
  entries: WithdrawalPolicyEntry[]
}
```

- [ ] **Step 2: Create `src/lib/core-withdrawal-policy.ts`**

```ts
// Core (non-plugin) models that reference User.id. Treated by the validator as
// a pseudo-plugin named 'core'. Edit this file when core schema adds or removes
// any User-referencing model.

export default [
  { model: 'UserAddress',            policy: 'delete' },
  { model: 'Notification',           policy: 'delete' },
  { model: 'NotificationPreference', policy: 'delete' },
  { model: 'Account',                policy: 'delete', reason: 'Also deleted in Phase 1 for immediate OAuth unlink; Phase 2 re-run is idempotent' },
  { model: 'Conversation',           policy: 'retain', reason: 'Other participant\'s conversation record is preserved; withdrawn user rendered as 탈퇴한회원_xxxxxx via User join' },
  { model: 'Message',                policy: 'retain', reason: 'Conversation history preserved; sender anonymized via User join' },
  { model: 'WithdrawalJob',          policy: 'retain', reason: 'This IS the withdrawal audit record; retaining our own row is correct' },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/withdrawal/types.ts src/lib/core-withdrawal-policy.ts
git commit -m "feat(withdrawal): add policy types and core declarations

Types module defines WithdrawalPolicyEntry (retain/retain-via-parent/
delete/custom). Core policy file covers User-referencing models that
live in prisma/schema.base.prisma (UserAddress, Notification, Account,
Conversation, Message, WithdrawalJob).

---

탈퇴 정책 타입 모듈과 코어 선언 파일 추가. 코어 스키마에 있는 User
참조 모델(주소록/알림/계정/대화/메시지/탈퇴잡)의 처리 방식 명시."
```

---

## Task 3: Plugin `withdrawal-policy.ts` — shop

**Files:**
- Create: `src/plugins/shop/withdrawal-policy.ts`

- [ ] **Step 1: Verify which shop models reference User**

Run:
```bash
grep -nE "userId\s+Int|user\s+User" src/plugins/shop/schema.prisma | head -20
```

Expected: Order.userId, PendingOrder.userId, ProductReview.userId, ProductQna.userId, Wishlist.userId. OrderItem/OrderActivity reference Order (not User directly).

- [ ] **Step 2: Create `src/plugins/shop/withdrawal-policy.ts`**

```ts
export default [
  { model: 'Order',         policy: 'retain',
    reason: '전자상거래법 — 계약/결제/재화공급 기록 5년 보관 의무' },
  { model: 'OrderItem',     policy: 'retain-via-parent', parent: 'Order' },
  { model: 'OrderActivity', policy: 'retain-via-parent', parent: 'Order' },
  { model: 'ProductReview', policy: 'retain',
    reason: 'Public review; aggregates preserved; anonymized via User join' },
  { model: 'ProductQna',    policy: 'retain',
    reason: 'Product info with admin replies; anonymized via User join' },
  { model: 'Wishlist',      policy: 'delete' },
  { model: 'PendingOrder',  policy: 'delete' },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/shop/withdrawal-policy.ts
git commit -m "feat(shop): declare withdrawal policy

Orders retained 5 years (전자상거래법). Reviews/Q&A retained with
User anonymized. Wishlist and pending orders deleted.

---

shop 플러그인 탈퇴 정책 선언. 주문은 5년 보관, 리뷰/Q&A는 익명화
유지, 위시리스트와 미결제 주문은 삭제."
```

---

## Task 4: Plugin `withdrawal-policy.ts` — boards

**Files:**
- Create: `src/plugins/boards/withdrawal-policy.ts`

- [ ] **Step 1: Verify which boards models reference User**

Run:
```bash
grep -nE "authorId\s+Int|userId\s+Int|user\s+User|author\s+User" src/plugins/boards/schema.prisma | head -20
```

Expected: Post.authorId, Comment.authorId, Reaction.userId. PostAttachment has no direct User ref.

- [ ] **Step 2: Create `src/plugins/boards/withdrawal-policy.ts`**

```ts
export default [
  { model: 'Post',     policy: 'retain',
    reason: 'Public content; anonymized via User join' },
  { model: 'Comment',  policy: 'retain',
    reason: 'Public content; anonymized via User join' },
  { model: 'Reaction', policy: 'retain', field: 'userId',
    reason: 'Affects aggregate like counts; anonymized via User join' },
]
```

- [ ] **Step 3: Commit**

```bash
git add src/plugins/boards/withdrawal-policy.ts
git commit -m "feat(boards): declare withdrawal policy

Posts, comments, reactions all retained with author anonymized via
User join. PostAttachment references Post, no direct User relation.

---

boards 플러그인 탈퇴 정책 선언. 게시글/댓글/반응 모두 작성자
익명화 후 유지."
```

---

## Task 5: Audit remaining plugins + add policies

**Files:**
- Create: `src/plugins/<name>/withdrawal-policy.ts` for each plugin that references User

- [ ] **Step 1: Enumerate candidate plugins**

Run:
```bash
for p in src/plugins/*/schema.prisma; do
  pname=$(basename $(dirname "$p"))
  refs=$(grep -cE "userId\s+Int|authorId\s+Int|user\s+User|author\s+User" "$p" 2>/dev/null || echo 0)
  user_rels=$(test -f "$(dirname "$p")/schema.user.prisma" && wc -l < "$(dirname "$p")/schema.user.prisma" || echo 0)
  echo "$pname: schema-refs=$refs user-rels-lines=$user_rels"
done
```

Expected: a per-plugin summary. Any plugin with non-zero counts and no `withdrawal-policy.ts` yet needs one.

- [ ] **Step 2: For each plugin with User references, create `withdrawal-policy.ts`**

For plugins with no User references (e.g., `weather-widget`, `countdown-timer` if they have no such fields), create an empty declaration:

```ts
export default []
```

For those that reference User, list every such model with a policy. Use `retain` for shared/public content, `delete` for personal-only data. Add `reason` for anything retained.

Example for a blog-like plugin:
```ts
export default [
  { model: 'Article', policy: 'retain',
    reason: 'Public content; anonymized via User join' },
]
```

- [ ] **Step 3: Verify all plugins are covered**

Run:
```bash
for p in src/plugins/*/; do
  pname=$(basename "$p")
  [ "$pname" = "_generated.ts" ] && continue
  if [ ! -f "$p/withdrawal-policy.ts" ]; then
    echo "MISSING: $pname"
  fi
done
```

Expected: no output (every plugin has a policy file, even if `[]`).

- [ ] **Step 4: Commit**

```bash
git add src/plugins/*/withdrawal-policy.ts
git commit -m "feat(plugins): declare withdrawal policy for remaining plugins

Every plugin directory now has a withdrawal-policy.ts. Plugins with
no User references declare an empty array.

---

남은 플러그인에도 탈퇴 정책 선언. User 참조 없는 플러그인은
빈 배열 선언."
```

---

## Task 6: Extend `scan-plugins.js` to emit aggregated policy registry

**Files:**
- Modify: `scripts/scan-plugins.js`
- Create: `src/lib/withdrawal/_generated-policies.ts` (generated artifact)

- [ ] **Step 1: Add policy aggregation function to `scan-plugins.js`**

Insert these constants near the top of the file (after existing constants):

```javascript
const WITHDRAWAL_POLICIES_OUTPUT = path.join(__dirname, '..', 'src', 'lib', 'withdrawal', '_generated-policies.ts')
const CORE_POLICY_FILE = path.join(__dirname, '..', 'src', 'lib', 'core-withdrawal-policy.ts')
```

Insert this function near other generator functions (e.g., after `mergeSchemas`):

```javascript
function evalPolicyFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  // Discard everything before `export default` (including leading comments),
  // then evaluate the remaining array literal. Keeping the expression
  // semantically isolated avoids `return // ...` commenting out the value.
  const m = content.match(/export\s+default\s+/)
  if (!m) {
    console.error(`[scan-plugins] ${filePath}: no 'export default' found`)
    process.exit(1)
  }
  const arrayStr = content.slice(m.index + m[0].length).trim()
  try {
    return (new Function('return ' + arrayStr))()
  } catch (e) {
    console.error(`[scan-plugins] Failed to parse ${filePath}: ${e.message}`)
    process.exit(1)
  }
}

function generateWithdrawalPolicies(plugins) {
  const result = {}

  // Core policy
  if (fs.existsSync(CORE_POLICY_FILE)) {
    result.core = evalPolicyFile(CORE_POLICY_FILE)
  } else {
    console.error(`[scan-plugins] Missing ${CORE_POLICY_FILE}`)
    process.exit(1)
  }

  // Per-plugin policies
  for (const p of plugins) {
    const policyFile = path.join(PLUGINS_DIR, p.folder, 'withdrawal-policy.ts')
    if (!fs.existsSync(policyFile)) {
      console.error(`[scan-plugins] Plugin '${p.folder}' has no withdrawal-policy.ts. Every plugin must declare withdrawal policy (empty array is OK if there are no User references).`)
      process.exit(1)
    }
    result[p.folder] = evalPolicyFile(policyFile)
  }

  const output = `// AUTO-GENERATED by scripts/scan-plugins.js — do not edit manually
import type { WithdrawalPolicyEntry } from './types'

export const pluginWithdrawalPolicies: Record<string, WithdrawalPolicyEntry[]> = ${JSON.stringify(result, null, 2)}
`
  const outDir = path.dirname(WITHDRAWAL_POLICIES_OUTPUT)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(WITHDRAWAL_POLICIES_OUTPUT, output, 'utf-8')
  const total = Object.values(result).reduce((n, arr) => n + arr.length, 0)
  console.log(`[scan-plugins] Generated withdrawal policies: ${Object.keys(result).length} source(s), ${total} entries → ${WITHDRAWAL_POLICIES_OUTPUT}`)
}
```

- [ ] **Step 2: Call the new function from `scanPlugins()`**

Inside the existing `scanPlugins()` function, near the bottom where other generators are called (after `mergeSchemas(plugins)`):

```javascript
generateWithdrawalPolicies(plugins)
```

- [ ] **Step 3: Run the scanner**

Run:
```bash
node scripts/scan-plugins.js
```

Expected: a new line `[scan-plugins] Generated withdrawal policies: N source(s), M entries`. No errors.

- [ ] **Step 4: Inspect the generated file**

Run:
```bash
cat src/lib/withdrawal/_generated-policies.ts
```

Expected: a TypeScript file with `pluginWithdrawalPolicies` containing entries for `core`, `shop`, `boards`, and every other plugin folder.

- [ ] **Step 5: Add generated file to .gitignore if other _generated files are ignored**

Run:
```bash
grep -E "_generated" .gitignore
```

If `_generated-*.ts` files are ignored (they should be — they are build artifacts), add `src/lib/withdrawal/_generated-policies.ts` to the same pattern. If not ignored, skip this step.

- [ ] **Step 6: Commit the scanner changes**

```bash
git add scripts/scan-plugins.js .gitignore
git commit -m "feat(withdrawal): aggregate plugin policies in build scanner

scan-plugins.js now reads each plugin's withdrawal-policy.ts and the
core-withdrawal-policy.ts, emitting src/lib/withdrawal/_generated-
policies.ts. Fails the build if any plugin directory is missing a
policy file.

---

빌드 스캐너가 각 플러그인의 withdrawal-policy.ts와 core-withdrawal-
policy.ts를 취합해 _generated-policies.ts로 생성. 정책 파일이 없는
플러그인은 빌드 실패."
```

---

## Task 7: Prisma schema validator — detect undeclared User references

**Files:**
- Create: `scripts/validate-withdrawal-policy.js`
- Modify: `scripts/scan-plugins.js` (call validator after merge)

- [ ] **Step 1: Create `scripts/validate-withdrawal-policy.js`**

```javascript
// Scans each plugin's schema.prisma + schema.user.prisma for models referencing
// User.id and verifies that the plugin's withdrawal-policy.ts declares every
// such model. Also validates the core (prisma/schema.base.prisma).
// Exits with non-zero status on any undeclared reference.

const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const PLUGINS_DIR = path.join(ROOT, 'src', 'plugins')
const CORE_SCHEMA = path.join(ROOT, 'prisma', 'schema.base.prisma')
const CORE_POLICY = path.join(ROOT, 'src', 'lib', 'core-withdrawal-policy.ts')

// Parse Prisma schema text; return an array of { model, refsUser: true/false }.
// A model "references User" if it has a relation field whose target is the
// `User` model. We detect this by scanning for `SomeField User @relation(...)`
// or `SomeField User?` inside a `model X { ... }` block. This is a pragmatic
// regex-based parser; it matches the conventions used across this codebase.
function parseModelsWithUserRefs(text) {
  const modelRegex = /model\s+(\w+)\s*{([^}]*)}/gs
  const results = []
  let match
  while ((match = modelRegex.exec(text)) !== null) {
    const name = match[1]
    const body = match[2]
    const refsUser = /\n\s*\w+\s+User(\??|\[\])\b/.test(body) ||
                     /@relation\s*\([^)]*references:\s*\[id\][^)]*\).*/.test(body) && /User\s*@relation/.test(body)
    if (refsUser) results.push({ name })
  }
  return results
}

function evalPolicyFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const m = content.match(/export\s+default\s+/)
  if (!m) {
    console.error(`[withdrawal-validator] ${filePath}: no 'export default' found`)
    process.exit(1)
  }
  const arrayStr = content.slice(m.index + m[0].length).trim()
  return (new Function('return ' + arrayStr))()
}

function validateSource(label, schemaText, policyEntries) {
  const declaredModels = new Set(policyEntries.map(e => e.model))
  const missing = []
  for (const { name } of parseModelsWithUserRefs(schemaText)) {
    if (name === 'User') continue       // User itself is the referenced model, not a reference
    if (!declaredModels.has(name)) missing.push(name)
  }
  return missing
}

function main() {
  const errors = []

  // --- Core ---
  const coreSchemaText = fs.readFileSync(CORE_SCHEMA, 'utf-8')
  const corePolicy = evalPolicyFile(CORE_POLICY)
  const coreMissing = validateSource('core', coreSchemaText, corePolicy)
  for (const m of coreMissing) {
    errors.push(`core: model '${m}' references User but is not declared in src/lib/core-withdrawal-policy.ts`)
  }

  // --- Plugins ---
  const plugins = fs.readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('_'))
    .map(e => e.name)

  for (const folder of plugins) {
    const policyPath = path.join(PLUGINS_DIR, folder, 'withdrawal-policy.ts')
    if (!fs.existsSync(policyPath)) {
      errors.push(`${folder}: missing withdrawal-policy.ts`)
      continue
    }
    const policy = evalPolicyFile(policyPath)
    let combined = ''
    const schemaPath = path.join(PLUGINS_DIR, folder, 'schema.prisma')
    const userSchemaPath = path.join(PLUGINS_DIR, folder, 'schema.user.prisma')
    if (fs.existsSync(schemaPath)) combined += fs.readFileSync(schemaPath, 'utf-8') + '\n'
    if (fs.existsSync(userSchemaPath)) combined += fs.readFileSync(userSchemaPath, 'utf-8') + '\n'
    if (!combined.trim()) continue

    const missing = validateSource(folder, combined, policy)
    for (const m of missing) {
      errors.push(`${folder}: model '${m}' references User but is not declared in src/plugins/${folder}/withdrawal-policy.ts`)
    }
  }

  if (errors.length > 0) {
    console.error('')
    console.error('[withdrawal-validator] Build failed — undeclared User references:')
    for (const e of errors) console.error('  ✗ ' + e)
    console.error('')
    console.error('Every model that has a User relation must declare a withdrawal policy.')
    console.error('See docs/superpowers/specs/2026-04-23-user-withdrawal-design.md §2.')
    process.exit(1)
  }
  const totalPluginCount = plugins.length + 1 // +1 for core
  console.log(`[withdrawal-validator] ✓ Checked ${totalPluginCount} source(s); all User references declared`)
}

main()
```

- [ ] **Step 2: Hook validator into `scan-plugins.js`**

In `scripts/scan-plugins.js`, inside `scanPlugins()`, after `generateWithdrawalPolicies(plugins)`:

```javascript
require('./validate-withdrawal-policy')
```

**Note:** requiring the script runs its `main()` at require time, which calls `process.exit(1)` on failure — the desired behavior.

- [ ] **Step 3: Run full build scan**

Run:
```bash
node scripts/scan-plugins.js
```

Expected: `[withdrawal-validator] ✓ Checked N source(s); all User references declared`. No errors.

- [ ] **Step 4: Test the negative case**

Temporarily rename a plugin's policy file and re-run:

```bash
mv src/plugins/shop/withdrawal-policy.ts src/plugins/shop/withdrawal-policy.ts.bak
node scripts/scan-plugins.js; echo "exit=$?"
mv src/plugins/shop/withdrawal-policy.ts.bak src/plugins/shop/withdrawal-policy.ts
```

Expected: scan fails with `shop: missing withdrawal-policy.ts` and exit code 1.

- [ ] **Step 5: Test the undeclared-model case**

Temporarily remove one entry from `src/plugins/shop/withdrawal-policy.ts`:

```bash
# Remove the last entry from the array and re-run:
node scripts/scan-plugins.js; echo "exit=$?"
# Restore it via git:
git checkout -- src/plugins/shop/withdrawal-policy.ts
```

Expected: scan fails with `shop: model 'PendingOrder' references User but is not declared` and exit code 1.

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-withdrawal-policy.js scripts/scan-plugins.js
git commit -m "feat(withdrawal): build-time validator for User references

scripts/validate-withdrawal-policy.js parses Prisma schemas and
enforces that every model with a User relation has a declared
withdrawal policy. Hooked into scan-plugins.js so \`npm run dev\` and
\`npm run build\` both fail on any undeclared reference.

---

빌드 타임 검증기 추가. User 관계가 있는 모든 모델은 탈퇴 정책을
선언해야 하며, 누락 시 빌드가 실패한다."
```

---

## Task 8: Preview module — count rows by policy category

**Files:**
- Create: `src/lib/withdrawal/preview.ts`

- [ ] **Step 1: Create `src/lib/withdrawal/preview.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { pluginWithdrawalPolicies } from './_generated-policies'
import type { WithdrawalPolicyEntry } from './types'

export interface PreviewRow {
  plugin: string
  model: string
  count: number
  reason?: string
  retentionYears?: number
}

export interface WithdrawalPreview {
  toDelete: PreviewRow[]
  toRetainAnonymized: PreviewRow[]
  toRetainLegal: PreviewRow[]
}

// Maps model name (as declared in the policy) to the Prisma client accessor
// (camelCase with initial lowercase). Example: 'OrderActivity' -> 'orderActivity'.
function prismaAccessor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function userField(entry: WithdrawalPolicyEntry): string {
  return ('field' in entry && entry.field) ? entry.field : 'userId'
}

async function countForEntry(userId: number, entry: WithdrawalPolicyEntry): Promise<number> {
  const accessor = prismaAccessor(entry.model)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (prisma as any)[accessor]
  if (!client || typeof client.count !== 'function') return 0
  const field = userField(entry)
  try {
    return await client.count({ where: { [field]: userId } })
  } catch {
    // If the field doesn't exist (e.g., 'retain-via-parent' models),
    // the count would throw. Return 0 — these rows are counted via their parent.
    return 0
  }
}

function isLegalRetention(entry: WithdrawalPolicyEntry): number | null {
  // Orders are retained 5 years under 전자상거래법. This is the only legally-mandated
  // retention at present; extend here if more plugins add legal-retention models.
  if (entry.model === 'Order') return 5
  return null
}

export async function buildWithdrawalPreview(userId: number): Promise<WithdrawalPreview> {
  const preview: WithdrawalPreview = { toDelete: [], toRetainAnonymized: [], toRetainLegal: [] }

  for (const [plugin, entries] of Object.entries(pluginWithdrawalPolicies)) {
    for (const entry of entries) {
      // Skip retain-via-parent: their count is represented by the parent row.
      if (entry.policy === 'retain-via-parent') continue
      // For 'custom', count via parent rule may not apply; the handler may be complex.
      // For preview we display the parent model's count only; custom models are
      // out-of-preview and shown in admin audit page instead.
      if (entry.policy === 'custom') continue

      const count = await countForEntry(userId, entry)
      if (count === 0) continue

      const row: PreviewRow = { plugin, model: entry.model, count, reason: entry.reason }
      const legalYears = isLegalRetention(entry)

      if (entry.policy === 'delete') {
        preview.toDelete.push(row)
      } else if (legalYears !== null) {
        preview.toRetainLegal.push({ ...row, retentionYears: legalYears })
      } else {
        preview.toRetainAnonymized.push(row)
      }
    }
  }
  return preview
}
```

- [ ] **Step 2: Quick smoke test in dev shell**

Run:
```bash
node -e "require('tsx/cjs'); require('./src/lib/withdrawal/preview.ts').buildWithdrawalPreview(1).then(p => console.log(JSON.stringify(p, null, 2))).finally(() => process.exit(0))"
```

Expected: a JSON preview object. If userId 1 has no data in your dev DB, all three arrays are empty — that is success (no crash).

- [ ] **Step 3: Commit**

```bash
git add src/lib/withdrawal/preview.ts
git commit -m "feat(withdrawal): build preview counts from policy manifest

Preview iterates aggregated policy entries, counts rows per model,
and groups by delete / retain-anonymized / retain-legal. Used by the
withdrawal confirmation page.

---

탈퇴 미리보기 모듈 추가. 정책 매니페스트를 순회해 모델별 건수를
세고 삭제/익명화유지/법정유지로 분류."
```

---

## Task 9: Execute module — Phase 1 anonymization

**Files:**
- Create: `src/lib/withdrawal/execute.ts`

- [ ] **Step 1: Create `src/lib/withdrawal/execute.ts` with Phase 1 only**

```ts
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

export interface WithdrawalInput {
  userId: number
  reasonCode?: string | null
  reasonText?: string | null
}

/**
 * Phase 1: synchronous anonymization. Runs inside a single transaction.
 * After this returns, the User's personal info is destroyed, their OAuth
 * accounts are unlinked, and a withdrawal_jobs row exists for Phase 2.
 */
export async function executeWithdrawalPhase1(input: WithdrawalInput): Promise<{ jobId: number }> {
  const { userId, reasonCode, reasonText } = input
  const token = crypto.randomBytes(8).toString('hex').slice(0, 12)        // stable random per withdrawal
  const anonEmail = `deleted_${token}@deleted.local`
  const anonNickname = `탈퇴한회원_${token.slice(0, 6)}`

  return await prisma.$transaction(async tx => {
    await tx.user.update({
      where: { id: userId },
      data: {
        email: anonEmail,
        nickname: anonNickname,
        name: null,
        phone: null,
        image: null,
        password: null,
        provider: null,
        providerId: null,
        emailVerified: null,
        lastLoginIp: null,
        status: 'withdrawn',
        deletedAt: new Date(),
      },
    })
    await tx.account.deleteMany({ where: { userId } })
    const job = await tx.withdrawalJob.create({
      data: {
        userId,
        status: 'pending',
        reasonCode: reasonCode || null,
        reasonText: reasonText || null,
      },
    })
    return { jobId: job.id }
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/withdrawal/execute.ts
git commit -m "feat(withdrawal): Phase 1 synchronous anonymization

Anonymizes User row (email/nickname/name/phone/image/password/OAuth
providerId cleared), deletes all Account rows, and inserts the
withdrawal_jobs audit row. Runs in a single transaction.

---

Phase 1 동기 익명화 모듈. User 행의 개인정보를 덮어쓰고, OAuth 연동
을 삭제하고, 탈퇴잡 감사 행을 생성한다. 단일 트랜잭션."
```

---

## Task 10: Execute module — Phase 2 batched cleanup

**Files:**
- Modify: `src/lib/withdrawal/execute.ts`

- [ ] **Step 1: Append Phase 2 logic to `src/lib/withdrawal/execute.ts`**

Add these imports at the top of the file:

```ts
import { pluginWithdrawalPolicies } from './_generated-policies'
import type { WithdrawalPolicyEntry } from './types'
```

Then append these functions below the Phase 1 function:

```ts
const BATCH_SIZE = 500

function prismaAccessor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function userField(entry: WithdrawalPolicyEntry): string {
  return ('field' in entry && entry.field) ? entry.field : 'userId'
}

async function deleteBatched(model: string, field: string, userId: number): Promise<number> {
  const accessor = prismaAccessor(model)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = (prisma as any)[accessor]
  if (!client || typeof client.deleteMany !== 'function') return 0
  let totalDeleted = 0
  // deleteMany with a LIMIT isn't natively supported by Prisma on MySQL; we
  // issue it in a loop with findMany+deleteMany to keep batches bounded.
  // If findMany returns fewer than BATCH_SIZE rows, we're done.
  while (true) {
    const rows: Array<{ id: number }> = await client.findMany({
      where: { [field]: userId },
      select: { id: true },
      take: BATCH_SIZE,
    })
    if (rows.length === 0) break
    const ids = rows.map(r => r.id)
    const res = await client.deleteMany({ where: { id: { in: ids } } })
    totalDeleted += res.count
    if (rows.length < BATCH_SIZE) break
  }
  return totalDeleted
}

/**
 * Phase 2: asynchronous cleanup. Iterates the policy manifest and deletes
 * rows for each `policy='delete'` entry. Idempotent — safe to re-run.
 * Invokes `custom` handlers via dynamic plugin import.
 */
export async function executeWithdrawalPhase2(jobId: number): Promise<void> {
  const job = await prisma.withdrawalJob.findUnique({ where: { id: jobId } })
  if (!job) throw new Error(`withdrawal job ${jobId} not found`)
  if (job.status === 'done') return

  await prisma.withdrawalJob.update({
    where: { id: jobId },
    data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
  })

  try {
    for (const [plugin, entries] of Object.entries(pluginWithdrawalPolicies)) {
      for (const entry of entries) {
        if (entry.policy === 'delete') {
          await deleteBatched(entry.model, userField(entry), job.userId)
        } else if (entry.policy === 'custom') {
          const mod = plugin === 'core'
            ? await import('@/lib/withdrawal/handlers')
            : await import(`@/plugins/${plugin}/cleanup`)
          const handler = (mod as Record<string, unknown>)[entry.handler]
          if (typeof handler !== 'function') {
            throw new Error(`Plugin '${plugin}' custom handler '${entry.handler}' not exported`)
          }
          await (handler as (userId: number) => Promise<void>)(job.userId)
        }
      }
    }
    await prisma.withdrawalJob.update({
      where: { id: jobId },
      data: { status: 'done', completedAt: new Date(), lastError: null },
    })
  } catch (err) {
    await prisma.withdrawalJob.update({
      where: { id: jobId },
      data: { status: 'failed', lastError: err instanceof Error ? err.message : String(err) },
    })
    throw err
  }
}
```

- [ ] **Step 2: Confirm types compile**

Run:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "withdrawal/execute|error" | head -20
```

Expected: no errors related to `src/lib/withdrawal/execute.ts`. Pre-existing unrelated errors (if any) can be ignored.

- [ ] **Step 3: Commit**

```bash
git add src/lib/withdrawal/execute.ts
git commit -m "feat(withdrawal): Phase 2 batched cleanup

Iterates aggregated policy entries, deletes rows for policy='delete'
in 500-row batches, invokes custom handlers via dynamic import.
Idempotent on re-run. Updates withdrawal_jobs status to 'done' or
'failed'.

---

Phase 2 배치 정리 모듈. policy='delete' 항목을 500행 배치로 삭제,
custom 핸들러는 동적 임포트로 호출. 재실행 시 idempotent. 완료/실패
를 withdrawal_jobs 상태에 기록."
```

---

## Task 11: Session invalidation for withdrawn users

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: Open `src/lib/auth.ts` and locate `getSession` + `getAuthUser`**

Run:
```bash
grep -n "findUnique" src/lib/auth.ts
```

Expected: two or three matches in the session-lookup helpers.

- [ ] **Step 2: Filter by status in `getSession`**

Replace the `findUnique` block in `getSession` (around lines 12–22). Change from `findUnique({ where: { email } })` to `findFirst({ where: { email, status: { not: 'withdrawn' } } })`:

```ts
const user = await prisma.user.findFirst({
  where: {
    email: nextAuthSession.user.email,
    status: { not: 'withdrawn' },
  },
  select: {
    id: true,
    email: true,
    nickname: true,
    role: true,
  }
});
```

- [ ] **Step 3: Filter by status in `getAuthUser`**

Apply the same change to `getAuthUser`:

```ts
const user = await prisma.user.findFirst({
  where: {
    email: nextAuthSession.user.email,
    status: { not: 'withdrawn' },
  },
});
```

- [ ] **Step 4: Verify changes**

Run:
```bash
grep -A 3 "findFirst" src/lib/auth.ts | head -30
```

Expected: two `findFirst` blocks with `status: { not: 'withdrawn' }`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): refuse session for withdrawn users

getSession and getAuthUser now filter by status != 'withdrawn'. An
anonymized (withdrawn) user's leftover session token fails lookup
because the original email no longer matches any active user row.

---

탈퇴된 사용자의 세션 조회를 거부. getSession/getAuthUser에서
status != 'withdrawn' 조건 추가. 익명화된 사용자의 잔여 세션 토큰은
원래 이메일을 찾지 못해 자동 무효화된다."
```

---

## Task 12: API route `GET /api/me/withdraw/preview`

**Files:**
- Create: `src/app/api/me/withdraw/preview/route.ts`

- [ ] **Step 1: Create the route file**

```ts
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { buildWithdrawalPreview } from '@/lib/withdrawal/preview'

export async function GET() {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const preview = await buildWithdrawalPreview(user.id)
  return NextResponse.json(preview)
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server:

```bash
npm run dev
```

In another shell, while logged in with a session cookie:

```bash
curl -s -b "<cookie>" http://localhost:3000/api/me/withdraw/preview | head -30
```

Expected: JSON `{ toDelete: [...], toRetainAnonymized: [...], toRetainLegal: [...] }`. Without a session cookie, expect `{ "error": "unauthorized" }` with status 401.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/me/withdraw/preview/route.ts
git commit -m "feat(withdrawal): GET /api/me/withdraw/preview

Returns per-category row counts for the logged-in user: toDelete,
toRetainAnonymized, toRetainLegal. Consumed by the withdrawal
confirmation page.

---

탈퇴 미리보기 API 추가. 로그인 사용자 기준으로 삭제/익명화유지/
법정유지 카테고리별 모델 건수를 반환한다."
```

---

## Task 13: API route `POST /api/me/withdraw`

**Files:**
- Create: `src/app/api/me/withdraw/route.ts`

- [ ] **Step 1: Check existing password verification helper**

Run:
```bash
grep -nE "verifyPBKDF2|verifyPassword|bcrypt.compare" src/lib/auth.ts | head -5
```

Expected: a verify function name. Use that for the password check below. If the file uses `verifyPBKDF2Hash(password, stored)`, reference that name exactly.

- [ ] **Step 2: Create `src/app/api/me/withdraw/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, verifyPBKDF2Hash } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { executeWithdrawalPhase1, executeWithdrawalPhase2 } from '@/lib/withdrawal/execute'

const ALLOWED_REASON_CODES = new Set(['rarely_used', 'no_feature', 'moved_service', 'privacy', 'other'])

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { password, reasonCode, reasonText } = body as {
    password?: string
    reasonCode?: string
    reasonText?: string
  }

  // Password verification: required if the user has a local password.
  if (user.password) {
    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json({ error: 'password_required' }, { status: 400 })
    }
    if (!verifyPBKDF2Hash(password, user.password)) {
      return NextResponse.json({ error: 'invalid_password' }, { status: 401 })
    }
  }
  // OAuth-only users: password is null. Current session cookie itself is the
  // re-verification (they are logged in). Additional OAuth re-auth can be
  // added later if stricter verification is required.

  // Reason validation
  if (reasonCode !== undefined && !ALLOWED_REASON_CODES.has(reasonCode)) {
    return NextResponse.json({ error: 'invalid_reason_code' }, { status: 400 })
  }
  if (reasonText !== undefined && typeof reasonText !== 'string') {
    return NextResponse.json({ error: 'invalid_reason_text' }, { status: 400 })
  }
  if (reasonText && reasonText.length > 500) {
    return NextResponse.json({ error: 'reason_text_too_long' }, { status: 400 })
  }
  if (reasonCode !== 'other' && reasonText) {
    // Only keep textual reason when code is 'other'
    body.reasonText = null
  }

  const { jobId } = await executeWithdrawalPhase1({
    userId: user.id,
    reasonCode: reasonCode || null,
    reasonText: reasonCode === 'other' ? (reasonText || null) : null,
  })

  // Fire-and-forget Phase 2. Explicitly unawaited — do not block the response.
  // Errors are captured by executeWithdrawalPhase2 into withdrawal_jobs.status='failed'.
  void executeWithdrawalPhase2(jobId).catch(err => {
    console.error(`[withdrawal] Phase 2 failed for job ${jobId}:`, err)
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Verify import of `verifyPBKDF2Hash` matches the actual export**

Run:
```bash
grep -nE "export (const|function) verifyPBKDF2Hash" src/lib/auth.ts
```

If the export name differs (e.g., `verifyPassword`), update the import in the route file accordingly.

- [ ] **Step 4: Manual end-to-end test**

With dev server running and an authenticated session cookie:

```bash
curl -s -X POST http://localhost:3000/api/me/withdraw \
  -H "Content-Type: application/json" \
  -b "<cookie>" \
  -d '{"password":"<plain password>","reasonCode":"privacy"}'
```

Expected: `{"ok":true}`. Then verify in DB:

```bash
echo "SELECT id, email, nickname, status, deletedAt FROM users WHERE id = <yourId>;" | npx prisma db execute --file /dev/stdin --schema prisma/schema.prisma
echo "SELECT * FROM withdrawal_jobs ORDER BY id DESC LIMIT 1;" | npx prisma db execute --file /dev/stdin --schema prisma/schema.prisma
```

Expected: email is `deleted_<token>@deleted.local`, nickname is `탈퇴한회원_<6chars>`, status is `withdrawn`, and the latest withdrawal_jobs row has status `done` (Phase 2 completed shortly after the response).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/me/withdraw/route.ts
git commit -m "feat(withdrawal): POST /api/me/withdraw

Validates password (PBKDF2) for local accounts, accepts optional
reasonCode + reasonText, runs Phase 1 in-request then kicks off
Phase 2 fire-and-forget. Phase 2 errors are captured into
withdrawal_jobs.lastError for later retry.

---

탈퇴 실행 API 추가. 로컬 계정은 PBKDF2로 비밀번호 검증, 선택적
사유 수신, 요청 내에서 Phase 1 완료 후 Phase 2를 fire-and-forget
실행. Phase 2 오류는 withdrawal_jobs.lastError에 기록."
```

---

## Task 14: Mypage withdrawal UI page

**Files:**
- Create: `src/app/[locale]/mypage/account/withdraw/page.tsx`

- [ ] **Step 1: Check existing mypage patterns**

Run:
```bash
cat src/app/\[locale\]/mypage/profile/edit/page.tsx | head -40
```

Expected: a reference pattern for auth guard, client component structure, and i18n usage.

- [ ] **Step 2: Create the withdrawal page**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type PreviewRow = { plugin: string; model: string; count: number; reason?: string; retentionYears?: number }
type Preview = {
  toDelete: PreviewRow[]
  toRetainAnonymized: PreviewRow[]
  toRetainLegal: PreviewRow[]
}

const REASON_OPTIONS = [
  { value: 'rarely_used',   label: '서비스를 잘 사용하지 않음' },
  { value: 'no_feature',    label: '원하는 기능이 없음' },
  { value: 'moved_service', label: '비슷한 다른 서비스로 이동' },
  { value: 'privacy',       label: '개인정보 걱정' },
  { value: 'other',         label: '기타' },
]

function displayLabel(row: PreviewRow): string {
  const map: Record<string, string> = {
    Order: '주문 내역',
    Post: '내가 쓴 게시글',
    Comment: '내가 쓴 댓글',
    ProductReview: '내가 쓴 상품 리뷰',
    ProductQna: '내가 쓴 상품 Q&A',
    Reaction: '좋아요/반응',
    Conversation: '대화방',
    Message: '메시지',
    Wishlist: '위시리스트',
    UserAddress: '배송지',
    Notification: '알림',
    NotificationPreference: '알림 설정',
    Account: '소셜 로그인 연동',
    PendingOrder: '미결제 주문',
  }
  return map[row.model] || row.model
}

export default function WithdrawPage() {
  const router = useRouter()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [reasonCode, setReasonCode] = useState<string>('')
  const [reasonText, setReasonText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/me/withdraw/preview')
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(setPreview)
      .catch(() => setError('미리보기를 불러오지 못했습니다. 다시 로그인해주세요.'))
      .finally(() => setLoading(false))
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const body: Record<string, string> = {}
    if (password) body.password = password
    if (reasonCode) body.reasonCode = reasonCode
    if (reasonCode === 'other' && reasonText) body.reasonText = reasonText

    const res = await fetch('/api/me/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      // Invalidate any client caches, then go home with a flag.
      router.push('/?withdrawn=1')
      return
    }
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    const map: Record<string, string> = {
      invalid_password: '비밀번호가 일치하지 않습니다.',
      password_required: '비밀번호를 입력해주세요.',
      unauthorized: '로그인이 필요합니다.',
    }
    setError(map[err.error] || '탈퇴 처리 중 오류가 발생했습니다.')
    setSubmitting(false)
  }

  if (loading) return <div className="p-6">로딩 중…</div>
  if (!preview) return <div className="p-6 text-red-600">{error || '미리보기를 불러올 수 없습니다.'}</div>

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-6">회원 탈퇴</h1>

      <section className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-2">삭제되는 정보</h2>
        {preview.toDelete.length === 0 ? (
          <p className="text-sm text-gray-500">삭제할 항목 없음</p>
        ) : (
          <ul className="text-sm list-disc pl-5 space-y-1">
            {preview.toDelete.map(r => (
              <li key={`${r.plugin}/${r.model}`}>{displayLabel(r)} {r.count}개</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-2">익명 처리되는 정보</h2>
        {preview.toRetainAnonymized.length === 0 ? (
          <p className="text-sm text-gray-500">해당 없음</p>
        ) : (
          <>
            <ul className="text-sm list-disc pl-5 space-y-1">
              {preview.toRetainAnonymized.map(r => (
                <li key={`${r.plugin}/${r.model}`}>{displayLabel(r)} {r.count}개</li>
              ))}
            </ul>
            <p className="text-xs text-gray-500 mt-2">작성자 이름이 &quot;탈퇴한회원_xxxxxx&quot;로 바뀌며 글/대화 내용은 남습니다.</p>
          </>
        )}
      </section>

      <section className="mb-6">
        <h2 className="font-semibold text-gray-700 mb-2">법적으로 유지되는 정보</h2>
        {preview.toRetainLegal.length === 0 ? (
          <p className="text-sm text-gray-500">해당 없음</p>
        ) : (
          <ul className="text-sm list-disc pl-5 space-y-1">
            {preview.toRetainLegal.map(r => (
              <li key={`${r.plugin}/${r.model}`}>
                {displayLabel(r)} {r.count}건 ({r.retentionYears}년간 보관 후 파기 — 전자상거래법)
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-gray-500 mt-2">재가입하셔도 조회할 수 없습니다.</p>
      </section>

      <form onSubmit={onSubmit} className="space-y-4 border-t pt-6">
        <fieldset>
          <legend className="font-semibold text-gray-700 mb-2">탈퇴 사유 (선택)</legend>
          <div className="space-y-1">
            {REASON_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="reasonCode"
                  value={opt.value}
                  checked={reasonCode === opt.value}
                  onChange={e => setReasonCode(e.target.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
          {reasonCode === 'other' && (
            <textarea
              className="mt-2 w-full border rounded p-2 text-sm"
              maxLength={500}
              rows={3}
              placeholder="탈퇴 사유를 적어주세요 (500자 이내)"
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
            />
          )}
        </fieldset>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">비밀번호 확인</label>
          <input
            type="password"
            className="w-full border rounded p-2 text-sm"
            placeholder="비밀번호"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <p className="text-xs text-gray-500 mt-1">소셜 로그인만 사용 중이면 비워두셔도 됩니다.</p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border rounded text-sm"
            disabled={submitting}
          >
            취소
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? '처리 중…' : '탈퇴하기'}
          </button>
        </div>
      </form>

      <p className="text-xs text-gray-500 mt-6">※ 탈퇴 후에는 복구할 수 없습니다.</p>
    </div>
  )
}
```

- [ ] **Step 3: Browser test — happy path**

Start dev server, log in as a regular user, navigate to `/mypage/account/withdraw`.

Expected:
- Page renders with three sections (delete / anonymize / legal) populated with real counts.
- Reason radios work; selecting "기타" reveals the textarea.
- Submit with correct password → redirect to `/?withdrawn=1`.
- Re-navigating to `/mypage/...` as that user forces re-login (session invalidated).

- [ ] **Step 4: Browser test — wrong password**

Repeat the flow with an incorrect password. Expected: red error text "비밀번호가 일치하지 않습니다." No redirect; can retry.

- [ ] **Step 5: Commit**

```bash
git add src/app/\[locale\]/mypage/account/withdraw/page.tsx
git commit -m "feat(withdrawal): mypage withdrawal confirmation page

Loads preview counts from /api/me/withdraw/preview, shows three
sections (delete / anonymize / legal retention), radio reason with
optional textarea for 'other', password confirmation, POST to
/api/me/withdraw.

---

마이페이지 탈퇴 확인 화면 추가. 미리보기 API로 삭제/익명화/법정
유지 3개 섹션을 표시, 라디오 사유 선택(기타 시 textarea), 비밀번호
확인 후 탈퇴 API 호출."
```

---

## Task 15: Mypage menu entry

**Files:**
- Modify: `src/app/[locale]/mypage/page.tsx` or the mypage sidebar component

- [ ] **Step 1: Find where mypage nav items are defined**

Run:
```bash
grep -rn "mypage/profile" src/app/\[locale\]/mypage src/components 2>/dev/null | head -10
```

Expected: one or more files listing mypage menu items. Locate the component that renders them.

- [ ] **Step 2: Add a "탈퇴" entry to the menu**

In that component, add an entry pointing to `/mypage/account/withdraw`. Place it last in the list with a small visual separator if the component supports it.

Example, if the menu is an array literal:

```tsx
{ label: '회원 탈퇴', href: '/mypage/account/withdraw', icon: 'UserMinus' },
```

- [ ] **Step 3: Browser test**

Visit `/mypage` (landing). Expected: "회원 탈퇴" link is visible; clicking navigates to the confirmation page.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(withdrawal): link withdrawal page from mypage nav

---

마이페이지 네비게이션에 탈퇴 링크 추가."
```

---

## Task 16: Admin audit page

**Files:**
- Create: `src/app/[locale]/admin/privacy/withdrawal-policy/page.tsx`
- Create: `src/app/api/admin/withdrawal/jobs/route.ts`
- Create: `src/app/api/admin/withdrawal/retry/route.ts`

- [ ] **Step 1: Create the admin API — list recent jobs**

File: `src/app/api/admin/withdrawal/jobs/route.ts`

```ts
import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pluginWithdrawalPolicies } from '@/lib/withdrawal/_generated-policies'

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const jobs = await prisma.withdrawalJob.findMany({
    orderBy: { id: 'desc' },
    take: 100,
  })
  return NextResponse.json({
    jobs,
    policies: pluginWithdrawalPolicies,
  })
}
```

- [ ] **Step 2: Create the admin API — manual retry**

File: `src/app/api/admin/withdrawal/retry/route.ts`

```ts
import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { executeWithdrawalPhase2 } from '@/lib/withdrawal/execute'

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { jobId } = await req.json().catch(() => ({}))
  if (!Number.isInteger(jobId)) {
    return NextResponse.json({ error: 'invalid_job_id' }, { status: 400 })
  }
  try {
    await executeWithdrawalPhase2(jobId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'unknown' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Create the audit page UI**

File: `src/app/[locale]/admin/privacy/withdrawal-policy/page.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'

type Job = {
  id: number; userId: number; status: string; attempts: number;
  lastError: string | null; reasonCode: string | null; reasonText: string | null;
  createdAt: string; startedAt: string | null; completedAt: string | null;
}

type PolicyEntry = { model: string; policy: string; reason?: string; parent?: string; handler?: string; field?: string }

type Data = {
  jobs: Job[]
  policies: Record<string, PolicyEntry[]>
}

export default function WithdrawalPolicyAdminPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/withdrawal/jobs')
    if (res.ok) setData(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function retry(jobId: number) {
    setRetrying(jobId)
    await fetch('/api/admin/withdrawal/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    })
    await load()
    setRetrying(null)
  }

  if (loading) return <div className="p-6">로딩 중…</div>
  if (!data) return <div className="p-6 text-red-600">권한이 없거나 데이터를 불러올 수 없습니다.</div>

  const grouped: Record<string, Array<{ plugin: string } & PolicyEntry>> = { retain: [], delete: [], 'retain-via-parent': [], custom: [] }
  for (const [plugin, entries] of Object.entries(data.policies)) {
    for (const e of entries) {
      ;(grouped[e.policy] ||= []).push({ plugin, ...e })
    }
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">탈퇴 정책 감사</h1>

      <section>
        <h2 className="font-semibold text-lg mb-2">선언된 정책</h2>
        {(['retain', 'retain-via-parent', 'delete', 'custom'] as const).map(policy => (
          <div key={policy} className="mb-4">
            <h3 className="font-medium text-gray-700 mb-1">
              {policy} ({grouped[policy]?.length || 0})
            </h3>
            <table className="w-full text-sm border">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="p-2">플러그인</th>
                  <th className="p-2">모델</th>
                  <th className="p-2">메모</th>
                </tr>
              </thead>
              <tbody>
                {(grouped[policy] || []).map((r, i) => (
                  <tr key={`${r.plugin}/${r.model}/${i}`} className="border-t">
                    <td className="p-2">{r.plugin}</td>
                    <td className="p-2 font-mono">{r.model}</td>
                    <td className="p-2 text-gray-600">
                      {r.reason || (r.parent ? `via parent ${r.parent}` : r.handler ? `handler: ${r.handler}` : '')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold text-lg mb-2">최근 탈퇴 기록 (최대 100건)</h2>
        <table className="w-full text-sm border">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="p-2">ID</th>
              <th className="p-2">userId</th>
              <th className="p-2">상태</th>
              <th className="p-2">시도</th>
              <th className="p-2">사유</th>
              <th className="p-2">생성</th>
              <th className="p-2">완료</th>
              <th className="p-2">오류</th>
              <th className="p-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {data.jobs.map(j => (
              <tr key={j.id} className="border-t">
                <td className="p-2">{j.id}</td>
                <td className="p-2">{j.userId}</td>
                <td className="p-2">
                  <span className={
                    j.status === 'done' ? 'text-green-600' :
                    j.status === 'failed' ? 'text-red-600' :
                    j.status === 'running' ? 'text-blue-600' : 'text-gray-600'
                  }>{j.status}</span>
                </td>
                <td className="p-2">{j.attempts}</td>
                <td className="p-2 text-xs">{j.reasonCode}{j.reasonText ? ` / ${j.reasonText}` : ''}</td>
                <td className="p-2 text-xs">{new Date(j.createdAt).toLocaleString('ko-KR')}</td>
                <td className="p-2 text-xs">{j.completedAt ? new Date(j.completedAt).toLocaleString('ko-KR') : '—'}</td>
                <td className="p-2 text-xs text-red-600 max-w-xs truncate" title={j.lastError || ''}>{j.lastError || ''}</td>
                <td className="p-2">
                  {(j.status === 'failed' || j.status === 'pending') && (
                    <button
                      className="text-xs px-2 py-1 border rounded"
                      disabled={retrying === j.id}
                      onClick={() => retry(j.id)}
                    >
                      {retrying === j.id ? '...' : '재시도'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Browser test**

Log in as an admin and navigate to `/admin/privacy/withdrawal-policy`.

Expected:
- Policy table shows all declared models grouped by `retain` / `retain-via-parent` / `delete` / `custom`.
- Recent jobs table shows any prior withdrawal test rows.
- Re-run retry on a failed job if one exists.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/withdrawal/ src/app/\[locale\]/admin/privacy/withdrawal-policy/
git commit -m "feat(withdrawal): admin audit page + retry API

Page at /admin/privacy/withdrawal-policy displays declared policies
from all plugins grouped by policy type, plus the last 100 withdrawal
jobs with status/reason/errors. Failed or pending jobs can be
manually retried via POST /api/admin/withdrawal/retry.

---

관리자 감사 페이지 추가. 전체 플러그인의 탈퇴 정책을 정책 유형별로
보여주고, 최근 100건의 탈퇴 잡을 상태/사유/오류와 함께 나열한다.
실패/대기 상태 잡은 수동 재시도 가능."
```

---

## Task 17: Cron script for retry sweep

**Files:**
- Create: `scripts/cron/withdrawal-retry.ts`
- Modify: `package.json` (add npm script)

- [ ] **Step 1: Create the cron script**

File: `scripts/cron/withdrawal-retry.ts`

```ts
import { prisma } from '../../src/lib/prisma'
import { executeWithdrawalPhase2 } from '../../src/lib/withdrawal/execute'

const MAX_ATTEMPTS = 5
const ORPHAN_MINUTES = 30

async function main() {
  const orphanCutoff = new Date(Date.now() - ORPHAN_MINUTES * 60 * 1000)
  const candidates = await prisma.withdrawalJob.findMany({
    where: {
      OR: [
        { status: 'failed',  attempts: { lt: MAX_ATTEMPTS } },
        { status: 'pending', attempts: { lt: MAX_ATTEMPTS } },
        { status: 'running', startedAt: { lt: orphanCutoff }, attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    orderBy: { id: 'asc' },
    take: 50,
  })
  console.log(`[withdrawal-retry] ${candidates.length} job(s) to retry`)
  for (const job of candidates) {
    try {
      await executeWithdrawalPhase2(job.id)
      console.log(`[withdrawal-retry] job ${job.id} → done`)
    } catch (err) {
      console.error(`[withdrawal-retry] job ${job.id} failed:`, err instanceof Error ? err.message : err)
    }
  }
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
```

- [ ] **Step 2: Add npm script**

Edit `package.json` scripts section, mirroring the existing `cron:shop-auto-confirm` pattern. Add:

```json
"cron:withdrawal-retry": "tsx scripts/cron/withdrawal-retry.ts",
```

- [ ] **Step 3: Manual execution test**

Create a deliberately-failed job, then run the retry:

```bash
# Optional: flip a recent withdrawal_jobs row to 'failed' manually
echo "UPDATE withdrawal_jobs SET status='failed', lastError='simulated' WHERE id=1;" | npx prisma db execute --file /dev/stdin --schema prisma/schema.prisma
npm run cron:withdrawal-retry
```

Expected: `[withdrawal-retry] 1 job(s) to retry` followed by `job 1 → done` (if all delete operations are now idempotent no-ops).

- [ ] **Step 4: Commit**

```bash
git add scripts/cron/withdrawal-retry.ts package.json
git commit -m "feat(withdrawal): cron script for Phase 2 retry

tsx scripts/cron/withdrawal-retry.ts picks up failed/pending jobs
and jobs stuck in 'running' for >30 minutes, and re-runs Phase 2.
Max 5 attempts per job. Exposed as 'npm run cron:withdrawal-retry'
for external scheduler integration.

---

Phase 2 재시도 cron 스크립트 추가. 실패/대기 상태 및 30분 이상
'running' 정체된 잡을 최대 5회까지 재시도. npm 스크립트로 노출."
```

---

## Task 18: Verification sweep — detect stale rows

**Files:**
- Create: `src/lib/withdrawal/verify.ts`
- Create: `scripts/cron/withdrawal-verify.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `src/lib/withdrawal/verify.ts`**

```ts
import { prisma } from '@/lib/prisma'
import { pluginWithdrawalPolicies } from './_generated-policies'
import type { WithdrawalPolicyEntry } from './types'

export interface StaleFinding {
  userId: number
  plugin: string
  model: string
  count: number
}

function prismaAccessor(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1)
}

function userField(entry: WithdrawalPolicyEntry): string {
  return ('field' in entry && entry.field) ? entry.field : 'userId'
}

export async function runVerificationSweep(sinceDays = 30): Promise<StaleFinding[]> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
  const completed = await prisma.withdrawalJob.findMany({
    where: { status: 'done', completedAt: { gt: since } },
    select: { userId: true },
    distinct: ['userId'],
  })

  const findings: StaleFinding[] = []
  for (const { userId } of completed) {
    for (const [plugin, entries] of Object.entries(pluginWithdrawalPolicies)) {
      for (const entry of entries) {
        if (entry.policy !== 'delete') continue
        const accessor = prismaAccessor(entry.model)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = (prisma as any)[accessor]
        if (!client || typeof client.count !== 'function') continue
        const field = userField(entry)
        let count = 0
        try {
          count = await client.count({ where: { [field]: userId } })
        } catch {
          continue  // field doesn't exist — skip
        }
        if (count > 0) findings.push({ userId, plugin, model: entry.model, count })
      }
    }
  }
  return findings
}
```

- [ ] **Step 2: Create `scripts/cron/withdrawal-verify.ts`**

```ts
import { prisma } from '../../src/lib/prisma'
import { runVerificationSweep } from '../../src/lib/withdrawal/verify'

async function main() {
  const findings = await runVerificationSweep(30)
  if (findings.length === 0) {
    console.log('[withdrawal-verify] ✓ No stale rows detected')
  } else {
    console.error(`[withdrawal-verify] ✗ ${findings.length} stale reference(s) detected:`)
    for (const f of findings) {
      console.error(`  userId=${f.userId}  ${f.plugin}.${f.model} — ${f.count} row(s) remain (policy=delete, should be 0)`)
    }
  }
  await prisma.$disconnect()
  process.exit(findings.length === 0 ? 0 : 2)
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
```

- [ ] **Step 3: Add npm script**

Edit `package.json`:

```json
"cron:withdrawal-verify": "tsx scripts/cron/withdrawal-verify.ts",
```

- [ ] **Step 4: Manual test — positive case**

Run against current DB (should be clean if Task 13 test user's Phase 2 completed):

```bash
npm run cron:withdrawal-verify
```

Expected: `✓ No stale rows detected`, exit 0.

- [ ] **Step 5: Manual test — negative case**

Manually insert a stale row to verify detection:

```bash
# Insert a Wishlist row for a withdrawn user, bypassing normal flow:
echo "INSERT INTO wishlists (userId, productId, createdAt) VALUES (<withdrawnUserId>, 1, NOW());" | npx prisma db execute --file /dev/stdin --schema prisma/schema.prisma
npm run cron:withdrawal-verify; echo "exit=$?"
# Clean up:
echo "DELETE FROM wishlists WHERE userId = <withdrawnUserId>;" | npx prisma db execute --file /dev/stdin --schema prisma/schema.prisma
```

Expected: `✗ 1 stale reference(s) detected` with details, exit 2.

- [ ] **Step 6: Commit**

```bash
git add src/lib/withdrawal/verify.ts scripts/cron/withdrawal-verify.ts package.json
git commit -m "feat(withdrawal): verification sweep for stale rows

For each user withdrawn within the last 30 days, scan every
policy='delete' model and assert row count is zero. Any non-zero
count is reported. Runnable as 'npm run cron:withdrawal-verify';
exits 0 on clean, 2 on findings so external schedulers can alert.

---

탈퇴 검증 스윕 추가. 최근 30일 탈퇴 사용자에 대해 policy='delete'
모델들이 실제로 0건임을 검증하고, 잔존 행이 있으면 보고한다."
```

---

## Task 19: End-to-end integration test (manual checklist)

**Files:**
- Create: `docs/superpowers/specs/2026-04-23-user-withdrawal-test-checklist.md`

- [ ] **Step 1: Create the checklist document**

```markdown
# User Withdrawal — E2E Test Checklist

Run these steps on a fresh dev database (or a clean seeded state). Record pass/fail for each.

## Setup
- [ ] `npm run dev` starts without build errors (validates Tasks 6-7).
- [ ] Register a fresh user `test1@example.com` via the normal signup flow. Note the userId.

## Seed data as that user
- [ ] Create 2 posts in a board.
- [ ] Add 5 comments on other posts.
- [ ] Add 1 product review (if shop is enabled).
- [ ] Add 3 wishlist items.
- [ ] Add 2 shipping addresses.
- [ ] Place 1 completed order (for legal retention verification).
- [ ] Link an OAuth account (optional).

## Preview
- [ ] Navigate to `/mypage/account/withdraw`. All three sections show the expected counts.
- [ ] Select a reason radio; "기타" reveals textarea.

## Withdrawal
- [ ] Submit with wrong password → red error, no redirect.
- [ ] Submit with correct password → redirect to `/?withdrawn=1`.
- [ ] Within 5 seconds: refresh any page → session invalidated (redirected to login).

## DB verification (run against dev DB)
- [ ] `users` row for the test user: email is `deleted_*@deleted.local`, nickname `탈퇴한회원_*`, status `withdrawn`, deletedAt set, password/phone/image/provider/providerId all null.
- [ ] `accounts` for that userId: 0 rows.
- [ ] `wishlists` for that userId: 0 rows.
- [ ] `user_addresses` for that userId: 0 rows.
- [ ] `notifications` for that userId: 0 rows.
- [ ] `posts` for that userId (authorId): count unchanged.
- [ ] `comments` for that userId (authorId): count unchanged.
- [ ] `product_reviews` for that userId: count unchanged.
- [ ] `orders` for that userId: count unchanged, `ordererName`/`ordererEmail` original values preserved (legal retention).
- [ ] `withdrawal_jobs`: latest row for this userId has status `done`, completedAt set.

## Re-registration
- [ ] Sign up a new account with the same email `test1@example.com` → succeeds immediately.
- [ ] New account has a new userId.
- [ ] Mypage for the new account shows no posts/comments/reviews/orders from the previous account.
- [ ] Browse to any post formerly by the old user: author renders as `탈퇴한회원_xxxxxx`.

## Verification sweep
- [ ] `npm run cron:withdrawal-verify` exits 0 with `✓ No stale rows detected`.

## Admin audit
- [ ] As admin, `/admin/privacy/withdrawal-policy` loads. Policy table is populated. Latest job visible with status `done`.

## Failure path
- [ ] Simulate a Phase 2 failure: temporarily break one of the delete targets (e.g., rename a Prisma client accessor in `execute.ts` via a local patch). Repeat withdrawal for a different test user. Observe withdrawal_jobs row ends `failed` with lastError populated.
- [ ] Revert the patch. Click "재시도" in admin audit page. Job transitions to `done`.
```

- [ ] **Step 2: Run the checklist end-to-end**

Follow every item. Fix any failures before proceeding to Task 20.

- [ ] **Step 3: Commit the checklist**

```bash
git add docs/superpowers/specs/2026-04-23-user-withdrawal-test-checklist.md
git commit -m "docs(withdrawal): E2E test checklist

Manual verification steps covering setup, preview, withdrawal flow,
DB state, re-registration, verification sweep, and failure path.

---

탈퇴 기능 수동 검증 체크리스트. 시드 데이터 생성부터 DB 상태 검증,
재가입, 검증 스윕, 실패 경로까지 포함."
```

---

## Task 20: Release preparation

**Files:**
- Modify: `package.json` (version bump)
- Modify: `src/locales/ko.json`, `src/locales/en.json` (if new user-facing strings require translation)

- [ ] **Step 1: Translation strings audit**

Run:
```bash
grep -rn "회원 탈퇴\|탈퇴하기\|탈퇴한회원" src/app src/plugins 2>/dev/null | head -20
```

Expected: list of hardcoded Korean strings. If the project uses `next-intl` elsewhere, consider extracting these to `src/locales/ko.json` and `src/locales/en.json`. If keeping Korean-first for now is acceptable, skip formal i18n — user-facing strings remain literal.

- [ ] **Step 2: Update version in `package.json`**

Run:
```bash
node -e "const p=require('./package.json'); console.log('current:', p.version)"
```

Bump minor version (e.g., `0.27.0` → `0.28.0`).

- [ ] **Step 3: Final full build to verify no regressions**

Run:
```bash
npm run build
```

Expected: build completes. `[scan-plugins]`, `[withdrawal-validator]`, `prisma generate`, and `next build` all succeed.

- [ ] **Step 4: Version bump commit**

```bash
git add package.json src/locales/
git commit -m "chore: v0.28.0 — user withdrawal

Adds user-initiated account withdrawal with plugin-declared data
policy, build-time validator, 2-phase execution, admin audit page,
and Phase 2 retry + verification cron scripts.

---

v0.28.0 — 회원 탈퇴 기능. 플러그인 선언형 데이터 정책, 빌드 타임
검증기, 2단계 실행, 관리자 감사 페이지, Phase 2 재시도 및 검증
cron 스크립트 포함."
```

- [ ] **Step 5: Push and open PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: user withdrawal — plugin-declared policy + anonymization" --body "$(cat <<'EOF'
## Summary
- Account withdrawal from 마이페이지 with password confirmation and optional reason.
- User row anonymized (email/nickname cleared) so same email can re-register immediately.
- Per-plugin withdrawal-policy.ts declares per-model handling; build-time validator enforces completeness.
- Phase 1 (sync) anonymizes + deletes Accounts + creates withdrawal_jobs row. Phase 2 (fire-and-forget) runs batched cleanup.
- Admin audit page at /admin/privacy/withdrawal-policy with manual retry.
- Cron scripts: cron:withdrawal-retry, cron:withdrawal-verify.

## Test plan
- [ ] Run the checklist in docs/superpowers/specs/2026-04-23-user-withdrawal-test-checklist.md end-to-end.
- [ ] Verify `npm run build` passes.
- [ ] Verify `npm run cron:withdrawal-verify` exits 0.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Notes

Before starting execution, confirm:

- **Spec coverage:** Every numbered section of the design doc maps to at least one task.
  - §1 Data model → Task 1 (WithdrawalJob).
  - §2 Plugin manifest contract → Tasks 2–5.
  - §3 Build-time validation → Tasks 6–7.
  - §4 Withdrawal execution Phase 1/2 → Tasks 9–10, 13.
  - §4 retry sweep → Task 17.
  - §5 Verification sweep → Task 18.
  - §6 Admin audit page → Task 16.
  - §7 UX flow → Tasks 12, 14, 15.
  - §8 API surface → Tasks 12, 13.
  - §9 Initial declarations → Tasks 2–5.
  - §10 Edge cases → verified in Task 19 checklist.
  - §11 File layout → followed task-by-task.
  - §12 Migration/rollout → Tasks 1, 5, 20.
  - §13 Testing → Task 19.
  - §14 Open questions → resolved in plan: fire-and-forget via `void` + promise; sweep via npm scripts; OAuth re-verification uses existing session as re-verification (enhancement if needed later); withdrawal reasons surfaced in admin audit page only (no dashboard this pass).
  - §15 Acceptance criteria → verified in Task 19 checklist.

- **Naming consistency:** `WithdrawalJob` (Prisma), `withdrawal_jobs` (table), `withdrawalJob` (Prisma client accessor), `pluginWithdrawalPolicies` (generated export), `WithdrawalPolicyEntry` (type). All consistent across tasks.

- **Code completeness:** Every step that modifies code shows the exact code. No `// TBD` or `// implement similar to above`.
