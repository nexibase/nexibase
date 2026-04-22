# Shop Fulfillment Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the shop plugin with a payment gateway abstraction (Inicis + BankDeposit adapters), an append-only audit log covering every order state change, and a strengthened shipping workflow (admin tracking entry, state transition buttons, customer status stepper, auto-confirm cron). This is Phase 1 of the [shop fulfillment design](../specs/2026-04-22-shop-fulfillment-design.md). Phase 2 (return/exchange) is a separate plan.

**Architecture:** A new `src/plugins/shop/fulfillment/` sub-module holds pure state-machine and audit-log helpers. A new `src/plugins/shop/payments/` sub-module holds the `PaymentAdapter` interface, a registry, and per-PG adapter implementations. Existing `/api/shop/payment/inicis/*` routes are replaced by a unified `/api/shop/payment/init` + `/api/shop/payment/callback/[adapterId]` pair that delegates to the resolved adapter. UI work is surgical: activity timeline sidebar on admin order detail, dynamic payment method list at checkout, customer status stepper, admin payment settings page.

**Tech Stack:** Next.js 16 App Router (Turbopack), TypeScript, Prisma 6 + MariaDB, next-intl i18n, shadcn/ui. Node `node:test` runner via `tsx` for pure-function unit tests.

**Spec:** [docs/superpowers/specs/2026-04-22-shop-fulfillment-design.md](../specs/2026-04-22-shop-fulfillment-design.md)

**Feedback memory to respect:**
- **Core-unchanged rule applies** — all code changes are in `src/plugins/shop/` (submodule) except the Prisma migration, which lives in `prisma/migrations/` (core) because migrations are global. Commit shop changes to `feat/shop-fulfillment-phase1` in the plugin-shop repo; commit migrations + submodule bump to a branch in nexibase.
- **Prisma schema merging rule** — edit only `src/plugins/shop/schema.prisma`; the top-level `prisma/schema.prisma` is a generated artifact (scan-plugins.js rebuilds it).
- **i18n locale merging rule** — edit only `src/plugins/shop/locales/*.json`; `src/messages/*.json` is the generated merged artifact.

**Branch strategy:**
- **shop submodule:** branch `feat/shop-fulfillment-phase1` off `main`.
- **nexibase:** branch `feat/shop-fulfillment-phase1` off `main`. Holds the Prisma migration SQL + shop submodule pointer bump.

---

## File Structure

**New files in shop submodule (`src/plugins/shop/`):**

| File | Responsibility |
|---|---|
| `fulfillment/state-machine.ts` | `ORDER_TRANSITIONS`, `assertTransition()`, type definitions |
| `fulfillment/state-machine.test.ts` | Pure function tests via `node:test` |
| `fulfillment/activities.ts` | `logActivity()` helper, action type literals |
| `fulfillment/activities.test.ts` | Tests for payload merging, status resolution |
| `payments/adapter.ts` | `PaymentAdapter` interface, `PayMethod` type, result types |
| `payments/registry.ts` | `register()`, `get()`, `listEnabled()`, `resolveMethodToAdapter()` |
| `payments/registry.test.ts` | Registry & resolver tests |
| `payments/bootstrap.ts` | Registers all built-in adapters (import side effect) |
| `payments/inicis/index.ts` | `InicisAdapter` class |
| `payments/inicis/signature.ts` | Inicis signature/hash helpers (extracted from existing routes) |
| `payments/inicis/refund.ts` | Refund API call |
| `payments/bank_deposit/index.ts` | `BankDepositAdapter` class |
| `api/payment/init/route.ts` | `POST` — PG-agnostic checkout start |
| `api/payment/callback/[adapterId]/route.ts` | `POST` — unified PG callback |
| `api/payment/methods/route.ts` | `GET` — enabled adapter list |
| `api/admin/orders/[id]/ship/route.ts` | `POST` — set tracking, transition → shipping |
| `api/admin/orders/[id]/deliver/route.ts` | `POST` — transition → delivered |
| `api/admin/orders/[id]/cancel/route.ts` | `POST` — cancel with optional refund |
| `api/admin/orders/[id]/activities/route.ts` | `GET` — activity timeline |
| `api/admin/orders/bulk-ship/route.ts` | `POST` — bulk tracking entry |
| `api/admin/payment-settings/route.ts` | `GET/PATCH` — enabled gateways, default card gateway |
| `api/shop/orders/[orderNo]/confirm/route.ts` | `POST` — customer "구매확정" |
| `admin/orders/components/ActivityTimeline.tsx` | Sidebar timeline of order_activities |
| `admin/orders/components/StatusTransitionBar.tsx` | State pill + allowed-transition buttons |
| `admin/orders/components/BulkShipDialog.tsx` | Bulk tracking entry modal |
| `admin/payment-settings/page.tsx` | New admin page: PG toggles + default card gateway |
| `routes/mypage/orders/[orderNo]/page.tsx` | New customer order detail page with stepper |
| `lib/shop-settings.ts` | Typed helper to read/write shop_settings keys |

**Modified files in shop submodule:**

| File | Change |
|---|---|
| `schema.prisma` | Add `OrderActivity` model, extend `Order` with `originalOrderId`/`orderType`/`paymentGateway`/`pgTransactionId` |
| `admin/orders/[id]/page.tsx` | Inject `ActivityTimeline`, `StatusTransitionBar`; replace inline status dropdown; memo save → activity log |
| `admin/orders/page.tsx` | Add `orderType` badge column, PG filter dropdown, "일괄 송장입력" button |
| `api/orders/route.ts` (list) | Include `paymentGateway`, `orderType` in response |
| `api/orders/[id]/route.ts` (admin detail) | Include joined activities in response |
| `api/payment/inicis/**` | Delete folder (logic moves into `payments/inicis/`) |
| `routes/order/page.tsx` | Dynamic payment method list from `GET /api/shop/payment/methods`; drop hardcoded card/bank-deposit radio |
| `routes/mypage/orders/page.tsx` | Add mini stepper, "구매확정" button per row |
| `locales/ko.json`, `locales/en.json` | New keys under `shop.admin.orders.*`, `shop.orders.*`, `shop.payment.*` |

**New files in nexibase core:**

| File | Responsibility |
|---|---|
| `prisma/migrations/<timestamp>_shop_fulfillment_phase1/migration.sql` | SQL: create `order_activities`, alter `orders` |
| `scripts/cron/shop-auto-confirm.ts` | Stand-alone cron task (run via `tsx`) |

**Modified files in nexibase core:**

| File | Change |
|---|---|
| `src/plugins/shop` (submodule pointer) | Bump to the Phase 1 shop commit |

---

## Testing Strategy

No test framework exists in this codebase. We introduce targeted tests only for pure-function modules using `node --test --import tsx`. UI and API layers are verified manually via dev server + browser/curl, with exact reproduction steps written into each task.

Commands:
- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Pure-function tests: `npx tsx --test src/plugins/shop/fulfillment/*.test.ts src/plugins/shop/payments/*.test.ts`
- Dev server: `npm run dev`
- Prisma client regenerate: `npx prisma generate`

---

## Task 1: Prisma schema changes + migration

**Files:**
- Modify: `src/plugins/shop/schema.prisma`
- Create: `prisma/migrations/<timestamp>_shop_fulfillment_phase1/migration.sql`

- [ ] **Step 1.1: Edit `src/plugins/shop/schema.prisma` — add `OrderActivity` model and extend `Order`**

Append the new model and add four columns to `Order`. Show only the Order block's changed lines and the complete new model:

```prisma
model Order {
  // ... existing fields unchanged ...
  originalOrderId Int?
  orderType       String   @default("normal") @db.VarChar(20)
  paymentGateway  String?  @db.VarChar(20)
  pgTransactionId String?  @db.VarChar(100)
  // relations
  originalOrder   Order?   @relation("OrderExchangeChain", fields: [originalOrderId], references: [id])
  replacements    Order[]  @relation("OrderExchangeChain")
  activities      OrderActivity[]
  // existing indexes unchanged, add:
  @@index([originalOrderId])
  @@index([paymentGateway])
}

model OrderActivity {
  id         Int      @id @default(autoincrement())
  orderId    Int
  actorType  String   @db.VarChar(20)   // 'customer' | 'admin' | 'system'
  actorId    Int?
  action     String   @db.VarChar(40)
  fromStatus String?  @db.VarChar(20)
  toStatus   String?  @db.VarChar(20)
  payload    Json?
  memo       String?  @db.Text
  createdAt  DateTime @default(now())
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@index([orderId, createdAt])
  @@map("order_activities")
}
```

- [ ] **Step 1.2: Regenerate merged Prisma schema**

Run: `node scripts/scan-plugins.js`
Expected: updates `prisma/schema.prisma` with the new model and columns.

- [ ] **Step 1.3: Create the migration folder and SQL**

Create directory: `prisma/migrations/20260422000000_shop_fulfillment_phase1/` (use current date/time if different; must sort after `20260421000000_board_show_post_number`).

Write `migration.sql`:

