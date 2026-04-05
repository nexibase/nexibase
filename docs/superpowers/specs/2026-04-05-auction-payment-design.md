# 경매 낙찰 결제 시스템 설계 문서

> 경매 낙찰 후 기존 이니시스 결제를 재활용한 결제 흐름

## 개요

경매 낙찰 시 낙찰자가 24시간 이내에 카드결제하는 시스템.
기존 넥시베이스의 이니시스 결제 인프라(PendingOrder, Order, 결제 콜백)를 그대로 재활용한다.

---

## 핵심 결정사항

| 영역 | 결정 |
|------|------|
| 결제 수단 | 카드결제만 (기존 이니시스) |
| 결제 기한 | 낙찰 후 24시간 |
| 미결제 처리 | 경매 취소 + 같은 조건으로 자동 재등록 |
| 배송 구분 | 등록 시 판매자 선택 (배송 상품 / 디지털 상품) |
| 배송 상품 | 배송지 입력 + 배송비 + 카드결제 |
| 디지털 상품 | 배송 없이 낙찰가만 카드결제 |
| 미결제 페널티 | 1회: 3일, 2회: 10일, 3회+: 30일 이용 제한 |

---

## DB 스키마 변경

### Auction 모델 추가 필드

```prisma
requiresShipping  Boolean   @default(true)      // 배송 필요 여부
paymentDeadline   DateTime?                     // 결제 기한 (낙찰 + 24시간)
paymentStatus     String?   @db.VarChar(20)     // null/pending/paid/expired
orderId           Int?      @unique             // 결제 완료 시 Order FK
```

### User 모델 추가 필드

```prisma
auctionPenaltyCount   Int       @default(0)     // 미결제 누적 횟수
auctionBannedUntil    DateTime?                 // 경매 이용 제한 일시
```

### 페널티 정책

| 미결제 횟수 | 제재 기간 |
|------------|----------|
| 1회 | 3일 이용 제한 |
| 2회 | 10일 이용 제한 |
| 3회 이상 | 30일 이용 제한 |

이용 제한 중에는 경매 등록 및 입찰 불가.

---

## 결제 흐름

### 1. 낙찰 → 결제 대기

```
경매 종료 (cron 또는 즉시구매)
    ↓
낙찰자 결정 (winnerId 설정)
    ↓
paymentStatus = 'pending'
paymentDeadline = now() + 24시간
    ↓
낙찰자에게 알림 (인앱 + 이메일)
"24시간 이내에 결제해주세요"
```

### 2. 결제 페이지 (`/auction/[id]/pay`)

**배송 상품 (requiresShipping = true):**
- 배송지 입력 (수령자, 연락처, 주소)
- 배송비 계산 (기존 `/api/shop/delivery-fee` API 재활용)
- 결제 요약 (낙찰가 + 배송비 = 최종금액)
- 이니시스 카드결제

**디지털 상품 (requiresShipping = false):**
- 결제 요약 (낙찰가 = 최종금액, 배송비 0원)
- 이니시스 카드결제

### 3. 결제 완료

```
이니시스 결제 성공 콜백
    ↓
Order 생성 (status: 'paid', paymentMethod: 'card')
OrderItem 생성 (productName: 경매 제목, price: 낙찰가, quantity: 1)
    ↓
Auction.paymentStatus = 'paid'
Auction.orderId = order.id
    ↓
판매자/낙찰자 알림 발송
```

### 4. 미결제 처리 (cron - 매분 실행)

```
paymentStatus = 'pending' AND paymentDeadline < now()
    ↓
paymentStatus = 'expired'
    ↓
낙찰자 페널티 누적 (auctionPenaltyCount++)
    ↓
제재 기간 설정:
  1회 → auctionBannedUntil = now() + 3일
  2회 → auctionBannedUntil = now() + 10일
  3회+ → auctionBannedUntil = now() + 30일
    ↓
경매 자동 재등록:
  같은 조건 (제목, 설명, 이미지, 시작가, 즉시구매가, 입찰단위, 배송여부)
  새 시작시간 = now(), 새 종료시간 = now() + 원래 경매 기간
  status = 'active'
    ↓
판매자 알림 "미결제로 재경매 자동 등록됨"
낙찰자 알림 "미결제로 경매 이용이 N일간 제한됩니다"
```

---

## 페이지 & API

### 새로 만들 파일

