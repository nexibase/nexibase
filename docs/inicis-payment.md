# KG 이니시스 결제 연동 가이드

## 개요

NexiBase 쇼핑몰의 카드결제는 KG이니시스 웹표준 결제(PC)를 사용합니다.

## 결제 모드

### Overlay 모드 (현재 사용)
- 결제창이 현재 페이지 위에 모달로 표시
- 주문서 페이지가 유지됨
- `payViewType: "overlay"` 설정 필요

### Popup 모드
- 새 창으로 결제창 표시
- 팝업 차단 이슈 가능성

## 핵심 파일 구조

```
src/app/
├── shop/order/page.tsx          # 주문서 페이지 (결제 호출)
└── api/shop/payment/inicis/
    ├── route.ts                 # 결제 데이터 생성 API
    ├── return/route.ts          # 결제 완료 콜백
    ├── close/route.ts           # 결제창 닫기 콜백
    └── popup/route.ts           # overlay 모드용 팝업 URL
```

## Overlay 모드 구현 시 주의사항

### 1. 스크립트 로드
```tsx
// Next.js Script 컴포넌트로 미리 로드
<Script
  src="https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
  strategy="beforeInteractive"
/>
```

- 테스트: `https://stgstdpay.inicis.com/stdjs/INIStdPay.js`
- 운영: `https://stdpay.inicis.com/stdjs/INIStdPay.js`

### 2. popupUrl 필수
overlay 모드에서는 `popupUrl` 파라미터가 필요하며, 해당 URL에서 `INIStdPay_popup.js` 스크립트를 반환해야 함:

```typescript
// popup/route.ts
const html = `<script src="https://stgstdpay.inicis.com/stdjs/INIStdPay_popup.js"></script>`
```

### 3. iframe 투명화 문제 해결
이니시스 overlay 모드는 페이지에 iframe을 생성하는데, 기본적으로 흰색 배경이 적용됨.
MutationObserver를 사용하여 iframe 생성 시 투명화 처리 필요:

```typescript
useEffect(() => {
  const isInicisIframe = (iframe: HTMLIFrameElement) =>
    iframe.src?.includes('inicis') || iframe.name?.includes('INI')

  const makeIframeTransparent = (iframe: HTMLIFrameElement) => {
    iframe.style.backgroundColor = 'transparent'
    iframe.setAttribute('allowTransparency', 'true')
    iframe.setAttribute('frameBorder', '0')
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(({ addedNodes }) => {
      addedNodes.forEach((node) => {
        if (node instanceof HTMLElement && node.tagName === 'IFRAME') {
          if (isInicisIframe(node as HTMLIFrameElement)) {
            makeIframeTransparent(node as HTMLIFrameElement)
          }
        }
      })
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
  return () => observer.disconnect()
}, [])
```

### 4. payViewType 명시적 설정
폼 필드에 `payViewType: "overlay"` 반드시 포함:

```typescript
const fields = {
  // ... 기타 필드
  payViewType: "overlay",
  popupUrl: payment.popupUrl,
}
```

## 결제 흐름

```
1. 주문서 작성 → 결제하기 클릭
2. API 호출 (POST /api/shop/payment/inicis)
   - PendingOrder 생성
   - 결제 데이터 (signature, timestamp 등) 생성
3. INIStdPay.pay("formId") 호출
4. 이니시스 결제창 표시 (overlay)
5. 결제 완료/취소
   - 완료: returnUrl로 결과 전송 → 주문 확정 → 완료 페이지
   - 취소: closeUrl 호출 → 주문서로 복귀
```

## 테스트 결제

- 테스트 MID: `INIpayTest`
- 테스트 결제는 실 승인되지만 당일 24:00 이전 자동 취소
- 국민카드, 카카오뱅크는 테스트 불가

## 환경 변수

```env
PG_TEST_MODE=true          # 테스트 모드 (기본값)
PG_INICIS_MID=INIpayTest   # 상점 MID
PG_INICIS_SIGN_KEY=...     # 서명 키
```

## 참고 자료

- [이니시스 개발자 매뉴얼](https://manual.inicis.com)
- [데모 페이지](https://manual.inicis.com/pay/demo/pcDemo.php)
- 샘플 코드: `/general_pc/PC 일반결제/node/`