```sql
-- CreateTable
CREATE TABLE `order_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `actorType` VARCHAR(20) NOT NULL,
    `actorId` INTEGER NULL,
    `action` VARCHAR(40) NOT NULL,
    `fromStatus` VARCHAR(20) NULL,
    `toStatus` VARCHAR(20) NULL,
    `payload` JSON NULL,
    `memo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_activities_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `orders`
    ADD COLUMN `originalOrderId` INTEGER NULL,
    ADD COLUMN `orderType` VARCHAR(20) NOT NULL DEFAULT 'normal',
    ADD COLUMN `paymentGateway` VARCHAR(20) NULL,
    ADD COLUMN `pgTransactionId` VARCHAR(100) NULL;

-- CreateIndex
CREATE INDEX `orders_originalOrderId_idx` ON `orders`(`originalOrderId`);
CREATE INDEX `orders_paymentGateway_idx` ON `orders`(`paymentGateway`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_originalOrderId_fkey`
    FOREIGN KEY (`originalOrderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_activities` ADD CONSTRAINT `order_activities_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing paid orders: all prior card payments went through Inicis
UPDATE `orders`
   SET `paymentGateway` = 'inicis'
 WHERE `paymentMethod` = 'card' AND `paymentGateway` IS NULL;

UPDATE `orders`
   SET `paymentGateway` = 'bank_deposit'
 WHERE `paymentMethod` IN ('bank', 'bank_transfer') AND `paymentGateway` IS NULL;
```

- [ ] **Step 1.4: Apply migration**

Run: `npx prisma migrate deploy`
Expected output includes: `Applying migration '20260422000000_shop_fulfillment_phase1'` and `1 migration applied`.

- [ ] **Step 1.5: Regenerate Prisma client**

Run: `npx prisma generate`
Expected: no errors; `Generated Prisma Client` line.

- [ ] **Step 1.6: Verify schema**

Run:
```bash
mariadb -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -P"$MYSQL_PORT" "$MYSQL_DB" \
  -e "DESCRIBE order_activities; SHOW COLUMNS FROM orders LIKE 'paymentGateway'; SHOW COLUMNS FROM orders LIKE 'orderType';"
```
Expected: table and two columns present with correct types.

- [ ] **Step 1.7: Commit (nexibase core + shop submodule)**

In `src/plugins/shop`:
```bash
git -C src/plugins/shop checkout -b feat/shop-fulfillment-phase1
git -C src/plugins/shop add schema.prisma
git -C src/plugins/shop commit -m "feat(db): add OrderActivity model and extend Order for fulfillment phase 1"
```

In nexibase:
```bash
git checkout -b feat/shop-fulfillment-phase1
git add prisma/migrations/20260422000000_shop_fulfillment_phase1/ prisma/schema.prisma src/plugins/shop
git commit -m "feat(db): shop fulfillment phase 1 migration"
```

---

## Task 2: Fulfillment state machine module

**Files:**
- Create: `src/plugins/shop/fulfillment/state-machine.ts`
- Create: `src/plugins/shop/fulfillment/state-machine.test.ts`

- [ ] **Step 2.1: Write `state-machine.ts`**

```ts
export type OrderStatus =
  | 'pending' | 'paid' | 'preparing' | 'shipping' | 'delivered' | 'confirmed'
  | 'cancel_requested' | 'cancelled'

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:          ['paid', 'cancel_requested', 'cancelled'],
  paid:             ['preparing', 'cancel_requested', 'cancelled'],
  preparing:        ['shipping', 'cancelled'],
  shipping:         ['delivered'],
  delivered:        ['confirmed'],
  confirmed:        [],
  cancel_requested: ['cancelled', 'paid'],
  cancelled:        [],
}

export class TransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Transition not allowed: ${from} → ${to}`)
    this.name = 'TransitionError'
  }
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    throw new TransitionError(from, to)
  }
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

export function allowedTransitions(from: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[from] ?? []
}
```

- [ ] **Step 2.2: Write tests**

`src/plugins/shop/fulfillment/state-machine.test.ts`:
```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertOrderTransition, canTransition, allowedTransitions, TransitionError } from './state-machine'

test('paid → preparing allowed', () => {
  assert.doesNotThrow(() => assertOrderTransition('paid', 'preparing'))
})

test('shipping → pending rejected', () => {
  assert.throws(() => assertOrderTransition('shipping', 'pending'), TransitionError)
})

test('confirmed is terminal', () => {
  assert.deepEqual(allowedTransitions('confirmed'), [])
})

test('canTransition non-throwing API', () => {
  assert.equal(canTransition('pending', 'paid'), true)
  assert.equal(canTransition('delivered', 'paid'), false)
})

test('cancel_requested can revert to paid', () => {
  assert.doesNotThrow(() => assertOrderTransition('cancel_requested', 'paid'))
})
```

- [ ] **Step 2.3: Run tests**

Run: `npx tsx --test src/plugins/shop/fulfillment/state-machine.test.ts`
Expected: `# pass 5` or equivalent — 5 tests pass.

- [ ] **Step 2.4: Commit**

```bash
git -C src/plugins/shop add fulfillment/state-machine.ts fulfillment/state-machine.test.ts
git -C src/plugins/shop commit -m "feat(fulfillment): add order state machine with allowed transitions"
```

---

## Task 3: Fulfillment activities module (audit log helper)

**Files:**
- Create: `src/plugins/shop/fulfillment/activities.ts`
- Create: `src/plugins/shop/fulfillment/activities.test.ts`

- [ ] **Step 3.1: Write `activities.ts`**

```ts
import type { Prisma, PrismaClient } from '@prisma/client'

export type ActorType = 'customer' | 'admin' | 'system'

export type ActivityAction =
  | 'order_created'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'status_changed'
  | 'tracking_updated'
  | 'memo_updated'
  | 'cancel_requested'
  | 'cancelled'
  | 'refund_issued'

export interface LogActivityInput {
  orderId: number
  actorType: ActorType
  actorId?: number | null
  action: ActivityAction
  fromStatus?: string | null
  toStatus?: string | null
  payload?: Prisma.InputJsonValue
  memo?: string | null
}

/**
 * Record an append-only audit event for an order.
 * Accepts a Prisma client or transaction client so callers can bundle with business writes.
 */
export async function logActivity(
  db: PrismaClient | Prisma.TransactionClient,
  input: LogActivityInput,
): Promise<void> {
  await db.orderActivity.create({
    data: {
      orderId: input.orderId,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      action: input.action,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      payload: input.payload ?? undefined,
      memo: input.memo ?? null,
    },
  })
}
```

- [ ] **Step 3.2: Write tests**

`src/plugins/shop/fulfillment/activities.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { logActivity } from './activities'

test('logActivity writes to orderActivity with null defaults', async () => {
  const captured: any[] = []
  const fakeDb = {
    orderActivity: {
      create: async (args: any) => { captured.push(args.data); return args.data },
    },
  } as any
  await logActivity(fakeDb, {
    orderId: 42,
    actorType: 'admin',
    actorId: 7,
    action: 'status_changed',
    fromStatus: 'paid',
    toStatus: 'preparing',
  })
  assert.equal(captured.length, 1)
  assert.equal(captured[0].orderId, 42)
  assert.equal(captured[0].actorType, 'admin')
  assert.equal(captured[0].actorId, 7)
  assert.equal(captured[0].fromStatus, 'paid')
  assert.equal(captured[0].toStatus, 'preparing')
  assert.equal(captured[0].memo, null)
})

test('logActivity omits undefined payload', async () => {
  const captured: any[] = []
  const fakeDb = {
    orderActivity: { create: async (args: any) => { captured.push(args.data) } },
  } as any
  await logActivity(fakeDb, { orderId: 1, actorType: 'system', action: 'order_created' })
  assert.equal(captured[0].payload, undefined)
  assert.equal(captured[0].actorId, null)
})
```

- [ ] **Step 3.3: Run tests**

Run: `npx tsx --test src/plugins/shop/fulfillment/activities.test.ts`
Expected: 2 tests pass.

- [ ] **Step 3.4: Commit**

```bash
git -C src/plugins/shop add fulfillment/activities.ts fulfillment/activities.test.ts
git -C src/plugins/shop commit -m "feat(fulfillment): add logActivity audit log helper"
```

---

## Task 4: Payment adapter interface + registry + bootstrap

**Files:**
- Create: `src/plugins/shop/payments/adapter.ts`
- Create: `src/plugins/shop/payments/registry.ts`
- Create: `src/plugins/shop/payments/registry.test.ts`
- Create: `src/plugins/shop/payments/bootstrap.ts`

- [ ] **Step 4.1: Write `adapter.ts`**

