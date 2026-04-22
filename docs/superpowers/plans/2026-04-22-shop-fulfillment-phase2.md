# Shop Fulfillment Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the full return/exchange workflow to the shop plugin: customers submit requests with reason/photos at item+quantity granularity, admins approve/reject/collect/refund or create a replacement exchange order, and all transitions produce audit log entries. PG refund integration (Inicis) is exercised end-to-end. Notifications span in-app + email + opt-in SMS.

**Architecture:** Builds on Phase 1 data model and state machine. Two new tables (`return_requests`, `return_items`) plus four `shop_settings` keys. A new parallel state machine for return requests (requested → approved → collected → completed, with rejected terminal). Admin and customer UI mirror Phase 1's structure. A notifications module dispatches to three channels based on global + per-user toggles.

**Tech Stack:** Next.js 16 App Router, Prisma 6 + MariaDB, next-intl, shadcn/ui, existing `/api/upload` for photo uploads, CoolSMS (chosen at implementation start) for SMS.

**Spec:** [docs/superpowers/specs/2026-04-22-shop-fulfillment-design.md](../specs/2026-04-22-shop-fulfillment-design.md)

**Prerequisites:** Phase 1 must be merged first. This plan assumes:
- `order_activities` table exists and `logActivity()` helper is available
- `orders` has `originalOrderId`, `orderType`, `paymentGateway`, `pgTransactionId` columns
- `InicisAdapter.refund()` works end-to-end
- `shop_settings` is used for configuration
- Fulfillment module pattern is established in `src/plugins/shop/fulfillment/`

**Branch strategy:**
- **shop submodule:** branch `feat/shop-fulfillment-phase2` off merged `main` (after Phase 1 merges)
- **nexibase:** branch `feat/shop-fulfillment-phase2` off merged `main`

---

## File Structure

**New files in shop submodule:**

| File | Responsibility |
|---|---|
| `fulfillment/return-state-machine.ts` | `RETURN_TRANSITIONS`, `assertReturnTransition`, type definitions |
| `fulfillment/return-state-machine.test.ts` | Pure tests via `node:test` |
| `fulfillment/refund-calc.ts` | `calculateRefund({items, deductShippingFee})` |
| `fulfillment/refund-calc.test.ts` | Tests |
| `fulfillment/return-stock.ts` | `restoreStockForReturn(tx, returnRequest)` helper |
| `api/returns/route.ts` | Customer: `POST` create request, `GET` list own requests |
| `api/returns/[id]/route.ts` | Customer: `GET` detail, `DELETE` cancel (status=requested only) |
| `api/returns/[id]/tracking/route.ts` | Customer: `PATCH` add return tracking |
| `admin/api/returns/route.ts` | Admin: `GET` list + status filter |
| `admin/api/returns/[id]/route.ts` | Admin: `GET` detail |
| `admin/api/returns/[id]/approve/route.ts` | Admin: `POST` approve (sets customerBearsShipping) |
| `admin/api/returns/[id]/reject/route.ts` | Admin: `POST` reject (with reason) |
| `admin/api/returns/[id]/collect/route.ts` | Admin: `POST` mark collected (restores stock) |
| `admin/api/returns/[id]/refund/route.ts` | Admin: `POST` issue refund (type=return) |
| `admin/api/returns/[id]/exchange-order/route.ts` | Admin: `POST` create replacement order (type=exchange) |
| `admin/returns/page.tsx` | Admin returns list page (status tabs) |
| `admin/returns/[id]/page.tsx` | Admin returns detail + action buttons |
| `admin/orders/components/RelatedReturns.tsx` | Admin order detail — related returns section |
| `routes/mypage/orders/[orderNo]/return/page.tsx` | Customer return request form |
| `routes/mypage/returns/page.tsx` | Customer returns list |
| `routes/mypage/returns/[id]/page.tsx` | Customer returns detail (+ return tracking input) |
| `notifications/send.ts` | `sendNotification(user, event, data)` — dispatches to enabled channels |
| `notifications/channels/in-app.ts` | In-app via existing `notifications` table |
| `notifications/channels/email.ts` | Email via existing `src/lib/email.ts` |
| `notifications/channels/sms.ts` | SMS via CoolSMS (gated by global + user opt-in) |
| `notifications/templates/return-requested.ts` | Admin notification template |
| `notifications/templates/return-approved.ts` | Customer notification template |
| `notifications/templates/return-rejected.ts` | Customer notification template |
| `notifications/templates/return-collected.ts` | Customer notification template |
| `notifications/templates/return-refunded.ts` | Customer notification template |
| `notifications/templates/exchange-sent.ts` | Customer notification template |

**Modified files in shop submodule:**

| File | Change |
|---|---|
| `schema.prisma` | Add `ReturnRequest` and `ReturnItem` models |
| `admin/orders/[id]/page.tsx` | Inject `RelatedReturns` component below existing content |
| `routes/mypage/orders/[orderNo]/page.tsx` | Add "반품" / "교환" buttons per order item (eligibility-gated) |
| `admin/menus.ts` | Add "교환/반품" menu entry under shop group |
| `locales/ko.json`, `locales/en.json` | New keys under `shop.admin.returns.*`, `shop.returns.*` |
| `api/payment/callback/[adapterId]/route.ts` | Call `sendNotification(...)` for `order_paid` and `order_shipped` events (extends existing) |
| `admin/api/orders/[id]/ship/route.ts` | Emit `order_shipped` notification |
| `admin/api/orders/[id]/deliver/route.ts` | Emit `order_delivered` notification |

**New files in nexibase core:**

| File | Responsibility |
|---|---|
| `prisma/migrations/<timestamp>_shop_return_exchange/migration.sql` | SQL: create `return_requests`, `return_items`; add `shop_settings` seed rows |

---

## Testing Strategy

Same as Phase 1: pure-function modules tested via `node:test` + tsx; UI and API manually verified via dev server + browser/curl.

Commands:
- Unit tests: `npx tsx --test src/plugins/shop/fulfillment/return-*.test.ts`
- Type check: `npx tsc --noEmit`
- Prisma regen: `npx prisma generate`
- Dev server: `npm run dev`

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `src/plugins/shop/schema.prisma`
- Create: `prisma/migrations/<timestamp>_shop_return_exchange/migration.sql`

- [ ] **Step 1.1: Add models to plugin schema**

Append to `src/plugins/shop/schema.prisma`:

```prisma
/// Customer-initiated return or exchange request.
/// Item-level granularity (see ReturnItem).
model ReturnRequest {
  id                     Int       @id @default(autoincrement())
  orderId                Int
  userId                 Int
  type                   String    @db.VarChar(20)   // 'return' | 'exchange'
  reason                 String    @db.VarChar(40)   // 'defective','damaged_shipping','wrong_item','change_of_mind','other'
  reasonDetail           String?   @db.Text
  photos                 Json?                       // array of image URLs
  status                 String    @default("requested") @db.VarChar(20)
  rejectReason           String?   @db.Text
  returnTrackingCompany  String?   @db.VarChar(50)
  returnTrackingNumber   String?   @db.VarChar(50)
  customerBearsShipping  Boolean   @default(false)
  refundAmount           Int?
  refundedAt             DateTime?
  replacementOrderId     Int?
  adminMemo              String?   @db.Text
  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  order                  Order     @relation("ReturnRequestOrder", fields: [orderId], references: [id])
  replacementOrder       Order?    @relation("ReturnRequestReplacement", fields: [replacementOrderId], references: [id])
  items                  ReturnItem[]

  @@index([userId])
  @@index([orderId])
  @@index([status])
  @@map("return_requests")
}

model ReturnItem {
  id               Int           @id @default(autoincrement())
  returnRequestId  Int
  orderItemId      Int
  quantity         Int
  unitPrice        Int

  returnRequest    ReturnRequest @relation(fields: [returnRequestId], references: [id], onDelete: Cascade)
  orderItem        OrderItem     @relation(fields: [orderItemId], references: [id])

  @@unique([returnRequestId, orderItemId])
  @@map("return_items")
}
```

Update `Order` model to add the reverse relations:

```prisma
model Order {
  // ... existing fields ...
  returnRequestsAsOrder       ReturnRequest[] @relation("ReturnRequestOrder")
  returnRequestsAsReplacement ReturnRequest[] @relation("ReturnRequestReplacement")
}
```

Update `OrderItem`:

```prisma
model OrderItem {
  // ... existing fields ...
  returnItems ReturnItem[]
}
```

- [ ] **Step 1.2: Regenerate merged schema**

