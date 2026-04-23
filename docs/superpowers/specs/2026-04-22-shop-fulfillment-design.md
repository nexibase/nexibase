# Shop Fulfillment Design — Shipping, Exchange/Return, Payment Abstraction

**Date:** 2026-04-22
**Scope:** `src/plugins/shop` (submodule) + small additions to `src/plugins/shop/notifications/` for SMS
**Status:** Design approved; implementation pending

## Summary

Extend the shop plugin with a full post-payment workflow: shipping tracking, customer-initiated return/exchange, and payment gateway abstraction supporting multiple PGs. All order state changes are recorded in an append-only audit log. Implementation is split into two phases; design covers both to ensure a consistent data model and state machine.

## Goals

1. End-to-end shipping workflow with tracking company/number, state transitions, and bulk operations.
2. Customer-initiated return and exchange requests at item + quantity granularity, with photo upload and reason categories.
3. Admin approval workflow: approve/reject, mark as collected (restores stock), issue refund (PG API) or create exchange replacement order.
4. Complete audit trail: every status change, tracking update, admin memo, and return state transition recorded with actor and timestamp.
5. Payment gateway abstraction so additional PGs (Toss, KakaoPay, Naver Pay) can be added by implementing an adapter interface, without touching order/checkout logic.
6. Three-channel customer notifications: in-app (mandatory), email (mandatory), SMS (opt-in + global toggle).

## Non-Goals

- Multi-vendor settlement (single-merchant shop).
- Automatic exchange with option changes (size/color swaps handled via return + new order).
- Physical return pickup coordination with couriers (customer ships back on their own).
- International payment gateways (Phase 3+, out of scope here).

## Architecture Decision: Approach B — Fulfillment Sub-module + Payment Adapters

Layered structure inside the shop plugin:

```
src/plugins/shop/
├── fulfillment/          # domain logic for shipping + returns
│   ├── state-machine.ts
│   ├── activities.ts     # audit log helper
│   ├── refund-calc.ts
│   └── stock.ts
├── payments/             # payment gateway abstraction
│   ├── adapter.ts
│   ├── registry.ts
│   ├── inicis/
│   └── bank_deposit/
├── notifications/        # in-app + email + sms
│   ├── send.ts
│   ├── sms.ts
│   └── templates/
├── api/                  # HTTP endpoints
├── admin/                # admin UI pages
└── routes/               # customer UI pages
```

Rejected alternatives:
- **Inline in existing routes** — payment/return logic spread across many files; hard to add second PG cleanly.
- **XState (external state machine)** — overkill for this scope; adds dependency and learning curve.

---

## 1. Data Model

### 1.1 New table: `order_activities` (audit log)

Append-only. Every state change, tracking update, memo edit, and return state transition writes a row here.

```sql
CREATE TABLE order_activities (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  orderId     INT NOT NULL,
  actorType   ENUM('customer','admin','system') NOT NULL,
  actorId     INT NULL,                       -- user ID or admin ID (nullable for 'system')
  action      VARCHAR(40) NOT NULL,           -- see action catalog below
  fromStatus  VARCHAR(20) NULL,
  toStatus    VARCHAR(20) NULL,
  payload     JSON NULL,                      -- action-specific details
  memo        TEXT NULL,                      -- free-form admin note, if applicable
  createdAt   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX (orderId, createdAt),
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);
```

**Action catalog** (non-exhaustive, grows with features):
- `order_created`, `payment_succeeded`, `payment_failed`
- `status_changed` (any → any, `fromStatus`/`toStatus` populated)
- `tracking_updated` (payload: `{company, number, previousCompany, previousNumber}`)
- `memo_updated` (memo column populated)
- `cancel_requested`, `cancelled`, `refund_issued`
- `return_requested` (payload: `{returnRequestId, type, items[]}`)
- `return_approved`, `return_rejected`, `return_collected`, `return_refunded`, `return_exchange_order_created`

Scoping return-related activities to a specific request: include `{scope:'return', returnRequestId}` in payload. Queries can filter.

### 1.2 New table: `return_requests`