```ts
export type PayMethod =
  | 'card' | 'account_transfer' | 'virtual_account' | 'mobile' | 'bank_deposit'

export interface PrepareOpts {
  returnUrl: string
  closeUrl: string
  locale?: string
}

export interface PrepareResult {
  kind: 'redirect' | 'form' | 'manual'
  redirectUrl?: string
  formAction?: string
  formFields?: Record<string, string>
}

export interface CallbackResult {
  success: boolean
  pgTransactionId: string
  paidAmount: number
  method: PayMethod
  rawResponse: unknown
  errorMessage?: string
}

export interface RefundParams {
  pgTransactionId: string
  amount: number
  reason: string
  orderRef: string
}

export interface RefundResult {
  success: boolean
  refundedAmount: number
  pgRefundId?: string
  errorMessage?: string
}

export interface AdapterOrderSnapshot {
  id: number
  orderNo: string
  finalPrice: number
  ordererName: string
  ordererPhone: string
  ordererEmail?: string | null
  items: { productName: string; quantity: number }[]
}

export interface PaymentAdapter {
  readonly id: string
  readonly displayName: string
  readonly supportedMethods: PayMethod[]

  prepare(order: AdapterOrderSnapshot, opts: PrepareOpts): Promise<PrepareResult>
  handleCallback(rawRequest: unknown): Promise<CallbackResult>
  refund(params: RefundParams): Promise<RefundResult>
}
```

- [ ] **Step 4.2: Write `registry.ts`**

```ts
import type { PaymentAdapter, PayMethod } from './adapter'
import { getShopSetting } from '../lib/shop-settings'

const adapters = new Map<string, PaymentAdapter>()

export function register(adapter: PaymentAdapter): void {
  adapters.set(adapter.id, adapter)
}

export function get(id: string): PaymentAdapter | null {
  return adapters.get(id) ?? null
}

export async function listEnabled(): Promise<PaymentAdapter[]> {
  const enabledJson = (await getShopSetting('enabled_payment_gateways')) ?? '["inicis","bank_deposit"]'
  const ids: string[] = JSON.parse(enabledJson)
  return ids.map(id => adapters.get(id)).filter((a): a is PaymentAdapter => !!a)
}

/**
 * Resolve (customer-facing method) → (PaymentAdapter) based on shop settings.
 * - bank_deposit → built-in 'bank_deposit' adapter
 * - card/account_transfer/virtual_account/mobile → shop_settings.default_card_gateway
 */
export async function resolveMethodToAdapter(method: PayMethod): Promise<PaymentAdapter | null> {
  if (method === 'bank_deposit') return adapters.get('bank_deposit') ?? null
  const defaultId = (await getShopSetting('default_card_gateway')) ?? 'inicis'
  return adapters.get(defaultId) ?? null
}

// test-only
export function _clearForTests(): void { adapters.clear() }
```

- [ ] **Step 4.3: Write `bootstrap.ts`**

```ts
import { register } from './registry'
import { InicisAdapter } from './inicis'
import { BankDepositAdapter } from './bank_deposit'

let bootstrapped = false

export function bootstrapPaymentAdapters(): void {
  if (bootstrapped) return
  register(new InicisAdapter())
  register(new BankDepositAdapter())
  bootstrapped = true
}
```

Note: `InicisAdapter`/`BankDepositAdapter` are imported here; Tasks 5 and 6 create them. This file will fail compile until those tasks are complete — leave the imports and add a TypeScript `// @ts-expect-error - implemented in later task` comment if needed to keep the commit green, or commit this task after Tasks 5 and 6.

Decision: commit Task 4 AFTER Task 6 so imports resolve. Move commit step to end of Task 6.

- [ ] **Step 4.4: Write `lib/shop-settings.ts` helper (needed by registry)**

```ts
import { prisma } from '@/lib/prisma'

export async function getShopSetting(key: string): Promise<string | null> {
  const row = await prisma.shopSetting.findUnique({ where: { key } })
  return row?.value ?? null
}

export async function setShopSetting(key: string, value: string): Promise<void> {
  await prisma.shopSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}
```

- [ ] **Step 4.5: Write registry tests**

`src/plugins/shop/payments/registry.test.ts`:
```ts
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { register, get, _clearForTests } from './registry'
import type { PaymentAdapter } from './adapter'

beforeEach(() => _clearForTests())

test('register and get by id', () => {
  const stub: PaymentAdapter = {
    id: 'stub', displayName: 'Stub', supportedMethods: ['card'],
    prepare: async () => ({ kind: 'redirect', redirectUrl: '/x' }),
    handleCallback: async () => ({ success: true, pgTransactionId: 'x', paidAmount: 0, method: 'card', rawResponse: null }),
    refund: async () => ({ success: true, refundedAmount: 0 }),
  }
  register(stub)
  assert.equal(get('stub'), stub)
  assert.equal(get('missing'), null)
})
```

Run: `npx tsx --test src/plugins/shop/payments/registry.test.ts` — expected fail since `getShopSetting` imports `@/lib/prisma` which is Next.js-scoped. Mark the `listEnabled`/`resolveMethodToAdapter` tests as integration-only and keep only the pure register/get test here.

Expected: 1 test passes.

- [ ] **Step 4.6: Defer commit**

Do not commit yet — Task 4 files depend on Tasks 5 and 6. Commit at end of Task 6.

---

## Task 5: InicisAdapter

**Files:**
- Create: `src/plugins/shop/payments/inicis/index.ts`
- Create: `src/plugins/shop/payments/inicis/signature.ts`
- Create: `src/plugins/shop/payments/inicis/refund.ts`
- Delete (after adapter works): `src/plugins/shop/api/payment/inicis/*` (legacy routes)

- [ ] **Step 5.1: Inspect existing Inicis code**

Run:
```bash
ls src/plugins/shop/api/payment/inicis/
cat src/plugins/shop/api/payment/inicis/route.ts
cat src/plugins/shop/api/payment/inicis/return/route.ts
cat src/plugins/shop/api/payment/inicis/close/route.ts
cat src/plugins/shop/api/payment/inicis/cancel/route.ts
cat src/plugins/shop/api/payment/inicis/popup/route.ts
```

Purpose: understand signature generation, form field construction, return handling. You will port this logic into the adapter.

- [ ] **Step 5.2: Extract signature helpers to `signature.ts`**

Move HMAC-SHA256/signature/mKey generation functions from `api/payment/inicis/route.ts` into `payments/inicis/signature.ts` as pure functions. No behavior change; they must stay byte-compatible.

```ts
import crypto from 'node:crypto'

const INICIS_SIGN_KEY = process.env.INICIS_SIGN_KEY ?? ''
const INICIS_API_KEY = process.env.INICIS_API_KEY ?? ''

export function buildSignature(params: { oid: string; price: number; timestamp: string }): string {
  const raw = `oid=${params.oid}&price=${params.price}&timestamp=${params.timestamp}`
  return crypto.createHash('sha256').update(raw).digest('hex')
}

// ... additional helpers copied verbatim from existing route
```

(Exact content depends on Step 5.1 inspection — preserve the existing signature math exactly; only the file location changes.)

- [ ] **Step 5.3: Implement `InicisAdapter` in `inicis/index.ts`**

```ts
import type { PaymentAdapter, AdapterOrderSnapshot, PrepareOpts, PrepareResult, CallbackResult, RefundParams, RefundResult } from '../adapter'
import { buildSignature /* plus any other needed helpers */ } from './signature'
import { refundInicis } from './refund'

const INICIS_MID = process.env.INICIS_MID ?? 'INIpayTest'
const INICIS_TEST_MODE = process.env.INICIS_TEST_MODE !== 'false'

export class InicisAdapter implements PaymentAdapter {
  readonly id = 'inicis'
  readonly displayName = '신용카드 (이니시스)'
  readonly supportedMethods = ['card', 'account_transfer', 'virtual_account', 'mobile'] as const

  async prepare(order: AdapterOrderSnapshot, opts: PrepareOpts): Promise<PrepareResult> {
    const timestamp = String(Date.now())
    const signature = buildSignature({
      oid: order.orderNo, price: order.finalPrice, timestamp,
    })
    // Build Inicis form fields (copy from existing route.ts payment data build).
    // Return kind='form' with formAction pointing at INIStdPay.js target and formFields populated.
    return {
      kind: 'form',
      formAction: /* inicis stdpay action URL */ '',
      formFields: {
        version: '1.0',
        mid: INICIS_MID,
        oid: order.orderNo,
        price: String(order.finalPrice),
        timestamp,
        signature,
        returnUrl: opts.returnUrl,
        closeUrl: opts.closeUrl,
        // ... remaining required fields copied from existing implementation
      },
    }
  }

  async handleCallback(rawRequest: unknown): Promise<CallbackResult> {
    // Verify signature, parse Inicis response body, extract pgTransactionId (TID) and paidAmount.
    // Port verification logic from api/payment/inicis/return/route.ts.
    // Return CallbackResult with success/failure.
    const req = rawRequest as any
    // ... verification
    return {
      success: true,
      pgTransactionId: req.tid,
      paidAmount: Number(req.TotPrice),
      method: 'card',
      rawResponse: req,
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    return refundInicis(params)
  }
}
```

- [ ] **Step 5.4: Implement `inicis/refund.ts`**

