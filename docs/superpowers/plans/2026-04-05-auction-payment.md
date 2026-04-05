# 경매 낙찰 결제 시스템 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 경매 낙찰 후 24시간 이내에 기존 이니시스 카드결제로 결제하는 시스템. 미결제 시 자동 재경매 + 페널티.

**Architecture:** 기존 넥시베이스 이니시스 결제 인프라(PendingOrder → Order, 결제 콜백)를 경매 전용 엔드포인트로 복제하여 재활용. Auction 모델에 결제 상태 필드 추가, cron에서 미결제 만료 처리.

**Tech Stack:** Next.js 16, Prisma 6, MySQL, 이니시스 웹표준결제, SSE

**Spec:** `docs/superpowers/specs/2026-04-05-auction-payment-design.md`

---

## 파일 구조

### 생성할 파일

```
src/app/auction/[id]/pay/page.tsx                    ← 경매 결제 페이지
src/app/api/auction/[id]/pay/route.ts                ← 결제 준비 API
src/app/api/auction/payment/return/route.ts          ← 이니시스 결제 콜백
src/app/api/auction/payment/popup/route.ts           ← 결제 팝업 핸들러
src/app/api/auction/payment/close/route.ts           ← 결제 닫기 핸들러
```

### 수정할 파일

```
prisma/schema.prisma                                 ← Auction, User 필드 추가
src/app/auction/[id]/page.tsx                        ← 낙찰자 결제 UI 추가
src/app/auction/create/page.tsx                      ← 배송 필요 체크박스 추가
src/app/api/auction/route.ts                         ← requiresShipping 저장
src/app/api/auction/[id]/bid/route.ts                ← 이용 제한 체크
src/app/api/auction/[id]/buy-now/route.ts            ← 이용 제한 체크 + 결제 상태 설정
src/app/api/auction/cron/close-expired/route.ts      ← 결제 상태 설정 + 미결제 만료 처리
prisma/seed-auction.ts                               ← requiresShipping 추가
```

---

## Task 1: Prisma 스키마 — 결제 관련 필드 추가

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Auction 모델에 결제 필드 추가**

`prisma/schema.prisma`의 Auction 모델에서 `winnerId` 아래에 추가:

```prisma
  requiresShipping  Boolean   @default(true)
  paymentDeadline   DateTime?
  paymentStatus     String?   @db.VarChar(20)
  orderId           Int?      @unique
```

그리고 `winner` 관계 아래에 추가:

```prisma
  order    Order?    @relation(fields: [orderId], references: [id])
```

- [ ] **Step 1.2: User 모델에 페널티 필드 추가**

User 모델의 `autoBids AutoBid[]` 아래에 추가:

```prisma
  auctionPenaltyCount Int       @default(0)
  auctionBannedUntil  DateTime?
```

- [ ] **Step 1.3: Order 모델에 Auction 역관계 추가**

Order 모델의 `reviews ProductReview[]` 아래에 추가:

```prisma
  auction   Auction?
```

- [ ] **Step 1.4: DB 적용**

```bash
npx prisma db push
npx prisma generate
```

- [ ] **Step 1.5: 커밋**

```bash
git add prisma/schema.prisma
git commit -m "🗃️ 경매 결제 관련 스키마 추가 (paymentStatus, requiresShipping, 페널티)"
```

---

## Task 2: 경매 등록에 배송 옵션 추가

**Files:**
- Modify: `src/app/auction/create/page.tsx`
- Modify: `src/app/api/auction/route.ts`
- Modify: `prisma/seed-auction.ts`

- [ ] **Step 2.1: 등록 폼에 배송 필요 체크박스 추가**

`src/app/auction/create/page.tsx`에서 form 상태에 `requiresShipping: true` 추가.

입찰 단위 필드 아래에 체크박스 추가:

```tsx
{/* 배송 옵션 */}
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    id="requiresShipping"
    checked={form.requiresShipping}
    onChange={(e) => setForm((prev) => ({ ...prev, requiresShipping: e.target.checked }))}
    className="w-4 h-4 rounded border-border"
  />
  <label htmlFor="requiresShipping" className="text-sm">
    배송이 필요한 상품 <span className="text-muted-foreground">(체크 해제 시 디지털/무형 상품)</span>
  </label>
</div>
```