| 경로 | 설명 |
|------|------|
| `src/app/auction/[id]/pay/page.tsx` | 결제 페이지 (배송지 + 결제) |
| `src/app/api/auction/[id]/pay/route.ts` | 결제 준비 API (PendingOrder + 이니시스 데이터) |
| `src/app/api/auction/payment/return/route.ts` | 이니시스 결제 완료 콜백 |
| `src/app/api/auction/payment/close/route.ts` | 결제 팝업 닫기 |
| `src/app/api/auction/payment/popup/route.ts` | 결제 성공 리다이렉트 |

### 수정할 파일

| 파일 | 변경 |
|------|------|
| `prisma/schema.prisma` | Auction, User 필드 추가 |
| `src/app/auction/[id]/page.tsx` | 낙찰자 결제 UI (결제하기 버튼, 기한 카운트다운, 결제완료 표시) |
| `src/app/auction/create/page.tsx` | "배송 필요" 체크박스 추가 |
| `src/app/api/auction/route.ts` (POST) | requiresShipping 저장 |
| `src/app/api/auction/cron/close-expired/route.ts` | 낙찰 시 paymentStatus/Deadline 설정 + 미결제 만료 처리 + 자동 재등록 |
| `src/app/api/auction/[id]/bid/route.ts` | 입찰 시 이용 제한 체크 (auctionBannedUntil) |

---

## 경매 상세 페이지 상태별 UI

### 낙찰자 본인이 볼 때 (결제 대기)

```
🎉 축하합니다! 낙찰되었습니다
낙찰가: 430원
결제 기한: 23시간 41분
[결제하기]
```

### 결제 완료 후

```
✅ 결제 완료
낙찰가: 430원
주문번호: 260405-xxxxx
[주문 상세 보기]
```

### 미결제 만료 후

```
⏰ 결제 기한이 만료되었습니다
동일 조건으로 재경매가 자동 등록되었습니다.
```

### 제3자가 볼 때

```
경매 종료
낙찰자: 김민수
낙찰가: 430원
```

---

## 입찰 제한 체크

입찰/등록 시 다음을 확인:
```
if (user.auctionBannedUntil && user.auctionBannedUntil > now()) {
  return "경매 이용이 제한되어 있습니다. (해제일: YYYY-MM-DD)"
}
```

적용 위치:
- `POST /api/auction` (경매 등록)
- `POST /api/auction/[id]/bid` (입찰)
- `POST /api/auction/[id]/buy-now` (즉시구매)

---

## 결제 페이지 UI (`/auction/[id]/pay`)

```
┌──────────────────────────────────────┐
│  경매 결제                            │
│                                      │
│  상품: 삼성 갤럭시 S25 울트라         │
│  낙찰가: 430원                       │
│  결제 기한: 23시간 41분 남음          │
│                                      │
│  ─── 배송 정보 (배송 상품만) ───     │
│  수령자: [        ]                  │
│  연락처: [        ]                  │
│  주소:   [우편번호 검색] [        ]   │
│  배송비: 3,000원                     │
│                                      │
│  ─── 결제 요약 ───                   │
│  낙찰가:   430원                     │
│  배송비: 3,000원                     │
│  총 결제: 3,430원                    │
│                                      │
│  [        카드결제        ]          │
└──────────────────────────────────────┘
```

---

## 이니시스 결제 재활용 방식

기존 쇼핑몰 결제와 동일한 구조를 따르되, 경매 전용 엔드포인트를 사용한다.

### 결제 준비 (`POST /api/auction/[id]/pay`)

1. 낙찰자 본인 확인
2. paymentStatus === 'pending' 확인
3. paymentDeadline 미만료 확인
4. PendingOrder 생성 (orderData에 경매 정보 포함)
5. 이니시스 결제 데이터 생성 (기존 `/api/shop/payment/inicis`와 동일 로직)
6. returnUrl = `/api/auction/payment/return`

### 결제 완료 콜백 (`POST /api/auction/payment/return`)

1. 이니시스 인증 확인 (resultCode === '0000')
2. 결제 승인 요청 (authUrl 호출)
3. PendingOrder에서 주문 데이터 복원
4. 금액 검증
5. Order + OrderItem 생성
6. Auction.paymentStatus = 'paid', orderId = order.id
7. PendingOrder 삭제
8. 알림 발송
9. 완료 페이지로 리다이렉트