```ts
import crypto from 'node:crypto'
import type { RefundParams, RefundResult } from '../adapter'

const INICIS_REFUND_URL = process.env.INICIS_TEST_MODE !== 'false'
  ? 'https://stginiapi.inicis.com/api/v1/refund'
  : 'https://iniapi.inicis.com/api/v1/refund'

const INICIS_API_KEY = process.env.INICIS_API_KEY ?? ''
const INICIS_API_IV = process.env.INICIS_API_IV ?? ''

export async function refundInicis(params: RefundParams): Promise<RefundResult> {
  const timestamp = Date.now().toString()
  const clientIp = '127.0.0.1'
  const body = {
    type: 'Refund',
    paymethod: 'Card',
    timestamp,
    clientIp,
    mid: process.env.INICIS_MID,
    tid: params.pgTransactionId,
    msg: params.reason,
  }
  const hashData = `${INICIS_API_KEY}${body.type}${body.paymethod}${timestamp}${clientIp}${body.mid}${body.tid}`
  const hash = crypto.createHash('sha512').update(hashData).digest('hex')
  const res = await fetch(INICIS_REFUND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, hashData: hash }),
  })
  const json = await res.json() as any
  if (json.resultCode === '00') {
    return { success: true, refundedAmount: params.amount, pgRefundId: json.tid }
  }
  return { success: false, refundedAmount: 0, errorMessage: `${json.resultCode}: ${json.resultMsg}` }
}
```

Verify exact Inicis refund API signature requirements against their docs before shipping.

- [ ] **Step 5.5: Type check**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

---

## Task 6: BankDepositAdapter + adapter bootstrap commit

**Files:**
- Create: `src/plugins/shop/payments/bank_deposit/index.ts`

- [ ] **Step 6.1: Implement `BankDepositAdapter`**

```ts
import type { PaymentAdapter, PrepareResult, CallbackResult, RefundParams, RefundResult } from '../adapter'

export class BankDepositAdapter implements PaymentAdapter {
  readonly id = 'bank_deposit'
  readonly displayName = '무통장입금'
  readonly supportedMethods = ['bank_deposit'] as const

  async prepare(): Promise<PrepareResult> {
    return { kind: 'manual' }
  }

  async handleCallback(rawRequest: unknown): Promise<CallbackResult> {
    // Invoked when admin marks "입금확인". rawRequest carries { orderId, confirmedAmount }.
    const req = rawRequest as { orderNo: string; confirmedAmount: number }
    return {
      success: true,
      pgTransactionId: `manual-${req.orderNo}`,
      paidAmount: req.confirmedAmount,
      method: 'bank_deposit',
      rawResponse: req,
    }
  }

  async refund(_params: RefundParams): Promise<RefundResult> {
    // Manual process — admin performs bank transfer outside the system, then marks complete.
    // System only records that refund was issued; no PG API exists.
    return { success: true, refundedAmount: _params.amount, pgRefundId: `manual-refund-${Date.now()}` }
  }
}
```

- [ ] **Step 6.2: Type-check end-to-end**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6.3: Commit Tasks 4 + 5 + 6 together**

```bash
git -C src/plugins/shop add payments/ lib/shop-settings.ts
git -C src/plugins/shop commit -m "feat(payments): PaymentAdapter interface, registry, Inicis + BankDeposit adapters"
```

---

## Task 7: PG-agnostic payment API endpoints

**Files:**
- Create: `src/plugins/shop/api/payment/init/route.ts`
- Create: `src/plugins/shop/api/payment/callback/[adapterId]/route.ts`
- Create: `src/plugins/shop/api/payment/methods/route.ts`
- Modify: `src/plugins/shop/api/orders/route.ts` (existing POST creates Order row in 'pending' — ensure it now sets `paymentGateway` via resolveMethodToAdapter)

- [ ] **Step 7.1: Implement `GET /api/shop/payment/methods`**

`api/payment/methods/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { listEnabled } from '@/plugins/shop/payments/registry'

bootstrapPaymentAdapters()

export async function GET() {
  const enabled = await listEnabled()
  return NextResponse.json({
    methods: enabled.flatMap(a => a.supportedMethods.map(m => ({
      method: m, adapterId: a.id, displayName: a.displayName,
    }))),
  })
}
```

- [ ] **Step 7.2: Implement `POST /api/shop/payment/init`**

`api/payment/init/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { resolveMethodToAdapter } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import type { PayMethod } from '@/plugins/shop/payments/adapter'

bootstrapPaymentAdapters()

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const body = await req.json()
  const { items, buyer, shipping, method } = body as {
    items: { productId: number; optionId: number | null; quantity: number }[]
    buyer: { name: string; phone: string; email?: string }
    shipping: { recipientName: string; recipientPhone: string; zipCode: string; address: string; addressDetail?: string; deliveryMemo?: string; deliveryFee: number }
    method: PayMethod
  }

  const adapter = await resolveMethodToAdapter(method)
  if (!adapter) return NextResponse.json({ error: 'payment method unavailable' }, { status: 400 })

  // Compute totals server-side. Create Order row in 'pending' state with paymentGateway=adapter.id, paymentMethod=method.
  // (Exact price calculation mirrors existing /api/shop/orders POST logic.)
  const orderNo = await generateOrderNo()
  const { totalPrice, finalPrice, orderItems } = await buildOrderDraft(items, shipping.deliveryFee)

  const order = await prisma.$transaction(async tx => {
    const created = await tx.order.create({
      data: {
        orderNo, userId: session.id,
        ordererName: buyer.name, ordererPhone: buyer.phone, ordererEmail: buyer.email,
        recipientName: shipping.recipientName, recipientPhone: shipping.recipientPhone,
        zipCode: shipping.zipCode, address: shipping.address, addressDetail: shipping.addressDetail,
        deliveryMemo: shipping.deliveryMemo,
        totalPrice, deliveryFee: shipping.deliveryFee, finalPrice,
        status: 'pending', paymentMethod: method, paymentGateway: adapter.id,
        items: { create: orderItems },
      },
    })
    await logActivity(tx, {
      orderId: created.id, actorType: 'customer', actorId: session.id, action: 'order_created',
      toStatus: 'pending', payload: { method, adapterId: adapter.id, amount: finalPrice },
    })
    return created
  })

  const baseUrl = new URL(req.url).origin
  const prepare = await adapter.prepare(
    { id: order.id, orderNo: order.orderNo, finalPrice, ordererName: buyer.name, ordererPhone: buyer.phone, ordererEmail: buyer.email, items: orderItems.map(i => ({ productName: i.productName, quantity: i.quantity })) },
    { returnUrl: `${baseUrl}/api/shop/payment/callback/${adapter.id}`, closeUrl: `${baseUrl}/shop/order` },
  )
  return NextResponse.json({ orderNo: order.orderNo, prepare })
}

// Implementations ported from src/plugins/shop/api/orders/route.ts — see Step 7.2a below.
```

- [ ] **Step 7.2a: Port `generateOrderNo` and `buildOrderDraft`**

Read `src/plugins/shop/api/orders/route.ts` (existing POST for bank_deposit orders). Locate:
- The order number generator (likely inline — builds YYMMDDHH + random digits to match format `26042207-4895769`). Extract into `generateOrderNo(): Promise<string>`.
- The item validation + price totaling loop that reads `Product` and `ProductOption`, computes `subtotal = price * quantity`, `totalPrice = sum`, `finalPrice = totalPrice + deliveryFee`. Extract into `buildOrderDraft(items, deliveryFee): Promise<{ totalPrice, finalPrice, orderItems }>` where `orderItems` is the array shape expected by `prisma.order.create({ data: { items: { create: orderItems } } })`.

