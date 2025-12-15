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

// 이니시스 결제 완료 콜백 (POST) - 결제창에서 리턴
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // 이니시스에서 전달받은 데이터
    const resultCode = formData.get('resultCode') as string
    const resultMsg = formData.get('resultMsg') as string
    const mid = formData.get('mid') as string
    const orderNumber = formData.get('orderNumber') as string
    const authToken = formData.get('authToken') as string
    const authUrl = formData.get('authUrl') as string
    const netCancelUrl = formData.get('netCancelUrl') as string
    const charset = formData.get('charset') as string || 'UTF-8'
    const merchantData = formData.get('merchantData') as string

    console.log('이니시스 결제 리턴:', {
      resultCode,
      resultMsg,
      orderNumber,
      authToken: authToken?.substring(0, 20) + '...'
    })

    // 결제 실패 처리
    if (resultCode !== '0000') {
      console.error('결제 인증 실패:', resultCode, resultMsg)

      // 주문 상태를 cancelled로 변경
      if (orderNumber) {
        await prisma.order.update({
          where: { orderNo: orderNumber },
          data: {
            status: 'cancelled',
            cancelReason: `결제 실패: ${resultMsg}`,
            cancelledAt: new Date()
          }
        })
      }

      // 실패 페이지로 리다이렉트
      const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3004'
      return NextResponse.redirect(
        `${baseUrl}/shop/order/complete?error=payment_failed&message=${encodeURIComponent(resultMsg)}`
      )
    }

    // 결제 승인 요청 (authUrl로 POST)
    const settings = await getShopSettings()
    const signKey = settings.pg_signkey || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS'

    // 승인 요청 데이터
    const timestamp = Date.now().toString()
    const signature = sha256(`authToken=${authToken}&timestamp=${timestamp}`)
    const verification = sha256(`authToken=${authToken}&signKey=${signKey}`)

    const authData = new URLSearchParams({
      mid,
      authToken,
      timestamp,
      signature,
      verification,
      charset,
      format: 'JSON'
    })

    // 승인 요청
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: authData.toString()
    })

    const authResult = await authResponse.json()
    console.log('이니시스 승인 결과:', authResult)

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3004'

    // 승인 실패
    if (authResult.resultCode !== '0000') {
      console.error('결제 승인 실패:', authResult.resultCode, authResult.resultMsg)

      // 망취소 요청
      if (netCancelUrl) {
        try {
          await fetch(netCancelUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: authData.toString()
          })
        } catch (e) {
          console.error('망취소 요청 실패:', e)
        }
      }

      // 주문 상태를 cancelled로 변경
      await prisma.order.update({
        where: { orderNo: orderNumber },
        data: {
          status: 'cancelled',
          cancelReason: `결제 승인 실패: ${authResult.resultMsg}`,
          cancelledAt: new Date()
        }
      })

      return NextResponse.redirect(
        `${baseUrl}/shop/order/complete?error=auth_failed&message=${encodeURIComponent(authResult.resultMsg)}`
      )
    }

    // 결제 성공! 주문 상태 업데이트
    const order = await prisma.order.update({
      where: { orderNo: orderNumber },
      data: {
        status: 'paid',
        paymentMethod: 'card',
        paymentInfo: JSON.stringify({
          tid: authResult.tid,
          authDate: authResult.authDate,
          cardCode: authResult.CARD_Code,
          cardName: authResult.CARD_BankCode,
          cardNum: authResult.CARD_Num,
          cardQuota: authResult.CARD_Quota,
          applNum: authResult.applNum,
          resultCode: authResult.resultCode,
          resultMsg: authResult.resultMsg
        }),
        paidAt: new Date()
      },
      include: {
        items: {
          include: { product: true }
        }
      }
    })

    // 재고 차감
    for (const item of order.items) {
      if (item.optionId) {
        await prisma.productOption.update({
          where: { id: item.optionId },
          data: {
            stock: { decrement: item.quantity }
          }
        })
      }

      // 상품 판매 수량 증가
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          soldCount: { increment: item.quantity }
        }
      })
    }

    console.log('결제 완료:', order.orderNo)

    // 성공 페이지로 리다이렉트
    return NextResponse.redirect(
      `${baseUrl}/shop/order/complete?orderNo=${order.orderNo}`
    )

  } catch (error) {
    console.error('결제 콜백 처리 에러:', error)
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3004'
    return NextResponse.redirect(
      `${baseUrl}/shop/order/complete?error=system_error&message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다.')}`
    )
  }
}

// GET 요청도 처리 (일부 PG사는 GET으로 리다이렉트)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const orderNo = searchParams.get('orderNo')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3004'

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/shop/order/complete?error=${error}&message=${searchParams.get('message') || '결제가 취소되었습니다.'}`
    )
  }

  if (orderNo) {
    return NextResponse.redirect(
      `${baseUrl}/shop/order/complete?orderNo=${orderNo}`
    )
  }

  return NextResponse.redirect(`${baseUrl}/shop`)
}