- [ ] **Step 2.2: API에서 requiresShipping 저장**

`src/app/api/auction/route.ts`의 POST 핸들러에서 body에서 `requiresShipping` 추출하고 create data에 추가:

```typescript
requiresShipping: requiresShipping !== false,
```

- [ ] **Step 2.3: 시드에 requiresShipping 추가**

`prisma/seed-auction.ts`에서 auction create data에 추가:

```typescript
requiresShipping: rand(0, 4) > 0,  // 80%는 배송, 20%는 디지털
```

- [ ] **Step 2.4: 커밋**

```bash
git add src/app/auction/create/page.tsx src/app/api/auction/route.ts prisma/seed-auction.ts
git commit -m "📦 경매 등록 시 배송 옵션 추가 (requiresShipping)"
```

---

## Task 3: 입찰/즉시구매 시 이용 제한 체크

**Files:**
- Modify: `src/app/api/auction/[id]/bid/route.ts`
- Modify: `src/app/api/auction/[id]/buy-now/route.ts`
- Modify: `src/app/api/auction/route.ts` (POST — 등록 시에도 체크)

- [ ] **Step 3.1: 입찰 API에 페널티 체크 추가**

`src/app/api/auction/[id]/bid/route.ts`에서 Rate limit 체크 바로 아래에 추가:

```typescript
    // 이용 제한 체크
    const userWithPenalty = await prisma.user.findUnique({
      where: { id: user.id },
      select: { auctionBannedUntil: true },
    })
    if (userWithPenalty?.auctionBannedUntil && userWithPenalty.auctionBannedUntil > new Date()) {
      const bannedUntil = userWithPenalty.auctionBannedUntil.toLocaleDateString("ko-KR")
      return NextResponse.json(
        { error: `경매 이용이 제한되어 있습니다. (해제일: ${bannedUntil})` },
        { status: 403 }
      )
    }
```

- [ ] **Step 3.2: 즉시구매 API에 동일 체크 추가**

`src/app/api/auction/[id]/buy-now/route.ts`에서 인증 체크 아래에 동일 코드 추가.

- [ ] **Step 3.3: 경매 등록 API에 동일 체크 추가**

`src/app/api/auction/route.ts`의 POST 핸들러에서 인증 체크 아래에 동일 코드 추가.

- [ ] **Step 3.4: 커밋**

```bash
git add src/app/api/auction/[id]/bid/route.ts src/app/api/auction/[id]/buy-now/route.ts src/app/api/auction/route.ts
git commit -m "🚫 경매 이용 제한 체크 (입찰, 즉시구매, 등록)"
```

---

## Task 4: 낙찰 시 결제 상태 설정 (cron + 즉시구매)

**Files:**
- Modify: `src/app/api/auction/cron/close-expired/route.ts`
- Modify: `src/app/api/auction/[id]/buy-now/route.ts`

- [ ] **Step 4.1: cron에서 낙찰 시 paymentStatus/Deadline 설정**

`src/app/api/auction/cron/close-expired/route.ts`에서 경매 종료 처리 시 winnerId 설정하는 부분에 추가:

```typescript
      await prisma.auction.update({
        where: { id: auction.id },
        data: {
          status: "ended",
          winnerId,
          // 결제 상태 설정 (낙찰자가 있을 때만)
          ...(winnerId ? {
            paymentStatus: "pending",
            paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
          } : {}),
        },
      })
```

- [ ] **Step 4.2: 즉시구매 시 paymentStatus/Deadline 설정**

`src/app/api/auction/[id]/buy-now/route.ts`에서 경매 종료 업데이트에 추가:

```typescript
      await tx.auction.update({
        where: { id: auctionId },
        data: {
          currentPrice: locked.buyNowPrice,
          bidCount: locked.bidCount + 1,
          status: "ended",
          winnerId: user.id,
          paymentStatus: "pending",
          paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
```

- [ ] **Step 4.3: 커밋**

```bash
git add src/app/api/auction/cron/close-expired/route.ts src/app/api/auction/[id]/buy-now/route.ts
git commit -m "⏰ 낙찰 시 결제 대기 상태 설정 (24시간 기한)"
```

---