Run: `node /home/kagla/nexibase/scripts/scan-plugins.js`

- [ ] **Step 1.3: Create migration**

Create `prisma/migrations/20260423000000_shop_return_exchange/migration.sql`:

```sql
-- CreateTable
CREATE TABLE `return_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(40) NOT NULL,
    `reasonDetail` TEXT NULL,
    `photos` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'requested',
    `rejectReason` TEXT NULL,
    `returnTrackingCompany` VARCHAR(50) NULL,
    `returnTrackingNumber` VARCHAR(50) NULL,
    `customerBearsShipping` BOOLEAN NOT NULL DEFAULT false,
    `refundAmount` INTEGER NULL,
    `refundedAt` DATETIME(3) NULL,
    `replacementOrderId` INTEGER NULL,
    `adminMemo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `return_requests_userId_idx`(`userId`),
    INDEX `return_requests_orderId_idx`(`orderId`),
    INDEX `return_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `returnRequestId` INTEGER NOT NULL,
    `orderItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` INTEGER NOT NULL,

    UNIQUE INDEX `return_items_returnRequestId_orderItemId_key`(`returnRequestId`, `orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_replacementOrderId_fkey`
    FOREIGN KEY (`replacementOrderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_returnRequestId_fkey`
    FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_orderItemId_fkey`
    FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed shop_settings (safe if rows exist)
INSERT INTO `shop_settings` (`key`, `value`, `updatedAt`) VALUES
    ('return_window_days', '7', NOW()),
    ('sms_notifications_enabled', 'false', NOW()),
    ('sms_provider_config', '{}', NOW())
ON DUPLICATE KEY UPDATE `key`=`key`;
```

- [ ] **Step 1.4: Apply migration**

Run: `npx prisma migrate deploy`
Expected: `Applying migration '20260423000000_shop_return_exchange'`.

- [ ] **Step 1.5: Regenerate Prisma client**

Run: `npx prisma generate`

- [ ] **Step 1.6: Verify**

Run:
```bash
source /home/kagla/nexibase/.env 2>/dev/null
mariadb -u"$MYSQL_USER" -p"$MYSQL_PASS" -h"$MYSQL_HOST" -P"$MYSQL_PORT" "$MYSQL_DB" \
  -e "DESCRIBE return_requests; DESCRIBE return_items; SELECT \`key\`, value FROM shop_settings WHERE \`key\` IN ('return_window_days','sms_notifications_enabled','sms_provider_config');"
```
Expected: both tables with correct columns + 3 seeded rows.

- [ ] **Step 1.7: Commit**

Shop submodule:
```bash
git -C /home/kagla/nexibase/src/plugins/shop add schema.prisma
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(db): add ReturnRequest and ReturnItem models for fulfillment phase 2"
```

Nexibase:
```bash
git -C /home/kagla/nexibase add prisma/migrations/20260423000000_shop_return_exchange/ src/plugins/shop
git -C /home/kagla/nexibase commit -m "feat(db): shop return/exchange phase 2 migration"
```

---

## Task 2: Return state machine + refund calc + stock helper (pure functions)

**Files:**
- Create: `src/plugins/shop/fulfillment/return-state-machine.ts`
- Create: `src/plugins/shop/fulfillment/return-state-machine.test.ts`
- Create: `src/plugins/shop/fulfillment/refund-calc.ts`
- Create: `src/plugins/shop/fulfillment/refund-calc.test.ts`
- Create: `src/plugins/shop/fulfillment/return-stock.ts`

- [ ] **Step 2.1: Return state machine**

Write `return-state-machine.ts`:

```ts
import { TransitionError } from './state-machine'

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'collected' | 'completed'

export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  requested: ['approved', 'rejected'],
  approved:  ['collected'],
  collected: ['completed'],
  completed: [],
  rejected:  [],
}

export function assertReturnTransition(from: ReturnStatus, to: ReturnStatus): void {
  if (!RETURN_TRANSITIONS[from]?.includes(to)) {
    throw new TransitionError(from, to)
  }
}

export function allowedReturnTransitions(from: ReturnStatus): ReturnStatus[] {
  return RETURN_TRANSITIONS[from] ?? []
}
```

- [ ] **Step 2.2: State machine tests**

`return-state-machine.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertReturnTransition, allowedReturnTransitions } from './return-state-machine'
import { TransitionError } from './state-machine'

test('requested → approved allowed', () => {
  assert.doesNotThrow(() => assertReturnTransition('requested', 'approved'))
})

test('requested → rejected allowed', () => {
  assert.doesNotThrow(() => assertReturnTransition('requested', 'rejected'))
})

test('approved → completed rejected (must go via collected)', () => {
  assert.throws(() => assertReturnTransition('approved', 'completed'), TransitionError)
})

test('completed is terminal', () => {
  assert.deepEqual(allowedReturnTransitions('completed'), [])
})

test('rejected is terminal', () => {
  assert.deepEqual(allowedReturnTransitions('rejected'), [])
})
```

Run: `npx tsx --test src/plugins/shop/fulfillment/return-state-machine.test.ts`
Expected: 5 pass.

- [ ] **Step 2.3: Refund calculator**

`refund-calc.ts`:

```ts
export interface RefundCalcItem {
  unitPrice: number
  quantity: number
}

export interface RefundCalcInput {
  items: RefundCalcItem[]
  shippingFeeDeduction?: number  // amount to deduct from refund for return shipping (0 if merchant covers)
}

export interface RefundCalcResult {
  subtotal: number
  shippingFeeDeduction: number
  refundAmount: number
}

export function calculateRefund(input: RefundCalcInput): RefundCalcResult {
  const subtotal = input.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)
  const shippingFeeDeduction = input.shippingFeeDeduction ?? 0
  const refundAmount = Math.max(0, subtotal - shippingFeeDeduction)
  return { subtotal, shippingFeeDeduction, refundAmount }
}
```

- [ ] **Step 2.4: Refund calc tests**

`refund-calc.test.ts`:

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calculateRefund } from './refund-calc'

test('single item full refund', () => {
  const r = calculateRefund({ items: [{ unitPrice: 10000, quantity: 2 }] })
  assert.equal(r.subtotal, 20000)
  assert.equal(r.shippingFeeDeduction, 0)
  assert.equal(r.refundAmount, 20000)
})

test('shipping fee deducted from refund', () => {
  const r = calculateRefund({
    items: [{ unitPrice: 10000, quantity: 1 }],
    shippingFeeDeduction: 3000,
  })
  assert.equal(r.refundAmount, 7000)
})

test('refund clamped to zero when deduction exceeds subtotal', () => {
  const r = calculateRefund({
    items: [{ unitPrice: 1000, quantity: 1 }],
    shippingFeeDeduction: 5000,
  })
  assert.equal(r.refundAmount, 0)
})

test('multi-item sum', () => {
  const r = calculateRefund({
    items: [{ unitPrice: 5000, quantity: 2 }, { unitPrice: 3000, quantity: 1 }],
  })
  assert.equal(r.subtotal, 13000)
})
```

Run: `npx tsx --test src/plugins/shop/fulfillment/refund-calc.test.ts`
Expected: 4 pass.

- [ ] **Step 2.5: Stock restoration helper**

`return-stock.ts`:

```ts
import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Restore stock for a return request's items. Called from admin "collect" action,
 * inside a $transaction.
 *
 * For each return_item:
 *   - If the order_item has an optionId: increment ProductOption.stock by quantity
 *   - Else: increment Product.stock by quantity
 *   - Always decrement Product.soldCount by quantity (reverses the decrement from payment success)
 */
export async function restoreStockForReturn(
  tx: PrismaClient | Prisma.TransactionClient,
  returnRequestId: number,
): Promise<void> {
  const items = await tx.returnItem.findMany({
    where: { returnRequestId },
    include: { orderItem: true },
  })
  for (const item of items) {
    const oi = item.orderItem
    if (oi.optionId) {
      await tx.productOption.update({
        where: { id: oi.optionId },
        data: { stock: { increment: item.quantity } },
      })
    } else if (oi.productId) {
      await tx.product.update({
        where: { id: oi.productId },
        data: { stock: { increment: item.quantity } },
      })
    }
    if (oi.productId) {
      await tx.product.update({
        where: { id: oi.productId },
        data: { soldCount: { decrement: item.quantity } },
      })
    }
  }
}
```

- [ ] **Step 2.6: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add fulfillment/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(fulfillment): return state machine, refund calc, stock restoration helper"
```

---

## Task 3: Customer API — POST create + GET list

**Files:**
- Create: `src/plugins/shop/api/returns/route.ts`

- [ ] **Step 3.1: Implement POST + GET**

`api/returns/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { getShopSetting } from '@/plugins/shop/lib/shop-settings'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const requests = await prisma.returnRequest.findMany({
    where: { userId: session.id },
    include: { items: true, order: { select: { orderNo: true, finalPrice: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })

  const body = await req.json() as {
    orderNo: string
    type: 'return' | 'exchange'
    reason: string
    reasonDetail?: string
    photos?: string[]
    items: { orderItemId: number; quantity: number }[]
  }

  if (!['return', 'exchange'].includes(body.type)) {
    return NextResponse.json({ error: 'invalid type' }, { status: 400 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'items required' }, { status: 400 })
  }

  const order = await prisma.order.findUnique({
    where: { orderNo: body.orderNo },
    include: { items: true },
  })
  if (!order || order.userId !== session.id) {
    return NextResponse.json({ error: 'order not found' }, { status: 404 })
  }

  // Guard: order must be in delivered or confirmed status, within return window
  if (!['delivered', 'confirmed'].includes(order.status)) {
    return NextResponse.json({ error: `cannot request while order is ${order.status}` }, { status: 400 })
  }
  const windowDaysStr = (await getShopSetting('return_window_days')) ?? '7'
  const windowDays = Number(windowDaysStr)
  const deliveredAt = order.deliveredAt
  if (!deliveredAt) {
    return NextResponse.json({ error: 'order has no delivery date' }, { status: 400 })
  }
  const cutoff = new Date(deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000)
  if (Date.now() > cutoff.getTime()) {
    return NextResponse.json({ error: `return window (${windowDays} days) has passed` }, { status: 400 })
  }

  // Validate each requested item exists and quantity is within the order's quantity
  for (const req of body.items) {
    const oi = order.items.find(i => i.id === req.orderItemId)
    if (!oi) return NextResponse.json({ error: `order item ${req.orderItemId} not in this order` }, { status: 400 })
    if (req.quantity <= 0 || req.quantity > oi.quantity) {
      return NextResponse.json({ error: `invalid quantity for item ${req.orderItemId}` }, { status: 400 })
    }
  }

  // Guard: no open return request on the same order_item already
  const existingOpen = await prisma.returnItem.findMany({
    where: {
      orderItemId: { in: body.items.map(i => i.orderItemId) },
      returnRequest: { status: { in: ['requested', 'approved', 'collected'] } },
    },
  })
  if (existingOpen.length > 0) {
    return NextResponse.json({ error: 'open return request exists for one or more items' }, { status: 400 })
  }

  const request = await prisma.$transaction(async tx => {
    const created = await tx.returnRequest.create({
      data: {
        orderId: order.id,
        userId: session.id,
        type: body.type,
        reason: body.reason,
        reasonDetail: body.reasonDetail ?? null,
        photos: body.photos ?? undefined,
        status: 'requested',
        items: {
          create: body.items.map(it => {
            const oi = order.items.find(i => i.id === it.orderItemId)!
            return {
              orderItemId: oi.id,
              quantity: it.quantity,
              unitPrice: oi.price,
            }
          }),
        },
      },
      include: { items: true },
    })
    await logActivity(tx, {
      orderId: order.id,
      actorType: 'customer',
      actorId: session.id,
      action: 'return_requested',
      payload: { scope: 'return', returnRequestId: created.id, type: body.type, reason: body.reason, itemCount: body.items.length },
    })
    return created
  })

  return NextResponse.json({ request }, { status: 201 })
}
```

- [ ] **Step 3.2: Smoke test**

Dev server must be running. With an existing delivered order (e.g. #79 from Phase 1 smoke test):

```bash
# GET: expect empty list for your user if no requests yet
curl -s -b "session=YOUR_SESSION_COOKIE" http://localhost:3001/api/shop/returns

# POST: create a return request. Replace orderNo and orderItemId with real values.
curl -s -X POST -b "session=..." -H "Content-Type: application/json" \
  -d '{"orderNo":"26042215-3325748","type":"return","reason":"defective","items":[{"orderItemId":XXX,"quantity":1}]}' \
  http://localhost:3001/api/shop/returns
```

If session cookie handling is awkward in curl, test via browser dev tools fetch.

- [ ] **Step 3.3: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add api/returns/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(api): customer return request create + list endpoints"
```

---

## Task 4: Customer API — detail + tracking + cancel

**Files:**
- Create: `src/plugins/shop/api/returns/[id]/route.ts`
- Create: `src/plugins/shop/api/returns/[id]/tracking/route.ts`

- [ ] **Step 4.1: GET detail + DELETE cancel**

`api/returns/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { id } = await params
  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { orderItem: true } },
      order: { select: { orderNo: true, finalPrice: true, status: true } },
    },
  })
  if (!request || request.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ request })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { id } = await params
  const request = await prisma.returnRequest.findUnique({ where: { id: Number(id) } })
  if (!request || request.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status !== 'requested') {
    return NextResponse.json({ error: 'can only cancel while status=requested' }, { status: 400 })
  }
  await prisma.$transaction(async tx => {
    await tx.returnRequest.delete({ where: { id: request.id } })
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'customer', actorId: session.id,
      action: 'return_requested',  // same action key with payload note for cancellation
      payload: { scope: 'return', returnRequestId: request.id, cancelled: true },
    })
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4.2: PATCH tracking endpoint**

