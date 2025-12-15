import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

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

// 결제 승인 결과 처리 (POST)
export async function POST(request: NextRequest) {
  // request에서 호스트 정보를 가져와 baseUrl 생성
  const host = request.headers.get('host') || 'localhost:3004'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = process.env.NEXT_PUBLIC_URL || `${protocol}://${host}`

  // 리다이렉트 헬퍼 함수 (303: POST → GET 변환)
  const redirectTo = (path: string) => {
    const url = new URL(path, baseUrl)
    return NextResponse.redirect(url.toString(), 303)
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
          await prisma.productOption.update({
            where: { id: item.optionId },
            data: {
              stock: { decrement: item.quantity }
            }
          })
        }
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            soldCount: { increment: item.quantity }
          }
        })
      }

      // PendingOrder 삭제
      await prisma.pendingOrder.delete({ where: { orderNo } })

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