## Task 5: 미결제 만료 처리 + 자동 재등록 (cron)

**Files:**
- Modify: `src/app/api/auction/cron/close-expired/route.ts`

- [ ] **Step 5.1: cron에 미결제 만료 처리 추가**

`src/app/api/auction/cron/close-expired/route.ts`에서 `activatedCount` 처리 후, return 문 전에 추가:

```typescript
    // 미결제 만료 처리
    const expiredPayments = await prisma.auction.findMany({
      where: {
        paymentStatus: "pending",
        paymentDeadline: { lte: new Date() },
      },
      include: {
        seller: { select: { id: true } },
      },
    })

    let expiredPaymentCount = 0
    let reAuctionCount = 0

    for (const auction of expiredPayments) {
      // 1. 결제 상태를 expired로 변경
      await prisma.auction.update({
        where: { id: auction.id },
        data: { paymentStatus: "expired" },
      })

      // 2. 낙찰자 페널티 누적
      if (auction.winnerId) {
        const user = await prisma.user.findUnique({
          where: { id: auction.winnerId },
          select: { auctionPenaltyCount: true },
        })

        const newCount = (user?.auctionPenaltyCount || 0) + 1
        let banDays = 3
        if (newCount >= 3) banDays = 30
        else if (newCount >= 2) banDays = 10

        await prisma.user.update({
          where: { id: auction.winnerId },
          data: {
            auctionPenaltyCount: newCount,
            auctionBannedUntil: new Date(Date.now() + banDays * 24 * 60 * 60 * 1000),
          },
        })

        // 낙찰자 알림
        createNotification({
          userId: auction.winnerId,
          type: "system",
          title: "경매 미결제 제재",
          message: `미결제로 경매 이용이 ${banDays}일간 제한됩니다.`,
          link: `/auction/${auction.id}`,
        }).catch(() => {})
      }

      // 3. 동일 조건으로 자동 재등록
      const originalDuration = auction.endsAt.getTime() - auction.startsAt.getTime()
      const now = new Date()

      await prisma.auction.create({
        data: {
          sellerId: auction.sellerId,
          title: auction.title,
          description: auction.description,
          images: auction.images,
          startingPrice: auction.startingPrice,
          currentPrice: auction.startingPrice,
          buyNowPrice: auction.buyNowPrice,
          bidIncrement: auction.bidIncrement,
          bidCount: 0,
          startsAt: now,
          endsAt: new Date(now.getTime() + originalDuration),
          status: "active",
          requiresShipping: auction.requiresShipping,
        },
      })
      reAuctionCount++

      // 판매자 알림
      createNotification({
        userId: auction.sellerId,
        type: "system",
        title: "미결제 재경매 등록",
        message: `"${auction.title}" 낙찰자 미결제로 동일 조건으로 재경매가 등록되었습니다.`,
        link: `/auction/${auction.id}`,
      }).catch(() => {})

      expiredPaymentCount++
    }
```

응답에 추가:

```typescript
    return NextResponse.json({
      success: true,
      closedCount,
      activatedCount: activatedCount.count,
      expiredPaymentCount,
      reAuctionCount,
    })
```

- [ ] **Step 5.2: 커밋**

```bash
git add src/app/api/auction/cron/close-expired/route.ts
git commit -m "💀 미결제 만료 처리 (페널티 + 자동 재경매 등록)"
```

---

## Task 6: 결제 준비 API

**Files:**
- Create: `src/app/api/auction/[id]/pay/route.ts`

- [ ] **Step 6.1: 결제 준비 API 작성**

기존 `/api/shop/payment/inicis/route.ts`를 참고하여 경매 전용으로 작성. 핵심 차이: 상품 조회 대신 경매 정보 사용, winnerId 확인.