`api/returns/[id]/tracking/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'login required' }, { status: 401 })
  const { id } = await params
  const { returnTrackingCompany, returnTrackingNumber } = await req.json()
  if (!returnTrackingCompany || !returnTrackingNumber) {
    return NextResponse.json({ error: 'tracking required' }, { status: 400 })
  }
  const request = await prisma.returnRequest.findUnique({ where: { id: Number(id) } })
  if (!request || request.userId !== session.id) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.status !== 'approved') {
    return NextResponse.json({ error: 'can only update tracking while status=approved' }, { status: 400 })
  }
  await prisma.returnRequest.update({
    where: { id: request.id },
    data: { returnTrackingCompany, returnTrackingNumber },
  })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4.3: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add api/returns/[id]/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(api): customer return request detail, tracking, cancel"
```

---

## Task 5: Admin API — list + detail + approve/reject

**Files:**
- Create: `src/plugins/shop/admin/api/returns/route.ts`
- Create: `src/plugins/shop/admin/api/returns/[id]/route.ts`
- Create: `src/plugins/shop/admin/api/returns/[id]/approve/route.ts`
- Create: `src/plugins/shop/admin/api/returns/[id]/reject/route.ts`

- [ ] **Step 5.1: List + detail**

`admin/api/returns/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const url = new URL(req.url)
  const status = url.searchParams.get('status') ?? undefined
  const type = url.searchParams.get('type') ?? undefined
  const where: any = {}
  if (status) where.status = status
  if (type) where.type = type
  const requests = await prisma.returnRequest.findMany({
    where,
    include: {
      items: true,
      order: { select: { orderNo: true, recipientName: true, finalPrice: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ requests })
}
```

`admin/api/returns/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: {
      items: { include: { orderItem: true } },
      order: true,
      replacementOrder: true,
    },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ request })
}
```

- [ ] **Step 5.2: Approve endpoint**