Place both helpers at the bottom of `api/payment/init/route.ts` (file-local — they're not reused elsewhere in Phase 1). Keep the exact math and validation from the existing code; do not "improve" anything during the move.

- [ ] **Step 7.3: Implement `POST /api/shop/payment/callback/[adapterId]`**

`api/payment/callback/[adapterId]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { assertOrderTransition } from '@/plugins/shop/fulfillment/state-machine'

bootstrapPaymentAdapters()

export async function POST(req: Request, { params }: { params: Promise<{ adapterId: string }> }) {
  const { adapterId } = await params
  const adapter = get(adapterId)
  if (!adapter) return NextResponse.json({ error: 'unknown adapter' }, { status: 404 })

  const raw = await parsePgRequest(req, adapter.id)  // Inicis posts form-urlencoded; Kakao posts JSON — dispatch per adapter.
  const result = await adapter.handleCallback(raw)

  const orderNo = extractOrderNo(raw, adapter.id)   // adapter-specific extractor
  const order = await prisma.order.findUnique({ where: { orderNo } })
  if (!order) return NextResponse.json({ error: 'order not found' }, { status: 404 })

  if (!result.success) {
    await prisma.$transaction(async tx => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'cancelled', cancelReason: result.errorMessage ?? 'payment failed', cancelledAt: new Date() },
      })
      await logActivity(tx, {
        orderId: order.id, actorType: 'system', action: 'payment_failed',
        fromStatus: order.status, toStatus: 'cancelled',
        payload: { raw: result.rawResponse, error: result.errorMessage },
      })
    })
    return NextResponse.redirect(new URL(`/shop/order/failed?orderNo=${orderNo}`, req.url))
  }

  assertOrderTransition(order.status as any, 'paid')
  await prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'paid', paidAt: new Date(),
        paymentMethod: result.method,
        pgTransactionId: result.pgTransactionId,
        paymentInfo: JSON.stringify(result.rawResponse),
      },
    })
    // Decrement stock for each order item (port logic from existing complete-payment path).
    await logActivity(tx, {
      orderId: order.id, actorType: 'system', action: 'payment_succeeded',
      fromStatus: order.status, toStatus: 'paid',
      payload: { amount: result.paidAmount, pgTransactionId: result.pgTransactionId, method: result.method },
    })
  })
  return NextResponse.redirect(new URL(`/shop/order/complete?orderNo=${orderNo}`, req.url))
}

async function parsePgRequest(req: Request, adapterId: string): Promise<unknown> {
  if (adapterId === 'inicis') {
    const form = await req.formData()
    return Object.fromEntries(form.entries())
  }
  return await req.json()
}

function extractOrderNo(raw: any, adapterId: string): string {
  if (adapterId === 'inicis') return raw.MOID ?? raw.oid
  if (adapterId === 'bank_deposit') return raw.orderNo
  throw new Error(`unknown adapter ${adapterId}`)
}
```

Stock decrement logic must be ported from the existing Inicis return route. Reuse the exact transaction body.

- [ ] **Step 7.4: Update env docs**

Add note to project `.env.example` or README about Inicis env vars now read only from the adapter (`INICIS_MID`, `INICIS_SIGN_KEY`, `INICIS_API_KEY`, `INICIS_API_IV`, `INICIS_TEST_MODE`).

- [ ] **Step 7.5: Manual smoke test**

1. Run `npm run dev`.
2. Visit `http://localhost:3001/api/shop/payment/methods` — expect JSON with `card`, `account_transfer`, `virtual_account`, `mobile`, `bank_deposit` entries.
3. From `/shop/order`, place a test order via Inicis test-MID. Observe:
   - `orders` row inserted with `paymentGateway='inicis'`, `paymentMethod='card'`, status flips pending → paid.
   - `order_activities` rows: `order_created` then `payment_succeeded`.
4. Place a bank_deposit order. Observe status stays `pending`, `paymentGateway='bank_deposit'`.

Command to tail activities after a test order:
```bash
mariadb -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -P"$MYSQL_PORT" "$MYSQL_DB" \
  -e "SELECT orderId, actorType, action, fromStatus, toStatus, createdAt FROM order_activities ORDER BY id DESC LIMIT 10;"
```

- [ ] **Step 7.6: Delete legacy Inicis routes**

Only after smoke test passes:
```bash
rm -rf src/plugins/shop/api/payment/inicis
```

Check for dangling references:
```bash
grep -rn "api/shop/payment/inicis" src/plugins/shop
```
Expected: no results. If references exist (e.g., in checkout page), update them to new paths.

- [ ] **Step 7.7: Commit**

```bash
git -C src/plugins/shop add api/payment/ api/orders/ # orders route if modified
git -C src/plugins/shop add -u api/payment/inicis    # record deletions
git -C src/plugins/shop commit -m "feat(payments): PG-agnostic /payment/init and /payment/callback endpoints; remove legacy inicis routes"
```

---

## Task 8: Customer checkout — dynamic payment methods

**Files:**
- Modify: `src/plugins/shop/routes/order/page.tsx`
- Modify: `src/plugins/shop/locales/ko.json`, `src/plugins/shop/locales/en.json`

- [ ] **Step 8.1: Replace hardcoded method selection with fetched list**

In the order page, near the current `paymentMethod` state:

```tsx
const [paymentMethod, setPaymentMethod] = useState<string>('')
const [availableMethods, setAvailableMethods] = useState<
  { method: string; adapterId: string; displayName: string }[]
>([])

useEffect(() => {
  fetch('/api/shop/payment/methods')
    .then(r => r.json())
    .then(d => {
      setAvailableMethods(d.methods)
      if (d.methods.length > 0) setPaymentMethod(d.methods[0].method)
    })
}, [])
```

Replace the existing radio group for payment methods with:

```tsx
<RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
  {availableMethods.map(m => (
    <div key={`${m.adapterId}:${m.method}`} className="flex items-center space-x-2">
      <RadioGroupItem value={m.method} id={`pm-${m.method}`} />
      <Label htmlFor={`pm-${m.method}`}>
        {t(`checkout.methods.${m.method}`, { default: m.displayName })}
      </Label>
    </div>
  ))}
</RadioGroup>
```

- [ ] **Step 8.2: Route submit through `/api/shop/payment/init`**

Replace the current submit handler's `fetch("/api/shop/payment/inicis", ...)` call with:

```ts
const res = await fetch('/api/shop/payment/init', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    items: orderItems.map(i => ({ productId: i.productId, optionId: i.optionId, quantity: i.quantity })),
    buyer: { name: ordererName, phone: ordererPhone, email: ordererEmail || undefined },
    shipping: {
      recipientName, recipientPhone, zipCode, address,
      addressDetail: addressDetail || undefined,
      deliveryMemo: getDeliveryMemo(),
      deliveryFee,
    },
    method: paymentMethod,
  }),
})
const { orderNo, prepare } = await res.json()

if (prepare.kind === 'manual') {
  // bank_deposit — immediately navigate to complete page with pending status
  router.push(`/shop/order/complete?orderNo=${orderNo}&pending=1`)
} else if (prepare.kind === 'form') {
  // Inicis — submit hidden form to prepare.formAction with prepare.formFields
  submitHiddenForm(prepare.formAction!, prepare.formFields!)
} else if (prepare.kind === 'redirect') {
  window.location.href = prepare.redirectUrl!
}
```

`submitHiddenForm` is a small local util. **Note:** Inicis does not use a plain HTTP POST — after the form is populated, the merchant page must call `window.INIStdPay.pay(formId)`. Pattern:

```ts
async function submitHiddenForm(action: string, fields: Record<string, string>) {
  const form = document.createElement('form')
  form.method = 'post'
  form.action = action
  form.id = 'pgPayForm'
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type = 'hidden'; input.name = name; input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  // Inicis uses INIStdPay.pay('<formId>') to trigger the modal; other PGs use a plain submit.
  const win = window as any
  if (win.INIStdPay && fields.mid) {
    win.INIStdPay.pay('pgPayForm')
  } else {
    form.submit()
  }
}
```

Ensure `INIStdPay.js` is still loaded via `<Script src="https://stgstdpay.inicis.com/stdjs/INIStdPay.js" strategy="afterInteractive" />` on the checkout page. (The existing page has this; retain it.)

- [ ] **Step 8.3: Update translations**

Add to `src/plugins/shop/locales/ko.json` under existing `shop.checkout`:
```json
"methods": {
  "card": "신용카드",
  "account_transfer": "실시간 계좌이체",
  "virtual_account": "가상계좌",
  "mobile": "휴대폰 결제",
  "bank_deposit": "무통장입금"
}
```

And `en.json`:
```json
"methods": {
  "card": "Credit card",
  "account_transfer": "Real-time bank transfer",
  "virtual_account": "Virtual account",
  "mobile": "Mobile payment",
  "bank_deposit": "Bank deposit (manual)"
}
```

Rebuild merged locales: run `node scripts/scan-plugins.js`.

- [ ] **Step 8.4: Manual verification**

1. `npm run dev`
2. Visit `/shop/order`. Select items, fill buyer/shipping, pick each payment method (card, bank_deposit). Confirm order flow completes for both.
3. DB check: `SELECT orderNo, paymentGateway, paymentMethod, status FROM orders ORDER BY id DESC LIMIT 3;`

- [ ] **Step 8.5: Commit**

```bash
git -C src/plugins/shop add routes/order/page.tsx locales/
git -C src/plugins/shop commit -m "feat(checkout): dynamic payment methods from enabled adapters"
```

---

## Task 9: Admin — ActivityTimeline component + API

**Files:**
- Create: `src/plugins/shop/admin/orders/components/ActivityTimeline.tsx`
- Create: `src/plugins/shop/api/admin/orders/[id]/activities/route.ts`

- [ ] **Step 9.1: Activities API endpoint**

`api/admin/orders/[id]/activities/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const activities = await prisma.orderActivity.findMany({
    where: { orderId: Number(id) },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ activities })
}
```

- [ ] **Step 9.2: ActivityTimeline component**

`admin/orders/components/ActivityTimeline.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { format } from "date-fns"

interface Activity {
  id: number
  actorType: string
  actorId: number | null
  action: string
  fromStatus: string | null
  toStatus: string | null
  payload: any
  memo: string | null
  createdAt: string
}

const ACTION_LABEL_KO: Record<string, string> = {
  order_created: '주문 생성',
  payment_succeeded: '결제 완료',
  payment_failed: '결제 실패',
  status_changed: '상태 변경',
  tracking_updated: '송장 업데이트',
  memo_updated: '관리자 메모 변경',
  cancel_requested: '취소 요청',
  cancelled: '취소 완료',
  refund_issued: '환불 처리',
}

export function ActivityTimeline({ orderId }: { orderId: number }) {
  const [items, setItems] = useState<Activity[]>([])
  useEffect(() => {
    fetch(`/api/admin/shop/orders/${orderId}/activities`)
      .then(r => r.json())
      .then(d => setItems(d.activities))
  }, [orderId])

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm">활동 이력</h3>
      <ol className="relative border-l border-border pl-4 space-y-4">
        {items.map(a => (
          <li key={a.id}>
            <div className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary" />
            <time className="text-xs text-muted-foreground">
              {format(new Date(a.createdAt), 'yyyy-MM-dd HH:mm:ss')}
            </time>
            <div className="text-sm font-medium">
              {ACTION_LABEL_KO[a.action] ?? a.action}
              {a.fromStatus && a.toStatus && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {a.fromStatus} → {a.toStatus}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {a.actorType === 'system' ? '시스템' : a.actorType === 'admin' ? `관리자#${a.actorId}` : `고객#${a.actorId}`}
            </div>
            {a.memo && <div className="text-xs italic mt-1">{a.memo}</div>}
            {a.payload && <pre className="text-[10px] bg-muted/40 p-1 rounded mt-1 overflow-x-auto">{JSON.stringify(a.payload, null, 0)}</pre>}
          </li>
        ))}
      </ol>
    </div>
  )
}
```

- [ ] **Step 9.3: Inject into admin order detail page**

In `src/plugins/shop/admin/orders/[id]/page.tsx`, add a sidebar column with the component. Find the outermost layout container and wrap the existing content in a two-column grid:

Locate:
```tsx
<div className="container mx-auto p-6">
  {/* existing order detail body */}