Create `src/app/api/auction/[id]/pay/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAuthUser } from "@/lib/auth"
import crypto from "crypto"

async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const map: Record<string, string> = {}
  settings.forEach((s) => (map[s.key] = s.value))
  return map
}

async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const MM = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  const hh = String(now.getHours()).padStart(2, "0")
  const ii = String(now.getMinutes()).padStart(2, "0")

  for (let i = 0; i < 10; i++) {
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, "0")
    const orderNo = `${yy}${MM}${dd}${hh}-${ii}${rand}`
    const exists = await prisma.order.findUnique({ where: { orderNo } })
    if (!exists) return orderNo
  }

  const ss = String(now.getSeconds()).padStart(2, "0")
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, "0")
  return `${yy}${MM}${dd}${hh}-${ii}${ss}${rand}`
}

function sha256(str: string) {
  return crypto.createHash("sha256").update(str).digest("hex")
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }

    const { id } = await params
    const auctionId = parseInt(id)

    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
    })

    if (!auction) {
      return NextResponse.json({ error: "경매를 찾을 수 없습니다." }, { status: 404 })
    }

    if (auction.winnerId !== user.id) {
      return NextResponse.json({ error: "낙찰자만 결제할 수 있습니다." }, { status: 403 })
    }

    if (auction.paymentStatus !== "pending") {
      return NextResponse.json({ error: "결제 대기 상태가 아닙니다." }, { status: 400 })
    }

    if (auction.paymentDeadline && auction.paymentDeadline < new Date()) {
      return NextResponse.json({ error: "결제 기한이 만료되었습니다." }, { status: 400 })
    }

    const body = await request.json()
    const {
      recipientName,
      recipientPhone,
      zipCode,
      address,
      addressDetail,
      deliveryMemo,
      deliveryFee: clientDeliveryFee,
      baseUrl: clientBaseUrl,
    } = body

    // 배송 상품이면 배송지 필수
    if (auction.requiresShipping) {
      if (!recipientName || !recipientPhone || !zipCode || !address) {
        return NextResponse.json({ error: "배송지 정보를 입력해주세요." }, { status: 400 })
      }
    }

    const totalPrice = auction.currentPrice
    const deliveryFee = auction.requiresShipping && typeof clientDeliveryFee === "number" ? clientDeliveryFee : 0
    const finalPrice = totalPrice + deliveryFee

    const orderNo = await generateOrderNo()

    // PendingOrder 생성
    await prisma.pendingOrder.upsert({
      where: { orderNo },
      create: {
        orderNo,
        userId: user.id,
        orderData: JSON.stringify({
          auctionId,
          ordererName: user.nickname,
          ordererPhone: "",
          ordererEmail: user.email,
          recipientName: auction.requiresShipping ? recipientName : user.nickname,
          recipientPhone: auction.requiresShipping ? recipientPhone : "",
          zipCode: auction.requiresShipping ? zipCode : "00000",
          address: auction.requiresShipping ? address : "디지털 상품",
          addressDetail: auction.requiresShipping ? (addressDetail || null) : null,
          deliveryMemo: auction.requiresShipping ? (deliveryMemo || null) : null,
          totalPrice,
          deliveryFee,
          finalPrice,
          items: [{
            productId: 0,
            productName: `[경매] ${auction.title}`,
            optionId: null,
            optionText: null,
            price: totalPrice,
            quantity: 1,
            subtotal: totalPrice,
          }],
        }),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
      update: {
        orderData: JSON.stringify({
          auctionId,
          ordererName: user.nickname,
          ordererPhone: "",
          ordererEmail: user.email,
          recipientName: auction.requiresShipping ? recipientName : user.nickname,
          recipientPhone: auction.requiresShipping ? recipientPhone : "",
          zipCode: auction.requiresShipping ? zipCode : "00000",
          address: auction.requiresShipping ? address : "디지털 상품",
          addressDetail: auction.requiresShipping ? (addressDetail || null) : null,
          deliveryMemo: auction.requiresShipping ? (deliveryMemo || null) : null,
          totalPrice,
          deliveryFee,
          finalPrice,
          items: [{
            productId: 0,
            productName: `[경매] ${auction.title}`,
            optionId: null,
            optionText: null,
            price: totalPrice,
            quantity: 1,
            subtotal: totalPrice,
          }],
        }),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    // 이니시스 결제 데이터 생성
    const settings = await getShopSettings()
    const testMode = settings.pg_test_mode !== "false"
    const mid = testMode ? "INIpayTest" : (settings.pg_mid || "INIpayTest")
    const signKey = testMode ? "SU5JTElURV9UUklQTEVERVNfS0VZU1RS" : (settings.pg_signkey || "SU5JTElURV9UUklQTEVERVNfS0VZU1RS")

    const timestamp = Date.now().toString()
    const baseUrl = clientBaseUrl || process.env.NEXT_PUBLIC_URL || "http://localhost:3200"

    const signature = sha256(`oid=${orderNo}&price=${finalPrice}&timestamp=${timestamp}`)
    const mKey = sha256(signKey)

    const paymentData = {
      version: "1.0",
      mid,
      oid: orderNo,
      goodname: `[경매] ${auction.title}`,
      price: finalPrice,
      currency: "WON",
      buyername: user.nickname,
      buyertel: "",
      buyeremail: user.email || "",
      timestamp,
      signature,
      mKey,
      returnUrl: `${baseUrl}/api/auction/payment/return`,
      closeUrl: `${baseUrl}/api/auction/payment/close`,
      popupUrl: `${baseUrl}/api/auction/payment/popup`,
      gopaymethod: "Card",
      acceptmethod: "below1000:centerCd(Y)",
      payUrl: testMode
        ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
      testMode,
    }

    return NextResponse.json({
      success: true,
      order: { orderNo, finalPrice },
      payment: paymentData,
    })
  } catch (error) {
    console.error("경매 결제 준비 에러:", error)
    return NextResponse.json({ error: "결제 준비 중 오류가 발생했습니다." }, { status: 500 })
  }
}
```