`admin/api/returns/[id]/approve/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { customerBearsShipping, adminMemo } = await req.json() as { customerBearsShipping: boolean; adminMemo?: string }

  const outcome = await prisma.$transaction(async tx => {
    const request = await tx.returnRequest.findUnique({ where: { id: Number(id) } })
    if (!request) return { type: 'not_found' as const }
    assertReturnTransition(request.status as ReturnStatus, 'approved')
    const updateRes = await tx.returnRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: { status: 'approved', customerBearsShipping: !!customerBearsShipping, adminMemo: adminMemo ?? null },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_approved',
      payload: { scope: 'return', returnRequestId: request.id, customerBearsShipping: !!customerBearsShipping },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5.3: Reject endpoint**

`admin/api/returns/[id]/reject/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params
  const { rejectReason } = await req.json()

  const outcome = await prisma.$transaction(async tx => {
    const request = await tx.returnRequest.findUnique({ where: { id: Number(id) } })
    if (!request) return { type: 'not_found' as const }
    assertReturnTransition(request.status as ReturnStatus, 'rejected')
    const updateRes = await tx.returnRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: { status: 'rejected', rejectReason: rejectReason ?? null },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_rejected',
      payload: { scope: 'return', returnRequestId: request.id, rejectReason },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5.4: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add admin/api/returns/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(admin-api): returns list/detail + approve/reject endpoints"
```

---

## Task 6: Admin API — collect endpoint (stock restoration)

**Files:**
- Create: `src/plugins/shop/admin/api/returns/[id]/collect/route.ts`

- [ ] **Step 6.1: Implement**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { restoreStockForReturn } from '@/plugins/shop/fulfillment/return-stock'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params

  const outcome = await prisma.$transaction(async tx => {
    const request = await tx.returnRequest.findUnique({ where: { id: Number(id) } })
    if (!request) return { type: 'not_found' as const }
    assertReturnTransition(request.status as ReturnStatus, 'collected')
    const updateRes = await tx.returnRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: { status: 'collected' },
    })
    if (updateRes.count === 0) return { type: 'race' as const }
    await restoreStockForReturn(tx, request.id)
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_collected',
      payload: { scope: 'return', returnRequestId: request.id },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'not_found') return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6.2: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add admin/api/returns/[id]/collect/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(admin-api): returns collect endpoint (restores stock in transaction)"
```

---

## Task 7: Admin API — refund endpoint (type=return)

**Files:**
- Create: `src/plugins/shop/admin/api/returns/[id]/refund/route.ts`

- [ ] **Step 7.1: Implement**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { bootstrapPaymentAdapters } from '@/plugins/shop/payments/bootstrap'
import { get as getAdapter } from '@/plugins/shop/payments/registry'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { calculateRefund } from '@/plugins/shop/fulfillment/refund-calc'
import { logActivity } from '@/plugins/shop/fulfillment/activities'
import { getShopSetting } from '@/plugins/shop/lib/shop-settings'

bootstrapPaymentAdapters()

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params

  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: { items: true, order: true },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.type !== 'return') return NextResponse.json({ error: 'refund only for type=return' }, { status: 400 })
  try {
    assertReturnTransition(request.status as ReturnStatus, 'completed')
  } catch {
    return NextResponse.json({ error: `cannot refund from status=${request.status}` }, { status: 400 })
  }

  const order = request.order
  if (!order.paymentGateway || !order.pgTransactionId) {
    return NextResponse.json({ error: 'order has no payment gateway / transaction id' }, { status: 400 })
  }
  const adapter = getAdapter(order.paymentGateway)
  if (!adapter) return NextResponse.json({ error: 'adapter not registered' }, { status: 500 })

  // Calculate refund amount
  const shippingFeeStr = (await getShopSetting('return_shipping_fee')) ?? '3000'
  const shippingFeeDeduction = request.customerBearsShipping ? Number(shippingFeeStr) : 0
  const calc = calculateRefund({
    items: request.items.map(i => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
    shippingFeeDeduction,
  })

  // Call PG refund (outside transaction — network I/O)
  const refundResult = await adapter.refund({
    pgTransactionId: order.pgTransactionId,
    amount: calc.refundAmount,
    reason: `Return request #${request.id}`,
    orderRef: order.orderNo,
  })
  if (!refundResult.success) {
    return NextResponse.json({ error: 'refund failed', detail: refundResult.errorMessage }, { status: 502 })
  }

  const outcome = await prisma.$transaction(async tx => {
    const latest = await tx.returnRequest.findUnique({ where: { id: request.id } })
    if (!latest || latest.status !== 'collected') return { type: 'race' as const }
    await tx.returnRequest.update({
      where: { id: request.id },
      data: { status: 'completed', refundAmount: calc.refundAmount, refundedAt: new Date() },
    })
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_refunded',
      payload: { scope: 'return', returnRequestId: request.id, subtotal: calc.subtotal, shippingFeeDeduction, refundAmount: calc.refundAmount, pgRefundId: refundResult.pgRefundId },
    })
    return { type: 'ok' as const }
  })

  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true, refund: { amount: calc.refundAmount, pgRefundId: refundResult.pgRefundId } })
}
```

- [ ] **Step 7.2: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add admin/api/returns/[id]/refund/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(admin-api): returns refund endpoint (PG refund API call + stock-aware)"
```

---

## Task 8: Admin API — exchange-order endpoint (type=exchange)

**Files:**
- Create: `src/plugins/shop/admin/api/returns/[id]/exchange-order/route.ts`

- [ ] **Step 8.1: Implement**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { assertReturnTransition, type ReturnStatus } from '@/plugins/shop/fulfillment/return-state-machine'
import { logActivity } from '@/plugins/shop/fulfillment/activities'

function generateOrderNo(): string {
  // Format: YYMMDDHH-7digit. Simple version; collisions extremely unlikely.
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const rand = Math.floor(1000000 + Math.random() * 9000000)
  return `${yy}${mm}${dd}${hh}-${rand}`
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'admin only' }, { status: 403 })
  const { id } = await params

  const request = await prisma.returnRequest.findUnique({
    where: { id: Number(id) },
    include: { items: { include: { orderItem: true } }, order: true },
  })
  if (!request) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (request.type !== 'exchange') return NextResponse.json({ error: 'exchange-order only for type=exchange' }, { status: 400 })
  try {
    assertReturnTransition(request.status as ReturnStatus, 'completed')
  } catch {
    return NextResponse.json({ error: `cannot create exchange order from status=${request.status}` }, { status: 400 })
  }
  if (request.replacementOrderId) {
    return NextResponse.json({ error: 'replacement order already exists' }, { status: 400 })
  }

  const order = request.order
  const originalRoot = order.originalOrderId ?? order.id

  const outcome = await prisma.$transaction(async tx => {
    const latest = await tx.returnRequest.findUnique({ where: { id: request.id } })
    if (!latest || latest.status !== 'collected') return { type: 'race' as const }

    const replacement = await tx.order.create({
      data: {
        orderNo: generateOrderNo(),
        userId: order.userId,
        ordererName: order.ordererName, ordererPhone: order.ordererPhone, ordererEmail: order.ordererEmail,
        recipientName: order.recipientName, recipientPhone: order.recipientPhone,
        zipCode: order.zipCode, address: order.address, addressDetail: order.addressDetail,
        deliveryMemo: order.deliveryMemo,
        totalPrice: 0, deliveryFee: 0, finalPrice: 0,
        status: 'preparing',   // no payment required — ready to ship
        paymentMethod: null, paymentGateway: null,
        orderType: 'exchange',
        originalOrderId: originalRoot,
        items: {
          create: request.items.map(it => ({
            productId: it.orderItem.productId,
            optionId: it.orderItem.optionId,
            productName: it.orderItem.productName,
            optionText: it.orderItem.optionText,
            price: 0,                // free replacement
            quantity: it.quantity,
            subtotal: 0,
          })),
        },
      },
    })
    // Decrement stock for the replacement items (no payment-succeed path handles this)
    for (const it of request.items) {
      const oi = it.orderItem
      if (oi.optionId) {
        await tx.productOption.update({ where: { id: oi.optionId }, data: { stock: { decrement: it.quantity } } })
      } else if (oi.productId) {
        await tx.product.update({ where: { id: oi.productId }, data: { stock: { decrement: it.quantity } } })
      }
    }
    await tx.returnRequest.update({
      where: { id: request.id },
      data: { status: 'completed', replacementOrderId: replacement.id },
    })
    await logActivity(tx, {
      orderId: request.orderId, actorType: 'admin', actorId: session.id,
      action: 'return_exchange_order_created',
      payload: { scope: 'return', returnRequestId: request.id, replacementOrderId: replacement.id, replacementOrderNo: replacement.orderNo },
    })
    // Also log on the replacement order
    await logActivity(tx, {
      orderId: replacement.id, actorType: 'admin', actorId: session.id, action: 'order_created',
      toStatus: 'preparing', payload: { exchange: true, originalOrderId: originalRoot, returnRequestId: request.id },
    })
    return { type: 'ok' as const, replacementId: replacement.id, replacementOrderNo: replacement.orderNo }
  })

  if (outcome.type === 'race') return NextResponse.json({ error: 'status changed' }, { status: 409 })
  return NextResponse.json({ ok: true, replacementOrderId: outcome.replacementId, replacementOrderNo: outcome.replacementOrderNo })
}
```

- [ ] **Step 8.2: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add admin/api/returns/[id]/exchange-order/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(admin-api): returns exchange-order endpoint (creates replacement at price=0)"
```

---

## Task 9: Customer UI — return request form

