import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { createNewOrderNotificationForAdmins, createOrderCompletedNotification } from '@/lib/notification'

// SHA256 해시 생성
function sha256(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// IDC별 승인 URL 가져오기
function getAuthUrl(idcName: string): string {
  const baseUrl = 'stdpay.inicis.com/api/payAuth'
  switch (idcName) {
    case 'fc':
      return `https://fc${baseUrl}`
    case 'ks':
      return `https://ks${baseUrl}`
    case 'stg':
      return `https://stg${baseUrl}`
    default:
      return `https://stg${baseUrl}` // 기본값은 테스트 서버
  }
}

// IDC별 망취소 URL 가져오기
function getNetCancelUrl(idcName: string): string {
  const baseUrl = 'stdpay.inicis.com/api/netCancel'
  switch (idcName) {
    case 'fc':
      return `https://fc${baseUrl}`
    case 'ks':
      return `https://ks${baseUrl}`
    case 'stg':
      return `https://stg${baseUrl}`
    default:
      return `https://stg${baseUrl}`
  }
}

// overlay/popup 모드에서 부모 창을 리다이렉트하는 HTML 반환
function createRedirectHtml(redirectUrl: string) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>결제 처리중...</title>
  <script>
    // overlay 모드: 부모 페이지를 직접 리다이렉트
    // popup 모드: opener를 통해 리다이렉트
    try {
      if (window.parent && window.parent !== window) {
        // iframe (overlay 모드)
        window.parent.location.href = '${redirectUrl}';
      } else if (window.opener) {
        // popup 모드
        window.opener.location.href = '${redirectUrl}';
        window.close();
      } else {
        // 직접 접근
        window.location.href = '${redirectUrl}';
      }
    } catch (e) {
      // 크로스 오리진 에러 등의 경우 직접 이동
      window.location.href = '${redirectUrl}';
    }
  </script>
</head>
<body>
  <p>결제 처리중입니다. 잠시만 기다려주세요...</p>
  <p>창이 자동으로 이동하지 않으면 <a href="${redirectUrl}">여기를 클릭</a>하세요.</p>
</body>
</html>
`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

// GET 요청 처리 (이니시스 팝업 모드에서 GET으로 호출될 수 있음)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // request에서 호스트 정보를 가져와 baseUrl 생성
  const host = request.headers.get('host') || 'localhost:3003'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = process.env.NEXT_PUBLIC_URL || `${protocol}://${host}`

  // 에러 파라미터가 있으면 에러 페이지로
  const error = searchParams.get('error')
  const message = searchParams.get('message')

  if (error) {
    const redirectUrl = `${baseUrl}/shop/order/complete?error=${error}&message=${encodeURIComponent(message || '결제에 실패했습니다.')}`
    return createRedirectHtml(redirectUrl)
  }

  // 주문번호가 있으면 완료 페이지로
  const orderNo = searchParams.get('orderNo') || searchParams.get('MOID')
  if (orderNo) {
    const redirectUrl = `${baseUrl}/shop/order/complete?orderNo=${orderNo}`
    return createRedirectHtml(redirectUrl)
  }

  // 기타 경우 (파라미터 없이 GET 접근) - 결제 처리중 표시
  // 이니시스가 POST로 인증 결과를 보내기 전에 GET으로 먼저 접근할 수 있음
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>결제 처리중...</title>
</head>
<body>
  <p>결제 처리중입니다. 잠시만 기다려주세요...</p>
</body>
</html>
`
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

// 결제 승인 결과 처리 (POST)
export async function POST(request: NextRequest) {
  // request에서 호스트 정보를 가져와 baseUrl 생성
  const host = request.headers.get('host') || 'localhost:3003'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = process.env.NEXT_PUBLIC_URL || `${protocol}://${host}`

  // overlay/popup에서 부모 창 리다이렉트 헬퍼 함수
  const redirectTo = (path: string) => {
    const url = new URL(path, baseUrl)
    return createRedirectHtml(url.toString())
  }

  try {
    // form-urlencoded 데이터 파싱
    const formData = await request.formData()
    const body: Record<string, string> = {}
    formData.forEach((value, key) => {
      body[key] = value.toString()
    })

    const resultCode = body.resultCode
    const resultMsg = body.resultMsg

    // 인증 실패인 경우
    if (resultCode !== '0000') {
      console.error('이니시스 인증 실패:', resultCode, resultMsg)

      // PendingOrder 삭제
      const oid = body.orderNumber || body.MOID
      if (oid) {
        await prisma.pendingOrder.deleteMany({
          where: { orderNo: oid }
        })
      }

      // 에러 페이지로 리다이렉트
      return redirectTo(`/shop/order/complete?error=payment_failed&message=${encodeURIComponent(resultMsg || '결제 인증에 실패했습니다.')}`)
    }

    // 인증 성공 - 승인 요청
    const settings = await getShopSettings()
    const signKey = settings.pg_signkey || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS'

    const mid = body.mid
    const authToken = body.authToken
    const authUrl = body.authUrl
    const netCancelUrl = body.netCancelUrl
    const idcName = body.idc_name || 'stg'
    const timestamp = Date.now().toString()

    // 승인 요청용 서명 생성
    const signature = sha256(`authToken=${authToken}&timestamp=${timestamp}`)
    const verification = sha256(`authToken=${authToken}&signKey=${signKey}&timestamp=${timestamp}`)

    // 승인 요청 데이터
    const authData = new URLSearchParams({
      mid,
      authToken,
      timestamp,
      signature,
      verification,
      charset: 'UTF-8',
      format: 'JSON'
    })

    // IDC URL 검증
    const expectedAuthUrl = getAuthUrl(idcName)
    if (authUrl !== expectedAuthUrl) {
      console.warn('인증 URL 불일치:', authUrl, expectedAuthUrl)
    }

    // 승인 요청
    const authResponse = await fetch(expectedAuthUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: authData.toString()
    })

    const authResult = await authResponse.json()
    console.log('이니시스 승인 결과:', authResult)

    // 승인 성공
    if (authResult.resultCode === '0000') {
      const orderNo = authResult.MOID
      const tid = authResult.tid
      const totPrice = parseInt(authResult.TotPrice)

      // PendingOrder에서 주문 데이터 가져오기
      const pendingOrder = await prisma.pendingOrder.findUnique({
        where: { orderNo }
      })

      if (!pendingOrder) {
        console.error('PendingOrder를 찾을 수 없습니다:', orderNo)
        return redirectTo(`/shop/order/complete?error=order_not_found&message=${encodeURIComponent('주문 정보를 찾을 수 없습니다.')}`)
      }

      const orderData = JSON.parse(pendingOrder.orderData)

      // 결제 금액 검증
      if (totPrice !== orderData.finalPrice) {
        console.error('결제 금액 불일치:', totPrice, orderData.finalPrice)

        // 망취소 요청
        const netCancelData = new URLSearchParams({
          mid,
          authToken,
          timestamp,
          signature,
          verification,
          charset: 'UTF-8',
          format: 'JSON'
        })

        const expectedNetCancelUrl = getNetCancelUrl(idcName)
        await fetch(expectedNetCancelUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: netCancelData.toString()
        })

        // PendingOrder 삭제
        await prisma.pendingOrder.delete({ where: { orderNo } })

        return redirectTo(`/shop/order/complete?error=amount_mismatch&message=${encodeURIComponent('결제 금액이 일치하지 않습니다.')}`)
      }

      // 실제 주문 생성 (결제 완료 상태로)
      await prisma.order.create({
        data: {
          orderNo,
          userId: pendingOrder.userId,
          ordererName: orderData.ordererName,
          ordererPhone: orderData.ordererPhone,
          ordererEmail: orderData.ordererEmail,
          recipientName: orderData.recipientName,
          recipientPhone: orderData.recipientPhone,
          zipCode: orderData.zipCode,
          address: orderData.address,
          addressDetail: orderData.addressDetail,
          deliveryMemo: orderData.deliveryMemo,
          totalPrice: orderData.totalPrice,
          deliveryFee: orderData.deliveryFee,
          finalPrice: orderData.finalPrice,
          status: 'paid',
          paymentMethod: 'card',
          paymentInfo: JSON.stringify({
            tid,
            cardName: authResult.CARD_BankCode,
            cardNo: authResult.CARD_Num,
            cardQuota: authResult.CARD_Quota,
            applNum: authResult.applNum,
            applDate: authResult.applDate,
            applTime: authResult.applTime
          }),
          paidAt: new Date(),
          items: {
            create: orderData.items
          }
        }
      })

      // 재고 차감 및 판매 수량 증가
      for (const item of orderData.items) {
        if (item.optionId) {
          // 옵션이 있는 경우: 옵션 재고 차감
          await prisma.productOption.update({
            where: { id: item.optionId },
            data: {
              stock: { decrement: item.quantity }
            }
          })
        } else {
          // 옵션이 없는 경우: 상품 재고 차감
          await prisma.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity }
            }
          })
        }
        // 판매 수량 증가
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            soldCount: { increment: item.quantity }
          }
        })
      }

      // PendingOrder 삭제
      await prisma.pendingOrder.delete({ where: { orderNo } })

      // 주문자에게 주문 완료 알림 발송 (비동기 - 응답 지연 방지)
      const emailItems = orderData.items.map((item: { productName: string; optionText?: string; quantity: number; subtotal: number }) => ({
        name: item.productName + (item.optionText ? ` (${item.optionText})` : ''),
        quantity: item.quantity,
        price: item.subtotal
      }))
      createOrderCompletedNotification(pendingOrder.userId, orderNo, orderData.finalPrice, emailItems)
        .catch(err => console.error('주문자 알림 발송 실패:', err))

      // 관리자/부관리자에게 새 주문 알림 발송 (비동기 - 응답 지연 방지)
      createNewOrderNotificationForAdmins(0, orderNo, orderData.finalPrice, orderData.ordererName)
        .catch(err => console.error('관리자 알림 발송 실패:', err))

      // 주문 완료 페이지로 리다이렉트
      return redirectTo(`/shop/order/complete?orderNo=${orderNo}`)
    } else {
      // 승인 실패
      console.error('이니시스 승인 실패:', authResult)

      const orderNo = body.orderNumber || body.MOID
      if (orderNo) {
        // PendingOrder 삭제
        await prisma.pendingOrder.deleteMany({
          where: { orderNo }
        })
      }

      return redirectTo(`/shop/order/complete?error=approval_failed&message=${encodeURIComponent(authResult.resultMsg || '결제 승인에 실패했습니다.')}`)
    }
  } catch (error) {
    console.error('결제 처리 에러:', error)
    return redirectTo(`/shop/order/complete?error=server_error&message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다.')}`)
  }
}