- [ ] **Step 6.2: 커밋**

```bash
git add src/app/api/auction/[id]/pay/route.ts
git commit -m "💳 경매 결제 준비 API 구현"
```

---

## Task 7: 이니시스 결제 콜백 (return/popup/close)

**Files:**
- Create: `src/app/api/auction/payment/return/route.ts`
- Create: `src/app/api/auction/payment/popup/route.ts`
- Create: `src/app/api/auction/payment/close/route.ts`

- [ ] **Step 7.1: return 콜백 작성**

기존 `/api/shop/payment/inicis/return/route.ts`와 동일 구조. 핵심 차이: 결제 성공 시 `Auction.paymentStatus = 'paid'`, `Auction.orderId = order.id` 업데이트. 재고 차감 없음(경매는 재고 개념 없음). 리다이렉트를 `/auction/{id}?paid=true`로.

Create `src/app/api/auction/payment/return/route.ts` — 기존 shop 결제 return과 동일하되:

1. `createRedirectHtml`, `sha256`, `getShopSettings`, `getAuthUrl`, `getNetCancelUrl` 함수 동일
2. Order 생성 후 추가: PendingOrder의 orderData에서 `auctionId` 추출하여 Auction 업데이트
3. 재고 차감 로직 제거
4. 리다이렉트 URL을 `/auction/${auctionId}?paid=true`로 변경

```typescript
      // Order 생성 후 Auction 업데이트
      const auctionId = orderData.auctionId
      if (auctionId) {
        await prisma.auction.update({
          where: { id: auctionId },
          data: {
            paymentStatus: "paid",
            orderId: order.id,
          },
        })
      }
```

- [ ] **Step 7.2: popup 핸들러 작성**

기존 `/api/shop/payment/inicis/popup/route.ts`와 동일. 리다이렉트 URL만 `/auction/{auctionId}?paid=true`로 변경.

- [ ] **Step 7.3: close 핸들러 작성**

기존 `/api/shop/payment/inicis/close/route.ts`와 완전 동일 (변경 없음).

- [ ] **Step 7.4: 커밋**

```bash
git add src/app/api/auction/payment/
git commit -m "💳 경매 이니시스 결제 콜백 (return/popup/close)"
```

---

## Task 8: 경매 결제 페이지

**Files:**
- Create: `src/app/auction/[id]/pay/page.tsx`

- [ ] **Step 8.1: 결제 페이지 작성**

기존 `/shop/order/page.tsx`의 이니시스 결제 흐름을 경매용으로 간소화.
배송 상품이면 배송지 입력 폼, 디지털이면 바로 결제.

핵심 구성:
- 경매 정보 표시 (제목, 낙찰가, 결제 기한 카운트다운)
- 배송 상품: 수령자, 연락처, 주소 (다음 주소 API), 배송비 계산
- 결제 요약 (낙찰가 + 배송비)
- 이니시스 카드결제 버튼
- 이니시스 스크립트 로드 + 결제 실행 (기존 shop 패턴 동일)