</div>
```

Replace with:
```tsx
<div className="container mx-auto p-6 grid gap-6 lg:grid-cols-[1fr_320px]">
  <div>
    {/* existing order detail body */}
  </div>
  <aside>
    <ActivityTimeline orderId={order.id} />
  </aside>
</div>
```

Add import at top: `import { ActivityTimeline } from './components/ActivityTimeline'`.

- [ ] **Step 9.4: Verify**

1. `npm run dev`
2. Visit `/admin/shop/orders/<id>` for any existing order. Sidebar shows timeline.
3. Place a fresh test order; reload — new `order_created` + `payment_succeeded` entries appear.

- [ ] **Step 9.5: Commit**

```bash
git -C src/plugins/shop add admin/orders/ api/admin/orders/
git -C src/plugins/shop commit -m "feat(admin): add order activity timeline"
```

---

## Task 10: Admin — status transitions + audit on memo/tracking

**Files:**
- Create: `src/plugins/shop/admin/orders/components/StatusTransitionBar.tsx`
- Create: `src/plugins/shop/api/admin/orders/[id]/ship/route.ts`
- Create: `src/plugins/shop/api/admin/orders/[id]/deliver/route.ts`
- Create: `src/plugins/shop/api/admin/orders/[id]/cancel/route.ts`
- Modify: `src/plugins/shop/admin/orders/[id]/page.tsx` (replace inline status controls)
- Modify: `src/plugins/shop/api/admin/orders/[id]/route.ts` (existing PATCH — log memo/tracking changes)

- [ ] **Step 10.1: Ship endpoint**

`api/admin/orders/[id]/ship/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { trackingCompany, trackingNumber } = await req.json()
  if (!trackingCompany || !trackingNumber) {
    return NextResponse.json({ error: 'tracking required' }, { status: 400 })
  }
  const orderId = Number(id)
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
  assertOrderTransition(order.status as any, 'shipping')
  await prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'shipping', shippedAt: new Date(), trackingCompany, trackingNumber },
    })
    await logActivity(tx, {
      orderId, actorType: 'admin', actorId: session.id, action: 'tracking_updated',
      fromStatus: order.status, toStatus: 'shipping',
      payload: { trackingCompany, trackingNumber },
    })
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 10.2: Deliver endpoint**

`api/admin/orders/[id]/deliver/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const orderId = Number(id)
  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })
  assertOrderTransition(order.status as any, 'delivered')
  await prisma.$transaction(async tx => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'delivered', deliveredAt: new Date() },
    })
    await logActivity(tx, {
      orderId, actorType: 'admin', actorId: session.id, action: 'status_changed',
      fromStatus: order.status, toStatus: 'delivered',
    })
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 10.3: Cancel endpoint (with refund)**

`api/admin/orders/[id]/cancel/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

bootstrapPaymentAdapters()

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { reason } = await req.json()
  const orderId = Number(id)
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } })
  if (!order) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Refund if already paid
  let refundResult: { success: boolean; refundedAmount: number; errorMessage?: string } | null = null
  if (order.paidAt && order.paymentGateway && order.pgTransactionId) {
    const adapter = getAdapter(order.paymentGateway)
    if (!adapter) return NextResponse.json({ error: 'adapter unavailable for refund' }, { status: 500 })
    refundResult = await adapter.refund({
      pgTransactionId: order.pgTransactionId, amount: order.finalPrice, reason: reason ?? 'admin cancel', orderRef: order.orderNo,
    })
    if (!refundResult.success) {
      return NextResponse.json({ error: 'refund failed', detail: refundResult.errorMessage }, { status: 502 })
    }
  }

  await prisma.$transaction(async tx => {
    // Restore stock (port from existing cancel logic)
    for (const item of order.items) {
      if (item.productId) {
        await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
      }
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled', cancelledAt: new Date(), cancelReason: reason,
        refundAmount: refundResult?.refundedAmount ?? null,
        refundedAt: refundResult ? new Date() : null,
      },
    })
    await logActivity(tx, {
      orderId, actorType: 'admin', actorId: session.id, action: 'cancelled',
      fromStatus: order.status, toStatus: 'cancelled',
      payload: { reason, refund: refundResult },
    })
    if (refundResult?.success) {
      await logActivity(tx, {
        orderId, actorType: 'system', action: 'refund_issued',
        payload: { amount: refundResult.refundedAmount },
      })
    }
  })
  return NextResponse.json({ ok: true, refund: refundResult })
}
```

- [ ] **Step 10.4: StatusTransitionBar component**

`admin/orders/components/StatusTransitionBar.tsx`:

```tsx
"use client"
import { Button } from "@/components/ui/button"
import { allowedTransitions, type OrderStatus } from "@/plugins/shop/fulfillment/state-machine"

interface Props {
  orderId: number
  status: OrderStatus
  onChanged: () => void
}

const LABEL: Record<OrderStatus, string> = {
  pending: '결제대기', paid: '결제완료', preparing: '배송준비',
  shipping: '배송중', delivered: '배송완료', confirmed: '구매확정',
  cancel_requested: '취소요청', cancelled: '취소완료',
}

export function StatusTransitionBar({ orderId, status, onChanged }: Props) {
  const next = allowedTransitions(status)

  const transition = async (to: OrderStatus) => {
    const map: Partial<Record<OrderStatus, string>> = {
      shipping: `/api/admin/shop/orders/${orderId}/ship`,
      delivered: `/api/admin/shop/orders/${orderId}/deliver`,
      cancelled: `/api/admin/shop/orders/${orderId}/cancel`,
    }
    const endpoint = map[to]
    if (!endpoint) return
    if (to === 'shipping') {
      const company = prompt('택배사 (예: CJ대한통운)')
      const number = prompt('송장번호')
      if (!company || !number) return
      await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trackingCompany: company, trackingNumber: number }) })
    } else if (to === 'cancelled') {
      const reason = prompt('취소 사유')
      if (reason === null) return
      await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    } else {
      await fetch(endpoint, { method: 'POST' })
    }
    onChanged()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium px-3 py-1 rounded bg-muted">{LABEL[status]}</span>
      {next.map(to => (
        <Button key={to} variant="outline" size="sm" onClick={() => transition(to)}>
          → {LABEL[to]}
        </Button>
      ))}
    </div>
  )
}
```

The inline `prompt()` is placeholder-grade UX sufficient for Phase 1; Phase 2 UI cleanup may replace with a dialog.

- [ ] **Step 10.5: Wire into admin order detail**

In `admin/orders/[id]/page.tsx`, replace the existing status dropdown + save button with:

```tsx
<StatusTransitionBar
  orderId={order.id}
  status={order.status as OrderStatus}
  onChanged={() => fetchOrder()}