```sql
CREATE TABLE return_requests (
  id                     INT PRIMARY KEY AUTO_INCREMENT,
  orderId                INT NOT NULL,
  userId                 INT NOT NULL,
  type                   ENUM('return','exchange') NOT NULL,
  reason                 VARCHAR(40) NOT NULL,         -- 'defective','damaged_shipping','wrong_item','change_of_mind','other'
  reasonDetail           TEXT NULL,
  photos                 JSON NULL,                    -- array of image URLs
  status                 VARCHAR(20) NOT NULL DEFAULT 'requested',  -- requested|approved|rejected|collected|completed
  rejectReason           TEXT NULL,
  returnTrackingCompany  VARCHAR(50) NULL,
  returnTrackingNumber   VARCHAR(50) NULL,
  customerBearsShipping  BOOLEAN NOT NULL DEFAULT FALSE,
  refundAmount           INT NULL,
  refundedAt             DATETIME(3) NULL,
  replacementOrderId     INT NULL,                     -- set when type=exchange and admin creates replacement order
  adminMemo              TEXT NULL,
  createdAt              DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt              DATETIME(3) NOT NULL,
  INDEX (userId),
  INDEX (orderId),
  INDEX (status),
  FOREIGN KEY (orderId) REFERENCES orders(id),
  FOREIGN KEY (replacementOrderId) REFERENCES orders(id)
);
```

### 1.3 New table: `return_items`

```sql
CREATE TABLE return_items (
  id               INT PRIMARY KEY AUTO_INCREMENT,
  returnRequestId  INT NOT NULL,
  orderItemId      INT NOT NULL,
  quantity         INT NOT NULL,                 -- must be <= order_item.quantity
  unitPrice        INT NOT NULL,                 -- snapshot at request time
  UNIQUE (returnRequestId, orderItemId),
  FOREIGN KEY (returnRequestId) REFERENCES return_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (orderItemId) REFERENCES order_items(id)
);
```

### 1.4 `orders` table extensions

```sql
ALTER TABLE orders
  ADD COLUMN originalOrderId  INT NULL,                                 -- root order of an exchange chain
  ADD COLUMN orderType        ENUM('normal','exchange') NOT NULL DEFAULT 'normal',
  ADD COLUMN paymentGateway   VARCHAR(20) NULL,                         -- adapter id: 'inicis','toss','bank_deposit'
  ADD COLUMN pgTransactionId  VARCHAR(100) NULL,                        -- PG unique id, needed for refund
  ADD FOREIGN KEY (originalOrderId) REFERENCES orders(id);
```

Migration fills `paymentGateway='inicis'` for existing paid orders, null for legacy bank-transfer orders (which will be migrated separately or left null as they never need refund).