페이지에서 결제 불가 조건 체크:
- 낙찰자 본인이 아니면 → 접근 불가
- paymentStatus !== 'pending' → 이미 결제 또는 만료
- paymentDeadline 초과 → 기한 만료

- [ ] **Step 8.2: 커밋**

```bash
git add src/app/auction/[id]/pay/page.tsx
git commit -m "📄 경매 결제 페이지 구현"
```

---

## Task 9: 경매 상세 페이지 — 결제 UI 추가

**Files:**
- Modify: `src/app/auction/[id]/page.tsx`

- [ ] **Step 9.1: API에서 결제 관련 필드 반환하도록 수정**

`src/app/api/auction/[id]/route.ts`에서 이미 `a.*`로 전체 필드를 가져오므로 paymentStatus, paymentDeadline, orderId, requiresShipping이 자동 포함됨. Auction 인터페이스에 타입만 추가.

- [ ] **Step 9.2: 상세 페이지에 결제 상태별 UI 추가**

`src/app/auction/[id]/page.tsx`에서 기존 종료 경매 섹션을 다음으로 교체:

```tsx
{/* 종료된 경매 — 결제 상태별 UI */}
{auction.status === "ended" && (
  <div className="py-4 border-t border-border text-center space-y-2">
    {/* 낙찰자 본인 + 결제 대기 */}
    {auction.winnerId === currentUserId && auction.paymentStatus === "pending" && (
      <>
        <p className="text-sm font-medium">🎉 축하합니다! 낙찰되었습니다</p>
        <p className="text-2xl font-bold text-red-500">
          {auction.currentPrice.toLocaleString()}원
        </p>
        {auction.paymentDeadline && (
          <p className="text-xs text-muted-foreground">
            결제 기한: <AuctionTimer endsAt={auction.paymentDeadline} status="active" />
          </p>
        )}
        <a
          href={`/auction/${auction.id}/pay`}
          className="inline-block mt-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90"
        >
          결제하기
        </a>
      </>
    )}

    {/* 결제 완료 */}
    {auction.paymentStatus === "paid" && auction.winnerId === currentUserId && (
      <>
        <p className="text-sm font-medium">✅ 결제 완료</p>
        <p className="font-bold">{auction.currentPrice.toLocaleString()}원</p>
        {auction.orderId && (
          <a
            href={`/shop/orders/${auction.orderId}`}
            className="text-sm text-primary hover:underline"
          >
            주문 상세 보기
          </a>
        )}
      </>
    )}

    {/* 미결제 만료 (낙찰자 본인) */}
    {auction.paymentStatus === "expired" && auction.winnerId === currentUserId && (
      <>
        <p className="text-sm">⏰ 결제 기한이 만료되었습니다</p>
        <p className="text-xs text-muted-foreground">
          동일 조건으로 재경매가 자동 등록되었습니다.
        </p>
      </>
    )}

    {/* 제3자 */}
    {auction.winnerId !== currentUserId && auction.winner && (
      <p className="text-sm">
        <span className="font-bold">{auction.winner.nickname}</span>
        <span className="text-muted-foreground">님이 </span>
        <span className="font-bold text-red-500">{auction.currentPrice.toLocaleString()}원</span>
        <span className="text-muted-foreground">에 낙찰</span>
      </p>
    )}

    {/* 유찰 */}
    {!auction.winnerId && (
      <p className="text-sm text-muted-foreground">유찰되었습니다.</p>
    )}
  </div>
)}
```

- [ ] **Step 9.3: 커밋**

```bash
git add src/app/auction/[id]/page.tsx src/app/api/auction/[id]/route.ts
git commit -m "🎨 경매 상세 결제 상태별 UI (결제하기/완료/만료)"
```

---

## Task 10: 최종 확인

- [ ] **Step 10.1: 시드 재실행**

```bash
npx tsx prisma/seed-auction.ts
```

- [ ] **Step 10.2: 빌드 확인**

```bash
npx next build
```

- [ ] **Step 10.3: 커밋**

```bash
git add -A
git commit -m "✅ 경매 결제 시스템 구현 완료"
```