**Files:**
- Create: `src/plugins/shop/routes/mypage/orders/[orderNo]/return/page.tsx`
- Modify: `src/plugins/shop/routes/mypage/orders/[orderNo]/page.tsx` (add per-item 반품/교환 buttons — Task 11 wiring)

- [ ] **Step 9.1: Return request form**

`routes/mypage/orders/[orderNo]/return/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface OrderItem { id: number; productName: string; optionText: string | null; quantity: number; price: number }
interface Order { orderNo: string; items: OrderItem[]; status: string; deliveredAt: string | null }

const REASONS = [
  { value: 'defective', label: '상품 불량' },
  { value: 'damaged_shipping', label: '배송 중 파손' },
  { value: 'wrong_item', label: '다른 상품 배송' },
  { value: 'change_of_mind', label: '단순 변심' },
  { value: 'other', label: '기타' },
]

export default function ReturnRequestForm() {
  const { orderNo } = useParams<{ orderNo: string }>()
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [type, setType] = useState<'return' | 'exchange'>('return')
  const [reason, setReason] = useState('defective')
  const [reasonDetail, setReasonDetail] = useState('')
  const [itemQuantities, setItemQuantities] = useState<Record<number, number>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/shop/orders/${orderNo}`).then(r => r.json()).then(d => {
      setOrder(d.order)
      const qs: Record<number, number> = {}
      d.order?.items?.forEach((it: OrderItem) => { qs[it.id] = 0 })
      setItemQuantities(qs)
    })
  }, [orderNo])

  const uploadPhoto = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    if (res.ok) {
      const d = await res.json()
      setPhotos(prev => [...prev, d.url])
    }
  }

  const submit = async () => {
    const items = Object.entries(itemQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId: Number(orderItemId), quantity }))
    if (items.length === 0) { alert('반품할 항목을 선택해주세요'); return }
    setSubmitting(true)
    const res = await fetch('/api/shop/returns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNo, type, reason, reasonDetail, photos, items }),
    })
    setSubmitting(false)
    if (res.ok) {
      const d = await res.json()
      router.push(`/shop/mypage/returns/${d.request.id}`)
    } else {
      alert((await res.json()).error ?? '요청 실패')
    }
  }

  if (!order) return <MyPageLayout><div className="p-6">로딩...</div></MyPageLayout>

  return (
    <MyPageLayout>
      <div className="space-y-6">
        <h1 className="text-xl font-semibold">교환/반품 신청 — 주문 {order.orderNo}</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">유형</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button variant={type === 'return' ? 'default' : 'outline'} onClick={() => setType('return')}>반품</Button>
              <Button variant={type === 'exchange' ? 'default' : 'outline'} onClick={() => setType('exchange')}>교환 (불량 동일상품 재발송)</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">항목 선택</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {order.items.map(it => (
              <div key={it.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-medium">{it.productName}</div>
                  {it.optionText && <div className="text-xs text-muted-foreground">{it.optionText}</div>}
                  <div className="text-xs text-muted-foreground">주문 수량 {it.quantity}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">수량:</Label>
                  <Input type="number" min={0} max={it.quantity}
                    value={itemQuantities[it.id] ?? 0}
                    onChange={e => setItemQuantities(q => ({ ...q, [it.id]: Math.min(it.quantity, Math.max(0, Number(e.target.value) || 0)) }))}
                    className="w-20" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">사유</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>사유 카테고리</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>상세 사유</Label>
              <Textarea value={reasonDetail} onChange={e => setReasonDetail(e.target.value)} rows={4} />
            </div>
            <div>
              <Label>사진 첨부 (선택)</Label>
              <input type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f) }} />
              <div className="flex gap-2 mt-2 flex-wrap">
                {photos.map((url, i) => (
                  <div key={i} className="relative">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded" />
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, idx) => idx !== i))}
                      className="absolute top-0 right-0 bg-black/60 text-white rounded-bl px-1 text-xs">×</button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>취소</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? '제출 중...' : '신청'}</Button>
        </div>
      </div>
    </MyPageLayout>
  )
}
```

- [ ] **Step 9.2: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add routes/mypage/orders/[orderNo]/return/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(mypage): customer return/exchange request form"
```

---

## Task 10: Customer UI — returns list + detail

**Files:**
- Create: `src/plugins/shop/routes/mypage/returns/page.tsx`
- Create: `src/plugins/shop/routes/mypage/returns/[id]/page.tsx`

- [ ] **Step 10.1: Returns list page**

`routes/mypage/returns/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { MyPageLayout } from "@/components/layout/MyPageLayout"

const STATUS_LABEL: Record<string, string> = {
  requested: '요청', approved: '승인', rejected: '반려', collected: '수취완료', completed: '완료',
}
const TYPE_LABEL: Record<string, string> = { return: '반품', exchange: '교환' }

interface ReturnRow { id: number; type: string; reason: string; status: string; createdAt: string; order: { orderNo: string; finalPrice: number }; items: { quantity: number }[] }

export default function ReturnsListPage() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  useEffect(() => {
    fetch('/api/shop/returns').then(r => r.json()).then(d => setRows(d.requests ?? []))
  }, [])
  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">교환/반품 내역</h1>
        {rows.length === 0 && <p className="text-muted-foreground">요청 내역이 없습니다.</p>}
        <div className="space-y-2">
          {rows.map(r => (
            <Link key={r.id} href={`/shop/mypage/returns/${r.id}`} className="block p-4 border rounded-lg hover:bg-muted/50">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">#{r.id}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted">{TYPE_LABEL[r.type]}</span>
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">{STATUS_LABEL[r.status]}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">주문 {r.order.orderNo} · {r.items.length}항목</div>
            </Link>
          ))}
        </div>
      </div>
    </MyPageLayout>
  )
}
```

- [ ] **Step 10.2: Returns detail page**

`routes/mypage/returns/[id]/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { MyPageLayout } from "@/components/layout/MyPageLayout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const STATUS_LABEL: Record<string, string> = {
  requested: '요청 (관리자 검토 대기)', approved: '승인 (반송 필요)', rejected: '반려',
  collected: '수취완료', completed: '처리완료',
}

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [trackCompany, setTrackCompany] = useState('')
  const [trackNumber, setTrackNumber] = useState('')
  const load = () => fetch(`/api/shop/returns/${id}`).then(r => r.json()).then(d => setData(d.request))
  useEffect(() => { load() }, [id])
  if (!data) return <MyPageLayout><div className="p-6">로딩...</div></MyPageLayout>

  const saveTracking = async () => {
    const r = await fetch(`/api/shop/returns/${id}/tracking`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnTrackingCompany: trackCompany, returnTrackingNumber: trackNumber }),
    })
    if (r.ok) load()
    else alert((await r.json()).error ?? '저장 실패')
  }
  const cancelRequest = async () => {
    if (!confirm('요청을 취소하시겠습니까?')) return
    const r = await fetch(`/api/shop/returns/${id}`, { method: 'DELETE' })
    if (r.ok) window.location.href = '/shop/mypage/returns'
    else alert((await r.json()).error ?? '실패')
  }
  return (
    <MyPageLayout>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">교환/반품 #{data.id}</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">진행 상태</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">{STATUS_LABEL[data.status]}</p>
            {data.rejectReason && <p className="text-sm text-red-600">반려 사유: {data.rejectReason}</p>}
            {data.refundedAt && <p className="text-sm text-green-600">환불 완료: {data.refundAmount?.toLocaleString()}원</p>}
            {data.replacementOrderId && <p className="text-sm">교환발송 주문: {data.replacementOrderId}</p>}
            {data.status === 'requested' && <Button variant="outline" onClick={cancelRequest}>요청 취소</Button>}
          </CardContent>
        </Card>

        {data.status === 'approved' && !data.returnTrackingNumber && (
          <Card>
            <CardHeader><CardTitle className="text-base">반송 송장 입력</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input placeholder="택배사" value={trackCompany} onChange={e => setTrackCompany(e.target.value)} />
              <Input placeholder="송장번호" value={trackNumber} onChange={e => setTrackNumber(e.target.value)} />
              <Button onClick={saveTracking}>저장</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">요청 항목</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {data.items.map((it: any) => (
                <li key={it.id}>{it.orderItem.productName} × {it.quantity}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </MyPageLayout>
  )
}
```