/>
```

Keep the existing tracking input UI for direct edits if it already exists, but also wire the memo save to log an activity:

In the existing memo PATCH handler (`api/admin/orders/[id]/route.ts`), wrap the update in `prisma.$transaction` and add `logActivity` call with action `memo_updated` if the memo changed.

- [ ] **Step 10.6: Verify manually**

1. Open an order in `preparing`. Click `→ 배송중`, enter tracking. Status flips to `shipping`; timeline shows `tracking_updated`.
2. Click `→ 배송완료`. Status flips to `delivered`; timeline shows `status_changed: shipping → delivered`.
3. Open a paid order, click `→ 취소완료`, enter reason. Inicis test MID issues refund; activity shows `cancelled` + `refund_issued`.
4. Edit admin memo, save. Activity shows `memo_updated`.

- [ ] **Step 10.7: Commit**

```bash
git -C src/plugins/shop add admin/orders/ api/admin/orders/
git -C src/plugins/shop commit -m "feat(admin): status transition buttons, ship/deliver/cancel API, memo audit log"
```

---

## Task 11: Admin orders list — orderType badge, PG filter, bulk ship

**Files:**
- Modify: `src/plugins/shop/admin/orders/page.tsx`
- Create: `src/plugins/shop/admin/orders/components/BulkShipDialog.tsx`
- Create: `src/plugins/shop/api/admin/orders/bulk-ship/route.ts`
- Modify: `src/plugins/shop/api/admin/orders/route.ts` (list endpoint — include orderType, paymentGateway; accept filter params)

- [ ] **Step 11.1: Extend list API**

In `api/admin/orders/route.ts` (existing admin orders list), add query-string filters for `paymentGateway` and `orderType`, and ensure the select includes both columns.

- [ ] **Step 11.2: Add badge and filter UI**

In `admin/orders/page.tsx`:
- Add a `paymentGateway` filter dropdown next to existing status filter.
- In the row, beside the order number, render:
  ```tsx
  {order.orderType === 'exchange' && (
    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">교환발송</span>
  )}
  ```
- Add "일괄 송장입력" button above the table that opens `BulkShipDialog` with currently selected rows.

- [ ] **Step 11.3: BulkShipDialog**

`admin/orders/components/BulkShipDialog.tsx`:

```tsx
"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Props {
  open: boolean
  onClose: () => void
  selectedOrderIds: number[]
  onDone: () => void
}

