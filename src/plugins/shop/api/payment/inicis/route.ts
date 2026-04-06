import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { getAuthUser } from '@/lib/auth'

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// 주문번호 생성 (YYMMDDHH-iiXXXXX = 16자리, ii=분, 중복 체크)
async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const ii = String(now.getMinutes()).padStart(2, '0')

  // 최대 10번 시도
  for (let i = 0; i < 10; i++) {
    const rand = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    const orderNo = `${yy}${MM}${dd}${hh}-${ii}${rand}`

    // 중복 체크
    const exists = await prisma.order.findUnique({ where: { orderNo } })
    if (!exists) {
      return orderNo
    }
  }

  // 10번 실패 시 초+랜덤
  const ss = String(now.getSeconds()).padStart(2, '0')
  const rand = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return `${yy}${MM}${dd}${hh}-${ii}${ss}${rand}`
}

// SHA256 해시 생성
function sha256(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

// 결제 준비 (결제 데이터 생성)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      items,
      ordererName,
      ordererPhone,
      ordererEmail,
      recipientName,
      recipientPhone,
      zipCode,
      address,
      addressDetail,
      deliveryMemo,
      deliveryFee: clientDeliveryFee,  // 클라이언트에서 계산된 배송비
      baseUrl: clientBaseUrl  // 클라이언트에서 전달받은 baseUrl
    } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '주문 상품이 없습니다.' }, { status: 400 })
    }

    // 쇼핑몰 설정 가져오기
    const settings = await getShopSettings()
    const testMode = settings.pg_test_mode !== 'false'
    // 테스트 모드면 무조건 테스트용 MID, SignKey 사용
    const mid = testMode ? 'INIpayTest' : (settings.pg_mid || 'INIpayTest')
    const signKey = testMode ? 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS' : (settings.pg_signkey || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS')

    // 상품 정보 조회 및 가격 계산
    let totalPrice = 0
    const orderItems = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          options: item.optionId ? {
            where: { id: item.optionId }
          } : false
        }
      })

      if (!product) {
        return NextResponse.json({ error: `상품을 찾을 수 없습니다: ${item.productId}` }, { status: 400 })
      }

      // 옵션 가격 또는 기본 가격
      let price = product.price
      let optionText = ''

      if (item.optionId && product.options && product.options.length > 0) {
        const option = product.options[0]
        price = option.price
        const optionParts = [option.option1, option.option2, option.option3].filter(Boolean)
        optionText = optionParts.join(' / ')
      }

      const subtotal = price * item.quantity
      totalPrice += subtotal

      orderItems.push({
        productId: product.id,
        productName: product.name,
        optionId: item.optionId || null,
        optionText: optionText || null,
        price,
        quantity: item.quantity,
        subtotal
      })
    }

    // 배송비는 클라이언트에서 전달된 값 사용 (화면에 표시된 금액과 일치하도록)
    const deliveryFee = typeof clientDeliveryFee === 'number' ? clientDeliveryFee : 0

    const finalPrice = totalPrice + deliveryFee

    console.log('결제 금액 계산:', { totalPrice, clientDeliveryFee, deliveryFee, finalPrice })

    // 주문번호만 생성 (주문은 결제 완료 후 생성)
    const orderNo = await generateOrderNo()

    // 주문 데이터를 임시 저장 (PendingOrder 테이블 또는 캐시)
    // 여기서는 간단히 PendingOrder 테이블 사용
    await prisma.pendingOrder.upsert({
      where: { orderNo },
      create: {
        orderNo,
        userId: user.id,
        orderData: JSON.stringify({
          ordererName,
          ordererPhone,
          ordererEmail: ordererEmail || null,
          recipientName,
          recipientPhone,
          zipCode,
          address,
          addressDetail: addressDetail || null,
          deliveryMemo: deliveryMemo || null,
          totalPrice,
          deliveryFee,
          finalPrice,
          items: orderItems
        }),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30분 후 만료
      },
      update: {
        orderData: JSON.stringify({
          ordererName,
          ordererPhone,
          ordererEmail: ordererEmail || null,
          recipientName,
          recipientPhone,
          zipCode,
          address,
          addressDetail: addressDetail || null,
          deliveryMemo: deliveryMemo || null,
          totalPrice,
          deliveryFee,
          finalPrice,
          items: orderItems
        }),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000)
      }
    })

    // 이니시스 결제 요청 데이터 생성
    const timestamp = Date.now().toString()
    const goodsName = orderItems.length > 1
      ? `${orderItems[0].productName} 외 ${orderItems.length - 1}건`
      : orderItems[0].productName

    // 결제 URL
    const payUrl = testMode
      ? 'https://stgstdpay.inicis.com/stdjs/INIStdPay.js'
      : 'https://stdpay.inicis.com/stdjs/INIStdPay.js'

    // 클라이언트에서 전달받은 URL 사용 (이니시스는 요청 페이지와 동일한 도메인 필요)
    const baseUrl = clientBaseUrl || process.env.NEXT_PUBLIC_URL || 'http://localhost:3003'

    // 해시 데이터 생성 (이니시스 웹표준 방식)
    // signature: oid + price + timestamp 해시
    const signature = sha256(`oid=${orderNo}&price=${finalPrice}&timestamp=${timestamp}`)
    // mKey: signKey 해시
    const mKey = sha256(signKey)

    console.log('이니시스 결제 데이터:', { mid, orderNo, finalPrice, timestamp, testMode })

    // 결제 요청에 필요한 데이터
    const paymentData = {
      // 기본 정보
      version: '1.0',
      mid,
      oid: orderNo,
      goodname: goodsName,
      price: finalPrice,
      currency: 'WON',

      // 구매자 정보
      buyername: ordererName,
      buyertel: ordererPhone,
      buyeremail: ordererEmail || '',

      // 타임스탬프 및 서명
      timestamp,
      signature,
      mKey,

      // URL 설정 (데모와 동일하게 popupUrl 추가)
      returnUrl: `${baseUrl}/api/shop/payment/inicis/return`,
      closeUrl: `${baseUrl}/api/shop/payment/inicis/close`,
      popupUrl: `${baseUrl}/api/shop/payment/inicis/popup`,

      // 결제 방식 (카드만)
      gopaymethod: 'Card',

      // 추가 옵션 (데모 참고: HPP(1):below1000:va_receipt:centerCd(Y))
      acceptmethod: 'below1000:centerCd(Y)',

      // 결제 스크립트 URL
      payUrl,
      testMode
    }

    return NextResponse.json({
      success: true,
      order: {
        orderNo,
        finalPrice
      },
      payment: paymentData
    })
  } catch (error) {
    console.error('결제 준비 에러:', error)
    return NextResponse.json(
      { error: '결제 준비 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