- [ ] **Step 10.3: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add routes/mypage/returns/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(mypage): customer returns list and detail pages"
```

---

## Task 11: Customer order detail — per-item 반품/교환 buttons

**Files:**
- Modify: `src/plugins/shop/routes/mypage/orders/[orderNo]/page.tsx`

- [ ] **Step 11.1: Add per-item buttons**

In the "주문 상품" (order items) card, add a button next to each item that's eligible for return/exchange. Eligibility: order status in `['delivered', 'confirmed']` AND no existing open return for that item. For simplicity, the button navigates to `/shop/mypage/orders/<orderNo>/return` — the form lets the user pick items/qty.

Conceptual change (insert into existing item render loop):

```tsx
{(order.status === 'delivered' || order.status === 'confirmed') && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => router.push(`/shop/mypage/orders/${order.orderNo}/return`)}
  >
    반품/교환 신청
  </Button>
)}
```

Place the button at the card-level, not per-item (since the form handles item-level selection). This is simpler UX.

- [ ] **Step 11.2: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add routes/mypage/orders/[orderNo]/page.tsx
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(mypage): add return/exchange button on order detail"
```

---

## Task 12: Admin UI — returns list + detail with action buttons

**Files:**
- Create: `src/plugins/shop/admin/returns/page.tsx`
- Create: `src/plugins/shop/admin/returns/[id]/page.tsx`
- Modify: `src/plugins/shop/admin/menus.ts` (add "교환/반품" menu entry)
- Modify: `src/plugins/shop/locales/ko.json`, `en.json`

- [ ] **Step 12.1: Admin returns list page**

`admin/returns/page.tsx` — status tabs, type filter, status badges. Copy the basic patterns from `admin/orders/page.tsx` for layout (Sidebar wrap, filters, table, pagination). Fetch from `/api/admin/shop/returns?status=...&type=...`.

Required elements:
- Status tabs: 전체 / 요청 / 승인 / 수취완료 / 완료 / 반려 — each sets the `status` query param
- Type filter: 전체 / 반품 / 교환
- Table columns: ID, 주문번호, 유형, 사유, 상태, 금액, 요청일
- Each row links to `/admin/shop/returns/<id>`

Full component file (roughly 80-120 lines — similar shape to admin/orders/page.tsx but simpler).

- [ ] **Step 12.2: Admin returns detail page**

