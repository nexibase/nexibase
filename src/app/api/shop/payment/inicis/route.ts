import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

// 세션에서 사용자 정보 가져오기
async function getUser(request: NextRequest) {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null

  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: { user: true }
  })

  if (!session || session.expires < new Date()) return null
  return session.user
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

// 주문번호 생성 (YYMMDDHH-XXXXXXX = 16자리, 중복 체크)
async function generateOrderNo(): Promise<string> {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')

  // 최대 10번 시도
  for (let i = 0; i < 10; i++) {
    const rand = String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
    const orderNo = `${yy}${MM}${dd}${hh}-${rand}`

    // 중복 체크
    const exists = await prisma.order.findUnique({ where: { orderNo } })
    if (!exists) {
      return orderNo
    }
  }

  // 10번 실패 시 타임스탬프 추가
  const ts = Date.now().toString().slice(-6)
  return `${yy}${MM}${dd}${hh}-${ts}0`
}

// SHA256 해시 생성
function sha256(str: string) {
  return crypto.createHash('sha256').update(str).digest('hex')
}

// 결제 준비 (결제 데이터 생성)
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request)
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
      deliveryMemo
    } = body

    if (!items || items.length === 0) {
      return NextResponse.json({ error: '주문 상품이 없습니다.' }, { status: 400 })
    }

    // 쇼핑몰 설정 가져오기
    const settings = await getShopSettings()
    const mid = settings.pg_mid || 'INIpayTest'
    const signKey = settings.pg_signkey || 'SU5JTElURV9UUklQTEVERVNfS0VZU1RS' // 테스트 SignKey
    const testMode = settings.pg_test_mode !== 'false'

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

    // 배송비 계산
    let deliveryFee = 0
    if (zipCode) {
      const deliveryRes = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3004'}/api/shop/delivery-fee`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode, totalPrice })
      })
      if (deliveryRes.ok) {
        const deliveryData = await deliveryRes.json()
        deliveryFee = deliveryData.fee || 0
      }
    }

    const finalPrice = totalPrice + deliveryFee

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

    const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3004'

    // 해시 데이터 생성 (이니시스 웹표준 방식)
    // signature: oid, price, timestamp 해시
    const signature = sha256(`oid=${orderNo}&price=${finalPrice}&timestamp=${timestamp}`)
    // verification: oid, price, signKey, timestamp 해시 (위변조 검증용)
    const verification = sha256(`oid=${orderNo}&price=${finalPrice}&signKey=${signKey}&timestamp=${timestamp}`)
    // mKey: signKey 해시
    const mKey = sha256(signKey)

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
      verification,
      mKey,
      use_chkfake: 'Y',

      // URL 설정
      returnUrl: `${baseUrl}/api/shop/payment/inicis/return`,
      closeUrl: `${baseUrl}/api/shop/payment/inicis/close`,

      // 결제 방식
      gopaymethod: 'Card',
      payViewType: 'overlay',

      // 추가 옵션
      acceptmethod: 'below1000:centerCd(Y)',  // 1000원 미만 결제 허용, 결제창 가운데 표시
      quotabase: '2:3:4:5:6:7:8:9:10:11:12',  // 할부 개월 수

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