export function BulkShipDialog({ open, onClose, selectedOrderIds, onDone }: Props) {
  const [rows, setRows] = useState<Record<number, { company: string; number: string }>>({})
  const submit = async () => {
    const payload = Object.entries(rows).map(([id, v]) => ({ orderId: Number(id), trackingCompany: v.company, trackingNumber: v.number }))
    const res = await fetch('/api/admin/shop/orders/bulk-ship', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: payload }) })
    if (res.ok) { onDone(); onClose() }
  }
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>일괄 송장입력 ({selectedOrderIds.length}건)</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {selectedOrderIds.map(id => (
            <div key={id} className="flex items-center gap-2">
              <span className="text-sm w-16">#{id}</span>
              <Input placeholder="택배사" onChange={e => setRows(r => ({ ...r, [id]: { ...(r[id] ?? { company:'', number:'' }), company: e.target.value } }))} />
              <Input placeholder="송장번호" onChange={e => setRows(r => ({ ...r, [id]: { ...(r[id] ?? { company:'', number:'' }), number: e.target.value } }))} />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button onClick={submit}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 11.4: Bulk ship API**

`api/admin/orders/bulk-ship/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { items } = await req.json() as { items: { orderId: number; trackingCompany: string; trackingNumber: string }[] }
  const results: { orderId: number; ok: boolean; error?: string }[] = []
  for (const it of items) {
    try {
      const order = await prisma.order.findUnique({ where: { id: it.orderId } })
      if (!order) { results.push({ orderId: it.orderId, ok: false, error: 'not found' }); continue }
      assertOrderTransition(order.status as any, 'shipping')
      await prisma.$transaction(async tx => {
        await tx.order.update({ where: { id: it.orderId }, data: { status: 'shipping', shippedAt: new Date(), trackingCompany: it.trackingCompany, trackingNumber: it.trackingNumber } })
        await logActivity(tx, { orderId: it.orderId, actorType: 'admin', actorId: session.id, action: 'tracking_updated', fromStatus: order.status, toStatus: 'shipping', payload: { trackingCompany: it.trackingCompany, trackingNumber: it.trackingNumber } })
      })
      results.push({ orderId: it.orderId, ok: true })
    } catch (e: any) {
      results.push({ orderId: it.orderId, ok: false, error: e.message })
    }
  }
  return NextResponse.json({ results })
}
```

- [ ] **Step 11.5: Manual test**

1. Select 2 orders in `preparing` state via checkboxes on the list page.
2. Click "일괄 송장입력". Fill both rows. Click 저장.
3. Both orders flip to `shipping` with tracking; timeline on each shows `tracking_updated`.

- [ ] **Step 11.6: Commit**

```bash
git -C src/plugins/shop add admin/orders/ api/admin/orders/
git -C src/plugins/shop commit -m "feat(admin): orderType badge, PG filter, bulk ship dialog"
```

---

## Task 12: Customer — order detail page with status stepper + confirm

**Files:**
- Create: `src/plugins/shop/routes/mypage/orders/[orderNo]/page.tsx`
- Create: `src/plugins/shop/api/shop/orders/[orderNo]/confirm/route.ts`
- Modify: `src/plugins/shop/routes/mypage/orders/page.tsx` (add status stepper and confirm button on each row)

- [ ] **Step 12.1: Confirm endpoint**

`api/shop/orders/[orderNo]/confirm/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertOrderTransition } from '@/plugins/shop/fulfillment/state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(_req: Request, { params }: { params: Promise<{ orderNo: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { orderNo } = await params
  const order = await prisma.order.findUnique({ where: { orderNo } })
  if (!order || order.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  assertOrderTransition(order.status as any, 'confirmed')
  await prisma.$transaction(async tx => {
    await tx.order.update({ where: { id: order.id }, data: { status: 'confirmed' } })
    await logActivity(tx, { orderId: order.id, actorType: 'customer', actorId: session.id, action: 'status_changed', fromStatus: order.status, toStatus: 'confirmed' })
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 12.2: Customer order detail page**

`routes/mypage/orders/[orderNo]/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const STEPS = [
  { key: 'paid', label: '결제완료' },
  { key: 'preparing', label: '배송준비' },
  { key: 'shipping', label: '배송중' },
  { key: 'delivered', label: '배송완료' },
  { key: 'confirmed', label: '구매확정' },
]

export default function OrderDetailPage() {
  const { orderNo } = useParams<{ orderNo: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<any>(null)
  const load = () => fetch(`/api/shop/orders/${orderNo}`).then(r => r.json()).then(d => setOrder(d.order))
  useEffect(() => { load() }, [orderNo])
  if (!order) return <div className="container p-6">Loading...</div>

  const stepIndex = STEPS.findIndex(s => s.key === order.status)
  const confirm = async () => {
    const r = await fetch(`/api/shop/orders/${orderNo}/confirm`, { method: 'POST' })
    if (r.ok) load()
  }
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-xl font-semibold">주문 {order.orderNo}</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">진행 상태</CardTitle></CardHeader>
        <CardContent>
          <ol className="flex items-center">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex-1 flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${i <= stepIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{i+1}</div>
                <span className="ml-2 text-sm">{s.label}</span>
                {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 mx-2 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />}
              </li>
            ))}
          </ol>
          {order.status === 'delivered' && (
            <div className="pt-4"><Button onClick={confirm}>구매확정</Button></div>
          )}
          {order.trackingNumber && (
            <div className="pt-4 text-sm">택배사: {order.trackingCompany} / 송장: {order.trackingNumber}</div>
          )}
        </CardContent>
      </Card>
      {/* Items, address, payment info — port from existing mypage/orders/page.tsx per-row rendering */}
    </div>
  )
}
```

- [ ] **Step 12.3: Update existing orders list page**

In `routes/mypage/orders/page.tsx`, for each order row:
- Add a mini status stepper (5 dots with current highlighted).
- If `order.status === 'delivered'`, show `구매확정` button that calls `/api/shop/orders/${orderNo}/confirm`.
- Make the row clickable to navigate to `/shop/mypage/orders/${orderNo}`.

- [ ] **Step 12.4: Manual verification**

1. Log in as a customer.
2. Visit `/shop/mypage/orders`. Each order shows a stepper reflecting its status.
3. Click a `delivered` order. Detail page loads with stepper, `구매확정` button. Click it — row moves to `confirmed`; activity log records the transition.

- [ ] **Step 12.5: Commit**

```bash
git -C src/plugins/shop add routes/mypage/orders/ api/shop/orders/
git -C src/plugins/shop commit -m "feat(mypage): customer order detail page with stepper and purchase confirmation"
```

---

## Task 13: Auto-confirm cron

**Files:**
- Create: `scripts/cron/shop-auto-confirm.ts` (nexibase core)
- Modify: `package.json` (add `cron:shop-auto-confirm` script)

- [ ] **Step 13.1: Write the script**

`scripts/cron/shop-auto-confirm.ts`:

```ts
import { prisma } from '../../src/lib/prisma'
import { logActivity } from '../../src/plugins/shop/fulfillment/activities'
import { getShopSetting } from '../../src/plugins/shop/lib/shop-settings'

async function main() {
  const daysStr = (await getShopSetting('default_confirm_days')) ?? '7'
  const days = Number(daysStr)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const eligible = await prisma.order.findMany({
    where: { status: 'delivered', deliveredAt: { lte: cutoff } },
    select: { id: true, status: true },
  })
  console.log(`[auto-confirm] ${eligible.length} orders eligible (cutoff=${cutoff.toISOString()})`)
  for (const o of eligible) {
    await prisma.$transaction(async tx => {
      await tx.order.update({ where: { id: o.id }, data: { status: 'confirmed' } })
      await logActivity(tx, { orderId: o.id, actorType: 'system', action: 'status_changed', fromStatus: o.status, toStatus: 'confirmed' })
    })
    console.log(`[auto-confirm] order ${o.id} → confirmed`)
  }
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 13.2: Add package.json script**

In `package.json` scripts block:
```json
"cron:shop-auto-confirm": "tsx scripts/cron/shop-auto-confirm.ts",
```

- [ ] **Step 13.3: Seed a shop_setting default**

In an ad-hoc one-off, run:
```bash
npx tsx -e "import('./src/plugins/shop/lib/shop-settings').then(m => m.setShopSetting('default_confirm_days','7'))"
```

- [ ] **Step 13.4: Smoke test**

1. Manually set a delivered order's `deliveredAt` to 8 days ago:
   ```bash
   mariadb -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -P"$MYSQL_PORT" "$MYSQL_DB" \
     -e "UPDATE orders SET deliveredAt = NOW() - INTERVAL 8 DAY WHERE status='delivered' LIMIT 1;"
   ```
2. Run: `npm run cron:shop-auto-confirm`
3. Expected console: `1 orders eligible` and `order X → confirmed`. Verify DB.

- [ ] **Step 13.5: Document crontab setup**

Append to project README or `docs/superpowers/specs/2026-04-22-shop-fulfillment-design.md` §8 Operational Notes: "Schedule `npm run cron:shop-auto-confirm` to run daily via crontab or a host scheduler."

- [ ] **Step 13.6: Commit (nexibase core)**

```bash
git add scripts/cron/shop-auto-confirm.ts package.json
git commit -m "feat(shop): auto-confirm cron for delivered orders after configurable days"
```

---

## Task 14: Admin payment settings page

**Files:**
- Create: `src/plugins/shop/admin/payment-settings/page.tsx`
- Create: `src/plugins/shop/api/admin/payment-settings/route.ts`

- [ ] **Step 14.1: API**

`api/admin/payment-settings/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { getShopSetting, setShopSetting } from '@/plugins/shop/lib/shop-settings'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'

bootstrapPaymentAdapters()

const ALL_ADAPTERS = ['inicis', 'bank_deposit'] // extend as adapters added

export async function GET() {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const enabled = JSON.parse((await getShopSetting('enabled_payment_gateways')) ?? '["inicis","bank_deposit"]')
  const defaultCard = (await getShopSetting('default_card_gateway')) ?? 'inicis'
  const available = ALL_ADAPTERS.map(id => {
    const a = getAdapter(id)
    return a ? { id, displayName: a.displayName, supportedMethods: a.supportedMethods } : null
  }).filter(Boolean)
  return NextResponse.json({ enabled, defaultCard, available })
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session?.isAdmin) return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { enabled, defaultCard } = await req.json()
  if (!Array.isArray(enabled) || typeof defaultCard !== 'string') return NextResponse.json({ error: 'bad request' }, { status: 400 })
  await setShopSetting('enabled_payment_gateways', JSON.stringify(enabled))
  await setShopSetting('default_card_gateway', defaultCard)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 14.2: Admin page**

`admin/payment-settings/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"

export default function PaymentSettingsPage() {
  const [available, setAvailable] = useState<{ id: string; displayName: string; supportedMethods: string[] }[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [defaultCard, setDefaultCard] = useState('inicis')
  const load = () => fetch('/api/admin/shop/payment-settings').then(r => r.json()).then(d => { setAvailable(d.available); setEnabled(d.enabled); setDefaultCard(d.defaultCard) })
  useEffect(() => { load() }, [])
  const save = async () => {
    await fetch('/api/admin/shop/payment-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled, defaultCard }) })
    alert('저장됨')
  }
  const toggle = (id: string) => setEnabled(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const cardCapable = available.filter(a => a.supportedMethods.includes('card') && enabled.includes(a.id))
  return (
    <div className="container mx-auto p-6 space-y-4 max-w-2xl">
      <h1 className="text-xl font-semibold">결제 설정</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">활성 결제수단</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {available.map(a => (
            <label key={a.id} className="flex items-center gap-2">
              <Checkbox checked={enabled.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
              <span>{a.displayName}</span>
              <span className="text-xs text-muted-foreground">({a.supportedMethods.join(', ')})</span>
            </label>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">기본 카드 PG</CardTitle></CardHeader>
        <CardContent>
          <RadioGroup value={defaultCard} onValueChange={setDefaultCard}>
            {cardCapable.map(a => (
              <div key={a.id} className="flex items-center space-x-2">
                <RadioGroupItem value={a.id} id={`dcg-${a.id}`} />
                <Label htmlFor={`dcg-${a.id}`}>{a.displayName}</Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
      <Button onClick={save}>저장</Button>
    </div>
  )
}
```

- [ ] **Step 14.3: Route registration**

Ensure the plugin's admin routing scheme picks up `admin/payment-settings/page.tsx`. If the plugin uses a registry (`plugin.ts`), add a link entry for the admin menu.

- [ ] **Step 14.4: Manual verification**

1. Log in as admin. Visit `/admin/shop/payment-settings`.
2. Toggle bank_deposit off, save. Visit `/shop/order` — bank_deposit option gone.
3. Toggle it back on. Pick a different `default_card_gateway` (only inicis available now — test tolerates single-option radio).

- [ ] **Step 14.5: Commit**

```bash
git -C src/plugins/shop add admin/payment-settings/ api/admin/payment-settings/
git -C src/plugins/shop commit -m "feat(admin): payment settings page — enable gateways, pick default card PG"
```

---

## Task 15: Integration smoke test + deployment checklist

**Files:**
- Modify: `docs/superpowers/specs/2026-04-22-shop-fulfillment-design.md` (append deployment notes)

- [ ] **Step 15.1: Full round-trip test (Inicis test MID)**

Execute in order and record outcomes:

1. `npm run dev`
2. Visit `/shop/order`, place an order with **card (Inicis)**. Complete test payment. Verify:
   - `orders` row has `paymentGateway='inicis'`, `pgTransactionId` set, `status='paid'`.
   - `order_activities` has `order_created`, `payment_succeeded`.
3. Visit `/admin/shop/orders/<id>`. Click `→ 배송준비`, then `→ 배송중` (enter test tracking). Verify status and activity entries.
4. Click `→ 배송완료`. Customer-side `/shop/mypage/orders` shows the order in `delivered`. Click `구매확정`. Verify transition + activity.
5. Place another order. In admin, click `→ 취소완료` (enter reason). Verify Inicis test-MID refund API called; activities show `cancelled` + `refund_issued`; `refundAmount`/`refundedAt` populated.
6. Place a **bank_deposit** order. Verify status stays `pending` with `paymentGateway='bank_deposit'`, `paymentMethod='bank_deposit'`.
7. Run `npm run cron:shop-auto-confirm` on a `delivered`-aged row; verify transition.

Document any discrepancies; they are tasks.

- [ ] **Step 15.2: PG callback URL migration notes**

Append to spec § 8 Operational Notes:

```
- Before deploying Phase 1, update the Inicis merchant admin portal
  callback URL from /api/shop/payment/inicis/return to
  /api/shop/payment/callback/inicis. Deploy in a low-traffic window.
- After deployment, monitor /api/shop/payment/callback/inicis logs for
  failed callbacks for 24h. Legacy URL remains deleted; any Inicis
  retry at the old URL returns 404 and the PG will mark the payment
  as failed, which triggers the normal cancel path.
```

- [ ] **Step 15.3: Version bump**

In `src/plugins/shop/plugin.ts:4`, bump the `version:` field (current value `'1.0.0'` → `'1.1.0'` for this feature-scale release).

- [ ] **Step 15.4: Commit & push**

Shop submodule:
```bash
git -C src/plugins/shop push -u origin feat/shop-fulfillment-phase1
```

Nexibase core (including bumped submodule pointer):
```bash
git add src/plugins/shop docs/superpowers/specs/2026-04-22-shop-fulfillment-design.md
git commit -m "chore: bump shop submodule to fulfillment phase 1"
git push -u origin feat/shop-fulfillment-phase1
```

- [ ] **Step 15.5: Create PRs**

1. plugin-shop: `feat: fulfillment phase 1 — payment adapter, audit log, shipping workflow`
2. nexibase: `feat: shop fulfillment phase 1 — migration + submodule bump`

PR descriptions link to the spec and plan. Plugin-shop PR must be merged first; then update submodule pointer in the nexibase PR if it drifts.

---

## Post-Plan Notes

- Phase 2 (return/exchange) is a separate plan. Data model additions (`return_requests`, `return_items`, `shop_settings` new keys) will be in a new migration at that time.
- The `registry.test.ts` intentionally omits tests that require a running DB (`listEnabled`, `resolveMethodToAdapter`). Those are covered by the integration smoke test in Task 15.
- `StatusTransitionBar` uses `window.prompt()` for tracking/reason input as a Phase 1 shortcut. If you have spare cycles, replace with a shadcn Dialog at the end; otherwise leave for a later polish task.
- Exchange-related `orderType='exchange'` rendering in admin list (Task 11) is plumbed but not exercised in Phase 1; Phase 2 populates it.