**Existing `paymentMethod` column (already in schema)** — reused to store the specific payment method selected by the customer. Values standardized in §3.1 `PayMethod` enum:
- `card` — 신용카드
- `account_transfer` — 실시간 계좌이체 (via PG)
- `virtual_account` — 가상계좌
- `mobile` — 휴대폰 결제
- `bank_deposit` — 무통장입금 (customer manually transfers to merchant's bank account, no PG)

Easypay services (KakaoPay, NaverPay, etc.) are handled as sub-methods of the PG that supports them (e.g., Inicis/Toss offer KakaoPay within their SDK). No separate `PayMethod` value needed — the PG exposes easypay as part of its payment UI, and the final `paymentMethod` stored is whichever of the above best matches (typically `card` since most easypay transactions map to a card underneath).

**Persistence timing:** at `handleCallback()` success, `/api/shop/payment/callback/[adapterId]` writes `paymentGateway`, `pgTransactionId`, `paymentMethod`, `paidAt`, `paymentInfo` (raw JSON), and transitions status `pending → paid`, all in one transaction along with an `order_activities` `payment_succeeded` row.

### 1.5 `shop_settings` new entries

| Key | Type | Default | Purpose |
|-----|------|---------|---------|
| `return_window_days` | int | 7 | Days after `delivered` during which return/exchange requests are accepted |
| `return_shipping_fee` | int | 3000 | Default deduction when `customerBearsShipping=true` (reuses existing key if present) |
| `default_confirm_days` | int | 7 | Auto-transition `delivered → confirmed` after N days |
| `enabled_payment_gateways` | JSON array | `["inicis","bank_deposit"]` | Adapters visible at checkout |
| `default_card_gateway` | string | `"inicis"` | Which adapter handles generic "card" selection |
| `sms_notifications_enabled` | boolean | false | Global SMS master switch |
| `sms_provider_config` | JSON | `{}` | SMS gateway credentials (provider, apiKey, from, etc.) |

---

## 2. State Machines

### 2.1 Order states

States: `pending` → `paid` → `preparing` → `shipping` → `delivered` → `confirmed`

Cancel branch: `pending|paid` → `cancel_requested` → `cancelled` (or direct `→ cancelled` by admin for `paid|preparing`).

```
pending  → paid, cancel_requested, cancelled
paid     → preparing, cancel_requested, cancelled
preparing→ shipping, cancelled
shipping → delivered
delivered→ confirmed
confirmed→ (terminal)
cancel_requested → cancelled, paid (revert on admin reject)
cancelled→ (terminal)
```

### 2.2 Return request states

`requested` → `approved` → `collected` → `completed`, or `requested` → `rejected` (terminal).

```
requested→ approved, rejected
approved → collected
collected→ completed
completed→ (terminal)
rejected → (terminal)
```

Sub-states of `completed` tracked by timestamps/FKs:
- Return type: `refundedAt` set when `PaymentAdapter.refund()` succeeds
- Exchange type: `replacementOrderId` set when admin creates a replacement order

### 2.3 Transition triggers & side effects

| Transition | Actor | Side effects |
|------------|-------|--------------|
| pending → paid | system (PG callback) | `paidAt`, stock decrement, `order_paid` notification |
| paid → preparing | admin | activity log |
| preparing → shipping | admin (tracking entered) | `shippedAt`, trackingCompany/Number set, `order_shipped` notification |
| shipping → delivered | admin | `deliveredAt`, `order_delivered` notification |
| delivered → confirmed | customer or system (cron) | unlocks reviews/points |
| any → cancelled (paid path) | admin | stock restore, `adapter.refund()` if already paid, `order_cancelled` notification |
| requested → approved | admin | sets `customerBearsShipping`, `return_approved` notification |
| requested → rejected | admin | `return_rejected` notification |
| approved → collected | admin | stock restore per return_items × quantity, `return_collected` notification |
| collected → completed (return) | admin "issue refund" | `adapter.refund()`, `refundedAt`/`refundAmount`, `return_refunded` notification |
| collected → completed (exchange) | admin "create replacement" | new order created with `orderType=exchange`, `originalOrderId` chain, `replacementOrderId` set |

### 2.4 Guard rules

- Return requests can only be created for orders in `delivered` or `confirmed` within `return_window_days`.
- A single `order_item` cannot have multiple open (non-terminal) return requests.
- `shipping → pending` and similar reverse transitions are rejected.
- `assertTransition(machine, from, to)` runs before any DB write; transition + `order_activities` insert happen in a single DB transaction.

### 2.5 Implementation sketch

```ts
// src/plugins/shop/fulfillment/state-machine.ts
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = { ... }
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = { ... }

export function assertTransition<T extends string>(
  machine: Record<T, T[]>, from: T, to: T,
): void {
  if (!machine[from]?.includes(to)) {
    throw new TransitionError(`${from} → ${to} not allowed`)
  }
}
```

---

## 3. Payment Adapter Interface

### 3.1 Interface

```ts
// src/plugins/shop/payments/adapter.ts
export interface PaymentAdapter {
  readonly id: string
  readonly displayName: string
  readonly supportedMethods: PayMethod[]

  prepare(order: Order, opts: PrepareOpts): Promise<PrepareResult>
  handleCallback(rawRequest: unknown): Promise<CallbackResult>
  refund(params: RefundParams): Promise<RefundResult>
  inquire?(pgTransactionId: string): Promise<InquireResult>
}

export type PayMethod =
  | 'card'              // 신용카드
  | 'account_transfer'  // 실시간 계좌이체 (PG 경유)
  | 'virtual_account'   // 가상계좌
  | 'mobile'            // 휴대폰 결제
  | 'bank_deposit'      // 무통장입금 (PG 외, 관리자가 수동 확인)

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
```

### 3.2 Registry

```ts
// src/plugins/shop/payments/registry.ts
const adapters = new Map<string, PaymentAdapter>()
export function register(a: PaymentAdapter): void
export function get(id: string): PaymentAdapter | null
export function listEnabled(): PaymentAdapter[]  // intersects with shop_settings.enabled_payment_gateways
```

Each adapter module imports and self-registers at load time.

### 3.3 Checkout method resolution

1. Client calls `GET /api/shop/payment/methods` → returns enabled adapters with `{id, displayName, supportedMethods}`.
2. Customer selects a method (e.g., `card`, `virtual_account`, `bank_deposit`).
3. Server resolves method → adapter:
   - **Standard methods** (`card`, `bank`, `virtual_account`, `mobile`) → `shop_settings.default_card_gateway` (e.g., `inicis` or `toss` — the primary PG handles all of these, including any bundled easypay options inside the PG's payment UI).
   - **`bank_deposit`** → built-in `bank_deposit` adapter (manual flow).
4. Client calls `POST /api/shop/payment/init` with `{orderItems, buyer, shipping, method}`; server resolves adapter and calls `adapter.prepare(order)`.
5. After callback success, server persists `paymentGateway`, `paymentMethod`, `pgTransactionId` — `paymentMethod` captures what the customer chose, `paymentGateway` captures which adapter processed it.

### 3.4 Callback endpoint

Unified path: `POST /api/shop/payment/callback/[adapterId]`. Each adapter implements its own signature verification and response parsing in `handleCallback()`.

Migration note: existing Inicis callback URL registered at PG admin portal (`/api/shop/payment/inicis/return`) must be updated to the new path during Phase 1 deployment.

### 3.5 Phase 1 adapter implementations

1. **InicisAdapter** — refactors existing `api/payment/inicis/*` routes into the adapter. Implements `refund()` via Inicis `/stdpay/refund` API.
2. **BankDepositAdapter** — `prepare` returns `{kind:'manual'}`, `handleCallback` is admin-triggered "payment confirmed" action, `refund` is admin-triggered "refund completed" (manual bank transfer, no PG call).

---

## 4. API Endpoints

### 4.1 Payment (PG-agnostic)

```
POST  /api/shop/payment/init
POST  /api/shop/payment/callback/[adapterId]
GET   /api/shop/payment/methods
```

### 4.2 Orders (customer)

```
GET   /api/shop/orders
GET   /api/shop/orders/[orderNo]
POST  /api/shop/orders/[orderNo]/cancel
POST  /api/shop/orders/[orderNo]/confirm
```

### 4.3 Orders (admin)

```
GET   /api/admin/shop/orders
GET   /api/admin/shop/orders/[id]
GET   /api/admin/shop/orders/[id]/activities
PATCH /api/admin/shop/orders/[id]           # adminMemo updates → logged
POST  /api/admin/shop/orders/[id]/ship
POST  /api/admin/shop/orders/[id]/deliver
POST  /api/admin/shop/orders/[id]/cancel
```

### 4.4 Returns (customer)

```
GET    /api/shop/returns
POST   /api/shop/returns
GET    /api/shop/returns/[id]
PATCH  /api/shop/returns/[id]/tracking      # add return tracking
DELETE /api/shop/returns/[id]               # cancel (status=requested only)
```

### 4.5 Returns (admin)

```
GET   /api/admin/shop/returns
GET   /api/admin/shop/returns/[id]
POST  /api/admin/shop/returns/[id]/approve
POST  /api/admin/shop/returns/[id]/reject
POST  /api/admin/shop/returns/[id]/collect
POST  /api/admin/shop/returns/[id]/refund           # return type
POST  /api/admin/shop/returns/[id]/exchange-order   # exchange type
```

### 4.6 Settings (admin)

```
GET/PATCH /api/admin/shop/payment-settings
GET/PATCH /api/admin/shop/notification-settings
```

---

## 5. UI Pages

### 5.1 Admin pages

| Page | Path | Status | Key features |
|------|------|--------|--------------|
| Orders list | `/admin/shop/orders` | extended | orderType badge, PG + status filters, bulk tracking entry |
| Order detail | `/admin/shop/orders/[id]` | overhauled | state transition buttons, tracking input, activity timeline sidebar, related returns section |
| Returns list | `/admin/shop/returns` | new | status tabs, type filter |
| Returns detail | `/admin/shop/returns/[id]` | new | approve/reject/collect/refund/exchange actions, refund amount calculator |
| Shop settings | `/admin/shop/settings` | extended | payment adapters section, return window, notification (SMS toggle) |

**Order detail layout:**

```
┌──────────────────────────────┬────────────────────────┐
│ Order # / status pill         │                        │
│ [state transition buttons]    │  Activity timeline     │
├──────────────────────────────┤  (order_activities)    │
│ Buyer / recipient / address   │                        │
├──────────────────────────────┤                        │
│ Order items table             │                        │
├──────────────────────────────┤                        │
│ Payment info (PG, amount)     │                        │
├──────────────────────────────┤                        │
│ Admin memo (save logs change) │                        │
├──────────────────────────────┤                        │
│ Related return/exchange       │                        │
│ (full chain via originalId)   │                        │
└──────────────────────────────┴────────────────────────┘
```

### 5.2 Customer pages

| Page | Path | Status | Key features |
|------|------|--------|--------------|
| Checkout | `/shop/order` | refactored | dynamic payment methods from enabled adapters |
| Order list | `/shop/mypage/orders` | extended | mini status stepper, per-row actions (cancel/return/exchange/confirm) |
| Order detail | `/shop/mypage/orders/[orderNo]` | new (split) | customer-scoped activity timeline, per-item return/exchange buttons |
| Return request form | `/shop/mypage/orders/[orderNo]/return` | new | item × quantity selection, type, reason, photo upload |
| Returns list | `/shop/mypage/returns` | new | own request list |
| Returns detail | `/shop/mypage/returns/[id]` | new | status progress, return tracking input, cancel request if pending |

Per-item return/exchange buttons: enabled only when order is in `delivered`/`confirmed` within `return_window_days` AND the item has no open return request.

---

## 6. Notifications

### 6.1 Event matrix

| Event | Recipient | Channels | Template content |
|-------|-----------|----------|------------------|
| order_paid | customer | in-app, email, sms | order no + total |
| order_shipped | customer | in-app, email, sms | courier + tracking number |
| order_delivered | customer | in-app, email | order no + confirm CTA |
| order_cancelled | customer | in-app, email, sms | reason + refund info |
| return_requested | all admins | in-app | request id + order link |
| return_approved | customer | in-app, email, sms | return shipping instructions |
| return_rejected | customer | in-app, email | reject reason |
| return_refunded | customer | in-app, email, sms | refund amount + card company info |
| return_exchange_sent | customer | in-app, email, sms | new order no + tracking |

### 6.2 Channels

- **in-app**: reuses existing `notifications` + `notification_preferences` tables.
- **email**: reuses `src/lib/email.ts`.
- **SMS**: new `src/plugins/shop/notifications/sms.ts`. Pluggable provider (CoolSMS or Aligo initial). Sends only when `shop_settings.sms_notifications_enabled = true` AND `user.smsOptIn = true`.

Templates: `src/plugins/shop/notifications/templates/*.ts`, each exporting `{subject, bodyEmail, bodySms, bodyInApp}` in Korean + English.

---

## 7. Implementation Phases

### Phase 1: Shipping + Payment Abstraction + Audit Log

**1.1 DB migrations**
- Create `order_activities`.
- Add columns to `orders`: `originalOrderId`, `orderType`, `paymentGateway`, `pgTransactionId`.
- Add `shop_settings`: `enabled_payment_gateways`, `default_card_gateway`, `default_confirm_days`.
- Backfill `paymentGateway='inicis'` for existing paid orders.

**1.2 Payment Adapter**
- Implement `adapter.ts`, `registry.ts`, `InicisAdapter`, `BankDepositAdapter`.
- Migrate existing Inicis routes into the adapter.
- New `/api/shop/payment/init` and `/api/shop/payment/callback/[adapterId]`.
- Update PG-registered callback URL during deployment.

**1.3 Audit log infrastructure**
- `fulfillment/activities.ts` helper with transaction-bound insert.
- Instrument every status change, memo update, and tracking input.

**1.4 Shipping workflow UI**
- Admin order detail overhaul with activity timeline.
- Courier dropdown preset (CJ대한통운, 한진, 로젠, 우체국, etc.).
- Bulk tracking entry on orders list.
- Customer order detail page with status stepper and confirm button.
- Auto-confirm cron for `delivered → confirmed` after `default_confirm_days`.

**1.5 Payment settings**
- Admin UI to toggle enabled gateways and pick default card gateway.
- Dynamic checkout payment method list.

**Exit criteria:** zero regression in existing flows; every order action writes to `order_activities`; adding a new PG requires only adapter + callback registration.

### Phase 2: Return / Exchange Workflow

**2.1 DB migrations**
- Create `return_requests`, `return_items`.
- Add `shop_settings`: `return_window_days`, `return_shipping_fee`.

**2.2 Core logic**
- `RETURN_TRANSITIONS` state machine.
- `fulfillment/refund-calc.ts` (unit price × quantity − optional shipping fee).
- `fulfillment/stock.ts` for on-collect restoration.
- Implement `InicisAdapter.refund()` end-to-end.

**2.3 Admin UI**
- `/admin/shop/returns` list + detail pages.
- Related-returns section on order detail.
- Action buttons gated by state machine.

**2.4 Customer UI**
- `/shop/mypage/orders/[orderNo]/return` form (items × qty, reason, photos).
- `/shop/mypage/returns` list + detail.
- Reuse existing image upload infra for photos.

**2.5 Notifications**
- `notifications/send.ts` combining in-app + email + sms.
- SMS provider integration (CoolSMS or Aligo — pick at start of phase).
- Templates for every event in Section 6.1.

**Exit criteria:** customer request → admin approve → collect → refund/exchange round-trip works for both types; inventory stays accurate; refund API success/failure both handled gracefully.

### Phase 3 (future, separate brainstorming)

Add Toss, KakaoPay, Naver Pay adapters. Validates Phase 1 abstractions.

---

## 8. Operational Notes

- **PG callback URL migration**: coordinate Phase 1 deployment with updating the URL registered in the Inicis admin portal. Deploy both sides within a short window.
- **Testing**: run full Inicis test-MID checkout + refund scenario at Phase 1 and Phase 2 exits.
- **Rollback**: each Phase is an independent PR with small commits. Phase 1 can ship and operate without Phase 2.
- **Audit log retention**: append-only, no cleanup job in v1. Revisit when table grows large.
- **Permissions**: admin-only endpoints gated by existing admin session check; customer endpoints scoped to `session.userId === record.userId`.

### Phase 1 deployment (post-implementation)

- **PG callback URL migration**: before deploying Phase 1, update the Inicis merchant admin portal callback URL from `/api/shop/payment/inicis/return` to `/api/shop/payment/callback/inicis`. Deploy in a low-traffic window.
- After deployment, monitor `/api/shop/payment/callback/inicis` logs for failed callbacks for 24h. Legacy URL remains deleted; any Inicis retry at the old URL returns 404 and the PG marks the payment as failed, which triggers the normal cancel path.
- **Auto-confirm cron**: schedule `npm run cron:shop-auto-confirm` to run daily via crontab or a host scheduler. Default N=7 days; override via `shop_settings.default_confirm_days`.
- **Shop settings seeded in migration**: `default_confirm_days=7` (seeded manually via `npx tsx -e` during Task 13). If deploying to a fresh environment, add this to the install wizard or seed script.

## 9. Open Questions (to resolve during implementation)

- Exact SMS provider choice (CoolSMS vs Aligo) — pick based on pricing / account availability at Phase 2 start.
- Courier delivery-status webhook integration (automating `shipping → delivered`) — deferred; can be added later without schema changes since `trackingNumber` already exists.
- Exchange replacement order payment amount: zero (free replacement). No price delta handling since exchange is restricted to defective same-option replacement.