`admin/returns/[id]/page.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Sidebar } from "@/components/admin/Sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { allowedReturnTransitions, type ReturnStatus } from "@/plugins/shop/fulfillment/return-state-machine"

const STATUS_LABEL: Record<string, string> = {
  requested: '요청', approved: '승인', rejected: '반려', collected: '수취완료', completed: '완료',
}

export default function AdminReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const load = () => fetch(`/api/admin/shop/returns/${id}`).then(r => r.json()).then(d => setData(d.request))
  useEffect(() => { load() }, [id])
  if (!data) return <div className="flex min-h-screen"><Sidebar /><main className="flex-1 p-6">로딩...</main></div>

  const approve = async () => {
    const bear = window.confirm('반품 배송비를 고객이 부담합니까? (OK=고객부담 / Cancel=판매자부담)')
    const memo = window.prompt('관리자 메모 (선택)')
    const r = await fetch(`/api/admin/shop/returns/${id}/approve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerBearsShipping: bear, adminMemo: memo }),
    })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const reject = async () => {
    const reason = window.prompt('반려 사유')
    if (reason === null) return
    const r = await fetch(`/api/admin/shop/returns/${id}/reject`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rejectReason: reason }),
    })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const collect = async () => {
    const r = await fetch(`/api/admin/shop/returns/${id}/collect`, { method: 'POST' })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const refund = async () => {
    if (!confirm('환불을 실행하시겠습니까?')) return
    const r = await fetch(`/api/admin/shop/returns/${id}/refund`, { method: 'POST' })
    if (r.ok) load(); else alert((await r.json()).error)
  }
  const createExchangeOrder = async () => {
    if (!confirm('교환 발송 주문을 생성하시겠습니까?')) return
    const r = await fetch(`/api/admin/shop/returns/${id}/exchange-order`, { method: 'POST' })
    if (r.ok) { const d = await r.json(); alert(`신규 주문: ${d.replacementOrderNo}`); load() }
    else alert((await r.json()).error)
  }

  const next = allowedReturnTransitions(data.status as ReturnStatus)

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar />
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <h1 className="text-xl font-semibold">교환/반품 #{data.id}</h1>

          <Card>
            <CardHeader><CardTitle className="text-base">상태 / 액션</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <p>현재 상태: <strong>{STATUS_LABEL[data.status]}</strong></p>
              <div className="flex flex-wrap gap-2">
                {next.includes('approved') && <Button onClick={approve}>승인</Button>}
                {next.includes('rejected') && <Button variant="destructive" onClick={reject}>반려</Button>}
                {next.includes('collected') && <Button onClick={collect}>수취확인</Button>}
                {data.status === 'collected' && data.type === 'return' && <Button onClick={refund}>환불 실행</Button>}
                {data.status === 'collected' && data.type === 'exchange' && <Button onClick={createExchangeOrder}>교환발송 주문 생성</Button>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">요청 정보</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <div>유형: {data.type === 'return' ? '반품' : '교환'}</div>
              <div>사유: {data.reason}</div>
              {data.reasonDetail && <div>상세: {data.reasonDetail}</div>}
              {data.rejectReason && <div className="text-red-600">반려 사유: {data.rejectReason}</div>}
              <div>택배비 부담: {data.customerBearsShipping ? '고객' : '판매자'}</div>
              {data.returnTrackingNumber && <div>반송 송장: {data.returnTrackingCompany} / {data.returnTrackingNumber}</div>}
              {data.refundAmount && <div>환불액: {data.refundAmount.toLocaleString()}원</div>}
              {data.replacementOrderId && <div>교환발송 주문: #{data.replacementOrderId}</div>}
              {data.adminMemo && <div>관리자 메모: {data.adminMemo}</div>}
              {Array.isArray(data.photos) && data.photos.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {data.photos.map((url: string, i: number) => <img key={i} src={url} alt="" className="w-24 h-24 object-cover rounded" />)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">요청 항목</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {data.items.map((it: any) => (
                  <li key={it.id}>{it.orderItem.productName} × {it.quantity} (단가 {it.unitPrice.toLocaleString()}원)</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 12.3: Add menu entry**

Edit `src/plugins/shop/admin/menus.ts` — insert after `orders`:
```ts
{ label: 'adminMenu.returns', icon: 'RotateCcw', path: '/admin/shop/returns' },
```

Add to both locales under `shop.adminMenu`:
- ko: `"returns": "교환/반품"`
- en: `"returns": "Returns"`

Run `node scripts/scan-plugins.js`.

- [ ] **Step 12.4: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add admin/returns/ admin/menus.ts locales/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(admin): returns list + detail pages with full action buttons"
```

---

## Task 13: Related-returns section on admin order detail

**Files:**
- Create: `src/plugins/shop/admin/orders/components/RelatedReturns.tsx`
- Modify: `src/plugins/shop/admin/orders/[id]/page.tsx`

- [ ] **Step 13.1: Component**

`admin/orders/components/RelatedReturns.tsx`:

```tsx
"use client"
import { useEffect, useState } from "react"
import Link from "next/link"

const TYPE_LABEL: Record<string, string> = { return: '반품', exchange: '교환' }
const STATUS_LABEL: Record<string, string> = {
  requested: '요청', approved: '승인', rejected: '반려', collected: '수취완료', completed: '완료',
}

export function RelatedReturns({ orderId }: { orderId: number }) {
  const [rows, setRows] = useState<any[]>([])
  useEffect(() => {
    // Query admin returns list filtered by orderId via query param.
    // The list endpoint doesn't currently filter by orderId — use client-side filter instead.
    fetch('/api/admin/shop/returns').then(r => r.json()).then(d => {
      setRows((d.requests ?? []).filter((r: any) => r.order && r.order.id === orderId || r.orderId === orderId))
    })
  }, [orderId])
  if (rows.length === 0) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">교환/반품 이력</h3>
      <div className="space-y-1">
        {rows.map(r => (
          <Link key={r.id} href={`/admin/shop/returns/${r.id}`} className="block p-2 border rounded hover:bg-muted/50 text-sm">
            #{r.id} · {TYPE_LABEL[r.type]} · {STATUS_LABEL[r.status]} · {new Date(r.createdAt).toLocaleDateString()}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

Note: this requires the admin list endpoint to include `orderId` or `order.id`. Step 5.1 already includes `order` via `include`. If it doesn't include `order.id`, add it to the `select`.

- [ ] **Step 13.2: Inject into order detail**

In `admin/orders/[id]/page.tsx`, add near the bottom of the right sidebar (after `ActivityTimeline`):

```tsx
<RelatedReturns orderId={order.id} />
```

And import at top.

- [ ] **Step 13.3: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add admin/orders/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(admin): related returns section on order detail"
```

---

## Task 14: Notifications — in-app + email infrastructure

**Files:**
- Create: `src/plugins/shop/notifications/send.ts`
- Create: `src/plugins/shop/notifications/channels/in-app.ts`
- Create: `src/plugins/shop/notifications/channels/email.ts`
- Create: `src/plugins/shop/notifications/templates/return-requested.ts`
- Create: `src/plugins/shop/notifications/templates/return-approved.ts`
- Create: `src/plugins/shop/notifications/templates/return-rejected.ts`
- Create: `src/plugins/shop/notifications/templates/return-collected.ts`
- Create: `src/plugins/shop/notifications/templates/return-refunded.ts`
- Create: `src/plugins/shop/notifications/templates/exchange-sent.ts`

- [ ] **Step 14.1: send.ts dispatcher**

```ts
import * as inApp from './channels/in-app'
import * as email from './channels/email'
import * as sms from './channels/sms'  // implemented in Task 15

export type NotificationEvent =
  | 'order_paid' | 'order_shipped' | 'order_delivered' | 'order_cancelled'
  | 'return_requested' | 'return_approved' | 'return_rejected'
  | 'return_refunded' | 'exchange_sent'

export type NotificationChannel = 'in_app' | 'email' | 'sms'

export interface NotificationPayload {
  event: NotificationEvent
  userId?: number
  adminBroadcast?: boolean   // true for events like return_requested
  data: Record<string, unknown>
}

const EVENT_CHANNELS: Record<NotificationEvent, NotificationChannel[]> = {
  order_paid:        ['in_app', 'email', 'sms'],
  order_shipped:     ['in_app', 'email', 'sms'],
  order_delivered:   ['in_app', 'email'],
  order_cancelled:   ['in_app', 'email', 'sms'],
  return_requested:  ['in_app'],  // to admin
  return_approved:   ['in_app', 'email', 'sms'],
  return_rejected:   ['in_app', 'email'],
  return_refunded:   ['in_app', 'email', 'sms'],
  exchange_sent:     ['in_app', 'email', 'sms'],
}

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const channels = EVENT_CHANNELS[payload.event] ?? []
  await Promise.allSettled(channels.map(async ch => {
    try {
      if (ch === 'in_app') return inApp.send(payload)
      if (ch === 'email') return email.send(payload)
      if (ch === 'sms') return sms.send(payload)
    } catch (err) {
      console.error(`notification ${payload.event} via ${ch} failed:`, err)
    }
  }))
}
```

- [ ] **Step 14.2: In-app channel**

`channels/in-app.ts`:

```ts
import { prisma } from '@/lib/prisma'
import type { NotificationPayload } from '../send'
import { renderInAppTemplate } from '../templates'

export async function send(payload: NotificationPayload): Promise<void> {
  const { title, body } = renderInAppTemplate(payload)
  if (payload.adminBroadcast) {
    // Fetch all admin users
    const admins = await prisma.user.findMany({ where: { role: 'admin' }, select: { id: true } })
    for (const a of admins) {
      await prisma.notification.create({ data: { userId: a.id, title, body, type: payload.event } })
    }
    return
  }
  if (payload.userId) {
    await prisma.notification.create({ data: { userId: payload.userId, title, body, type: payload.event } })
  }
}
```

Adjust field names (`title`, `body`, `type`) to match the existing `notifications` Prisma model. Inspect `src/lib/notification.ts` for the exact model shape and reuse its helpers if they exist.

- [ ] **Step 14.3: Email channel**

`channels/email.ts`:

```ts
import { sendEmail } from '@/lib/email'
import type { NotificationPayload } from '../send'
import { renderEmailTemplate } from '../templates'
import { prisma } from '@/lib/prisma'

export async function send(payload: NotificationPayload): Promise<void> {
  if (!payload.userId) return
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } })
  if (!user?.email) return
  const { subject, html } = renderEmailTemplate(payload)
  await sendEmail({ to: user.email, subject, html })
}
```

Adjust `sendEmail` call signature to match the existing `src/lib/email.ts` API.

- [ ] **Step 14.4: Templates dispatcher**

Create `notifications/templates/index.ts`:

```ts
import type { NotificationPayload } from '../send'
import returnRequested from './return-requested'
import returnApproved from './return-approved'
import returnRejected from './return-rejected'
import returnCollected from './return-collected'
import returnRefunded from './return-refunded'
import exchangeSent from './exchange-sent'
// Add order_* templates as separate modules too if needed.

const TEMPLATES: Record<string, (payload: NotificationPayload) => { title: string; body: string; subject: string; html: string }> = {
  return_requested: returnRequested,
  return_approved: returnApproved,
  return_rejected: returnRejected,
  return_collected: returnCollected,
  return_refunded: returnRefunded,
  exchange_sent: exchangeSent,
}

export function renderInAppTemplate(payload: NotificationPayload) {
  const t = TEMPLATES[payload.event]
  if (!t) return { title: payload.event, body: '' }
  const rendered = t(payload)
  return { title: rendered.title, body: rendered.body }
}

export function renderEmailTemplate(payload: NotificationPayload) {
  const t = TEMPLATES[payload.event]
  if (!t) return { subject: payload.event, html: '' }
  const rendered = t(payload)
  return { subject: rendered.subject, html: rendered.html }
}
```

- [ ] **Step 14.5: Individual templates**

Each template is a small module returning `{ title, body, subject, html }`:

`templates/return-requested.ts`:

```ts
import type { NotificationPayload } from '../send'

export default function template(payload: NotificationPayload) {
  const id = payload.data.returnRequestId ?? ''
  const type = payload.data.type === 'exchange' ? '교환' : '반품'
  const title = `새 ${type} 요청 #${id}`
  const body = `주문 ${payload.data.orderNo ?? ''}에 대해 ${type} 요청이 접수되었습니다.`
  return {
    title, body,
    subject: title,
    html: `<p>${body}</p><p><a href="/admin/shop/returns/${id}">요청 확인</a></p>`,
  }
}
```

Create similar modules for the remaining 5 events (approved/rejected/collected/refunded, exchange_sent) with analogous title/body/subject/html. Keep each under 30 lines.

- [ ] **Step 14.6: Wire into existing API routes**

Modify endpoints that emit events:

- `api/payment/callback/[adapterId]/route.ts`: on success path after transaction commits, `sendNotification({ event: 'order_paid', userId: order.userId, data: { orderNo: order.orderNo, amount: result.paidAmount } })`
- `admin/api/orders/[id]/ship/route.ts`: on success, `sendNotification({ event: 'order_shipped', userId: order.userId, data: { trackingCompany, trackingNumber, orderNo: order.orderNo } })`
- `admin/api/orders/[id]/deliver/route.ts`: on success, `sendNotification({ event: 'order_delivered', userId: order.userId, data: { orderNo: order.orderNo } })`
- `admin/api/orders/[id]/cancel/route.ts`: on success, `sendNotification({ event: 'order_cancelled', userId: order.userId, data: { orderNo: order.orderNo, reason } })`
- `api/returns/route.ts` POST: after create, `sendNotification({ event: 'return_requested', adminBroadcast: true, data: { returnRequestId, orderNo, type } })`
- `admin/api/returns/[id]/approve/route.ts`: on success, `sendNotification({ event: 'return_approved', userId: request.userId, data: { returnRequestId: request.id, customerBearsShipping } })`
- `admin/api/returns/[id]/reject/route.ts`: on success, `sendNotification({ event: 'return_rejected', userId: request.userId, data: { returnRequestId: request.id, rejectReason } })`
- `admin/api/returns/[id]/refund/route.ts`: on success, `sendNotification({ event: 'return_refunded', userId: request.userId, data: { returnRequestId, amount: calc.refundAmount } })`
- `admin/api/returns/[id]/exchange-order/route.ts`: on success, `sendNotification({ event: 'exchange_sent', userId: request.userId, data: { returnRequestId, replacementOrderNo } })`

All notifications are fire-and-forget (outside critical transaction, inside try/catch if needed).

- [ ] **Step 14.7: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add notifications/ api/ admin/api/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(notifications): in-app + email dispatcher with per-event templates"
```

---

## Task 15: SMS integration + sms channel

**Files:**
- Create: `src/plugins/shop/notifications/channels/sms.ts`
- Modify: `src/plugins/shop/admin/settings/page.tsx` (add SMS global toggle + provider config)
- Modify: `prisma/migrations/...` (add `smsOptIn` to User if not present — check first)

**Choice:** CoolSMS. (Aligo is an alternative — pick at task start based on account availability.)

- [ ] **Step 15.1: Check User.smsOptIn presence**

```bash
grep -n "smsOptIn\|sms_opt_in" /home/kagla/nexibase/prisma/schema.base.prisma
```

If missing, add a migration to the nexibase core that adds `smsOptIn Boolean @default(false)` to the User model. (Schema additions to core require nexibase migration, not plugin-scoped.)

- [ ] **Step 15.2: SMS channel**

`channels/sms.ts`:

```ts
import { prisma } from '@/lib/prisma'
import { getShopSetting } from '../../lib/shop-settings'
import type { NotificationPayload } from '../send'
import { renderInAppTemplate } from '../templates'

export async function send(payload: NotificationPayload): Promise<void> {
  const globalOn = (await getShopSetting('sms_notifications_enabled')) === 'true'
  if (!globalOn) return
  if (!payload.userId) return
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { phone: true, smsOptIn: true } })
  if (!user?.phone || !user.smsOptIn) return

  const { title, body } = renderInAppTemplate(payload)  // reuse short message body
  const msg = `${title}\n${body}`

  const configStr = (await getShopSetting('sms_provider_config')) ?? '{}'
  const config = JSON.parse(configStr) as { apiKey?: string; apiSecret?: string; from?: string }
  if (!config.apiKey || !config.apiSecret || !config.from) {
    console.warn('SMS provider config incomplete — skipping send')
    return
  }

  // CoolSMS v4 REST API (simplified; install coolsms-node-sdk for production)
  const coolsmsUrl = 'https://api.coolsms.co.kr/messages/v4/send'
  const body_ = JSON.stringify({
    message: { to: user.phone, from: config.from, text: msg },
  })
  const auth = buildCoolsmsAuth(config.apiKey, config.apiSecret)
  await fetch(coolsmsUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: auth },
    body: body_,
  })
}

function buildCoolsmsAuth(apiKey: string, apiSecret: string): string {
  // HMAC-SHA256(salt + date). See CoolSMS docs for exact format.
  // For simplicity, use their SDK — npm install coolsms-node-sdk — in production.
  const salt = Math.random().toString(36).slice(2)
  const date = new Date().toISOString()
  const crypto = require('node:crypto')
  const sig = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex')
  return `HMAC-SHA256 ApiKey=${apiKey}, Date=${date}, salt=${salt}, signature=${sig}`
}
```

Consider replacing the manual auth with the official SDK `coolsms-node-sdk`; if installed as a dependency, use it and delete `buildCoolsmsAuth`. The manual impl works but the SDK is preferred.

- [ ] **Step 15.3: Admin settings — SMS section**

In `admin/settings/page.tsx`, add a new card "SMS 알림":
- Checkbox for `sms_notifications_enabled`
- Text fields for `sms_provider_config.apiKey`, `apiSecret`, `from` (phone number of sender)
- Save button uses the existing main save handler (since settings page PUTs all keys)

For `sms_provider_config` storage: parse JSON on load, serialize on save.

- [ ] **Step 15.4: Smoke test**

With SMS globally enabled and a valid CoolSMS test account:
1. Log in as a customer with phone + smsOptIn=true
2. Place a card order — card payment complete → SMS should arrive
3. Admin ships → SMS arrives

If CoolSMS account isn't available, the SMS channel silently skips (no error). Verify via logs: `console.warn('SMS provider config incomplete')`.

- [ ] **Step 15.5: Commit**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add notifications/channels/sms.ts admin/settings/
git -C /home/kagla/nexibase/src/plugins/shop commit -m "feat(notifications): SMS channel via CoolSMS + admin settings"
```

---

## Task 16: Integration smoke test + deployment checklist

**Files:**
- Modify: `src/plugins/shop/plugin.ts` (bump version to 1.2.0)
- Modify: `docs/superpowers/specs/2026-04-22-shop-fulfillment-design.md` (append Phase 2 deploy notes)

- [ ] **Step 16.1: End-to-end test — Return**

Execute in order, record DB state at each step:

1. As customer: deliver an order (use Phase 1 test), confirm. Place a test card order, have admin ship + deliver. Order must have `deliveredAt` within `return_window_days`.
2. Visit `/shop/mypage/orders/<orderNo>/return` — fill form with reason='defective', qty=1 of one item, submit. Expect redirect to `/shop/mypage/returns/<id>`.
3. DB check: `SELECT * FROM return_requests WHERE id = ...; SELECT * FROM return_items WHERE returnRequestId = ...` — expect status='requested', items populated.
4. Admin login → `/admin/shop/returns/<id>` → click 승인 → choose customer-bears-shipping. Expect status='approved'.
5. Customer → `/shop/mypage/returns/<id>` → enter tracking → save. DB: `returnTrackingNumber` populated.
6. Admin → click 수취확인. Expect status='collected'. DB: product stock incremented.
7. Admin → click 환불 실행. Expect Inicis test refund call, status='completed', refundAmount populated, activity log with `return_refunded`.

- [ ] **Step 16.2: End-to-end test — Exchange**

1. Place another card order, ship to delivered + confirmed status.
2. Customer requests exchange (type='exchange') → approved → customer sends back → admin 수취확인 → admin "교환발송 주문 생성".
3. Verify: new order created with `orderType='exchange'`, `finalPrice=0`, `originalOrderId=<root>`, status='preparing'. Stock decremented for the new order.
4. Original order's return_request status='completed', `replacementOrderId` populated.
5. Admin can now ship the exchange order normally (배송준비 → 배송중 → 배송완료).

- [ ] **Step 16.3: Notifications test**

Enable SMS globally in settings and set `smsOptIn=true` on test user. Verify each event generates:
- in-app notification entry in `notifications` table
- email delivered (check mailhog / dev inbox)
- SMS sent (check CoolSMS dashboard; or dev dry-run logs)

- [ ] **Step 16.4: Version bump + deploy notes**

Version: `src/plugins/shop/plugin.ts` `'1.1.0'` → `'1.2.0'`.

Append to spec §8 Phase 1 deployment section, new subsection:

```markdown
### Phase 2 deployment (post-implementation)

- SMS provider: CoolSMS chosen. Configure `sms_provider_config` in shop_settings before enabling `sms_notifications_enabled`.
- Storage: photos for return requests go to the existing `/api/upload` target. Ensure retention policy covers at least 90 days for audit.
- Exchange orders are created with `finalPrice=0` and stock decremented at create time. Existing sales reports that treat `finalPrice` as revenue should filter `orderType='normal'` to avoid counting exchanges as revenue.
- Return window: default 7 days via `shop_settings.default_confirm_days` and `return_window_days`. Adjust per business policy.
```

- [ ] **Step 16.5: Commit + push + PRs**

```bash
git -C /home/kagla/nexibase/src/plugins/shop add plugin.ts
git -C /home/kagla/nexibase/src/plugins/shop commit -m "chore: v1.2.0 — fulfillment phase 2"
git -C /home/kagla/nexibase/src/plugins/shop push -u origin feat/shop-fulfillment-phase2

git -C /home/kagla/nexibase add docs/superpowers/specs/ src/plugins/shop
git -C /home/kagla/nexibase commit -m "chore: bump shop submodule to v1.2.0 + append Phase 2 deploy notes"
git -C /home/kagla/nexibase push -u origin feat/shop-fulfillment-phase2
```

Create PRs on both repos (plugin-shop + nexibase) referencing the spec and plan.

---

## Post-Plan Notes

- SMS integration is behind a global toggle and per-user opt-in; disabled by default. Safe to ship even if CoolSMS isn't wired up yet — the channel silently skips.
- `RelatedReturns` component does a client-side filter — if orders grow large, refactor the admin list endpoint to accept `?orderId=X` and filter server-side.
- Inicis refund API was implemented in Phase 1 but only exercised via full-order cancel. Phase 2 Task 7 exercises partial refund (return with only some items). If Inicis rejects partial refunds on a PG config level, the `customerBearsShipping` deduction scenario may need to be full-refund-plus-manual-adjustment.
- Auto-populating `customerBearsShipping` based on reason (e.g., defective=false, change_of_mind=true) could be added as a UX improvement in a follow-up.
