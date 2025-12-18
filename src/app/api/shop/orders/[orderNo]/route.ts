import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import crypto from 'crypto'
import { createOrderCancelledNotification, createCancelRequestNotificationForAdmins } from '@/lib/notification'

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// 배송 전 상태인지 확인 (취소 시 전액 환불 대상)
function isBeforeShipping(status: string): boolean {
  return ['pending', 'paid', 'preparing'].includes(status)
}

// paymentInfo에서 tid 추출
function getPaymentTid(paymentInfo: string | null): string | null {
  if (!paymentInfo) return null
  try {
    const data = typeof paymentInfo === 'string' ? JSON.parse(paymentInfo) : paymentInfo
    return data.tid || null
  } catch {
    return null
  }
}

// 타임스탬프 생성 (YYYYMMDDhhmmss 형식)
function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

// 이니시스 결제 취소 함수 (v2 API)
async function cancelInicisPayment(tid: string, cancelReason: string, settings: Record<string, string>) {
  const testMode = settings.pg_test_mode !== 'false'
  const mid = testMode ? 'INIpayTest' : (settings.pg_mid || 'INIpayTest')
  const iniApiKey = testMode ? 'ItEQKi3rY7uvDS8l' : (settings.pg_apikey || '')

  if (!testMode && !iniApiKey) {
    return { success: false, message: 'PG API Key가 설정되지 않았습니다.' }
  }

  // AbortController로 타임아웃 설정 (10초)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const apiUrl = 'https://iniapi.inicis.com/v2/pg/refund'
    const timestamp = getTimestamp()
    const type = 'refund'
    const clientIp = '127.0.0.1'

    // data 객체 생성
    const data = {
      tid: tid,
      msg: cancelReason
    }

    // 해시 데이터 생성 (공식 샘플: key + mid + type + timestamp + JSON.stringify(data))
    const dataStr = JSON.stringify(data)
    const plainTxt = iniApiKey + mid + type + timestamp + dataStr
    const hashData = crypto.createHash('sha512').update(plainTxt).digest('hex')

    // 요청 파라미터
    const params = {
      mid: mid,
      type: type,
      timestamp: timestamp,
      clientIp: clientIp,
      data: data,
      hashData: hashData
    }

    console.log('이니시스 취소 요청:', { mid, tid, type, timestamp, testMode })

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const result = await response.json()
    console.log('이니시스 취소 응답:', result)

    if (result.resultCode === '00') {
      return { success: true, message: '결제 취소 성공', data: result }
    } else {
      return { success: false, message: result.resultMsg || '결제 취소 실패', data: result }
    }
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('이니시스 취소 API 타임아웃')
      return { success: false, message: '결제 취소 API 응답 시간 초과' }
    }

    console.error('이니시스 취소 API 호출 에러:', error)
    return { success: false, message: '결제 취소 API 호출 실패' }
  }
}

// 주문 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderNo } = await params

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: {
        items: {
          include: {
            product: {
              select: {
                slug: true,
                images: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인 주문만 조회 가능 (관리자 제외)
    if (order.userId !== session.id && session.role !== 'admin') {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 무통장입금인 경우 계좌정보 조회 (항상 표시)
    let bankInfo = null
    if (order.paymentMethod === 'bank') {
      const bankSetting = await prisma.shopSetting.findUnique({
        where: { key: 'bank_info' }
      })
      bankInfo = bankSetting?.value || null
    }

    // 카드결제 정보 파싱
    let cardInfo = null
    if (order.paymentMethod === 'card' && order.paymentInfo) {
      try {
        const paymentData = JSON.parse(order.paymentInfo)
        cardInfo = {
          cardName: paymentData.cardName || null,  // 카드사 코드
          cardNo: paymentData.cardNo || null,      // 카드 번호 (마스킹됨)
          applNum: paymentData.applNum || null,    // 승인번호
          cardQuota: paymentData.cardQuota || '00', // 할부 개월 (00=일시불)
          applDate: paymentData.applDate || null,  // 승인일자
          applTime: paymentData.applTime || null   // 승인시간
        }
      } catch {
        cardInfo = null
      }
    }

    // 이미지 처리
    const orderWithImages = {
      ...order,
      items: order.items.map(item => {
        const images = item.product?.images
        let firstImage = null
        if (images) {
          try {
            const parsed = JSON.parse(images)
            firstImage = Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : null
          } catch {
            firstImage = null
          }
        }
        return {
          ...item,
          productImage: firstImage,
          productSlug: item.product?.slug || null,
          product: undefined
        }
      })
    }

    return NextResponse.json({ order: orderWithImages, bankInfo, cardInfo })
  } catch (error) {
    console.error('주문 상세 조회 에러:', error)
    return NextResponse.json(
      { error: '주문을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 주문 취소/환불 요청
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orderNo: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { orderNo } = await params
    const body = await request.json()
    const { action, cancelReason } = body

    const order = await prisma.order.findUnique({
      where: { orderNo },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 본인 주문만 수정 가능
    if (order.userId !== session.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 취소 요청 (배송 전: 전액 환불)
    if (action === 'cancel') {
      // 취소 가능한 상태 확인 (배송 전까지만)
      if (!isBeforeShipping(order.status)) {
        return NextResponse.json(
          { error: '배송 전 상태에서만 취소할 수 있습니다. 배송 후에는 환불 요청을 이용해주세요.' },
          { status: 400 }
        )
      }

      if (!cancelReason) {
        return NextResponse.json(
          { error: '취소 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      // "준비중" 상태에서는 취소요청 상태로 변경 (관리자 승인 필요)
      if (order.status === 'preparing') {
        await prisma.order.update({
          where: { orderNo },
          data: {
            status: 'cancel_requested',
            cancelReason
          }
        })

        // 관리자에게 취소 요청 알림 발송 (비동기)
        createCancelRequestNotificationForAdmins(orderNo, order.ordererName, 'cancel')
          .catch(err => console.error('관리자 취소 요청 알림 발송 실패:', err))

        return NextResponse.json({
          success: true,
          message: '취소 요청이 접수되었습니다. 관리자 확인 후 처리됩니다.',
          needsApproval: true
        })
      }

      // 결제대기/결제완료 상태에서는 즉시 취소
      const settings = await getShopSettings()
      let pgCancelResult = null

      // 카드 결제인 경우 PG 승인 취소
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('카드 결제 취소 시도, tid:', tid)
        pgCancelResult = await cancelInicisPayment(tid, cancelReason, settings)
        console.log('PG 취소 결과:', pgCancelResult)

        // 실제 운영 모드에서 PG 취소 실패 시 에러 반환
        const testMode = settings.pg_test_mode !== 'false'
        if (!testMode && !pgCancelResult.success) {
          return NextResponse.json(
            { error: `카드 결제 취소 실패: ${pgCancelResult.message}` },
            { status: 400 }
          )
        }
      }

      // paymentInfo에 취소 정보 추가
      let updatedPaymentInfo = order.paymentInfo
      if (pgCancelResult) {
        try {
          const paymentData = order.paymentInfo ? JSON.parse(order.paymentInfo) : {}
          paymentData.cancelInfo = {
            cancelledAt: new Date().toISOString(),
            cancelReason: cancelReason,
            pgResult: pgCancelResult,
            cancelledBy: 'customer'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          updatedPaymentInfo = JSON.stringify({
            cancelInfo: {
              cancelledAt: new Date().toISOString(),
              cancelReason: cancelReason,
              pgResult: pgCancelResult,
              cancelledBy: 'customer'
            }
          })
        }
      }

      // 재고 복구 + 주문 취소
      await prisma.$transaction(async (tx) => {
        // 재고 복구
        for (const item of order.items) {
          if (item.optionId) {
            await tx.productOption.update({
              where: { id: item.optionId },
              data: {
                stock: { increment: item.quantity }
              }
            })
          }
          // 판매 수량 감소
          await tx.product.update({
            where: { id: item.productId },
            data: {
              soldCount: { decrement: item.quantity }
            }
          })
        }

        // 주문 상태 변경 (전액 환불)
        await tx.order.update({
          where: { orderNo },
          data: {
            status: 'cancelled',
            cancelReason,
            cancelledAt: new Date(),
            refundAmount: order.totalPrice,  // 전액 환불
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })
      })

      // 주문자에게 취소 완료 알림 발송 (비동기)
      createOrderCancelledNotification(order.userId, orderNo, order.totalPrice)
        .catch(err => console.error('주문자 취소 알림 발송 실패:', err))

      return NextResponse.json({
        success: true,
        message: order.paymentMethod === 'card'
          ? '주문이 취소되고 결제가 환불 처리되었습니다.'
          : '주문이 취소되었습니다.',
        refundAmount: order.totalPrice,
        pgCancelResult
      })
    }

    // 환불 요청 (배송 후: 반품 배송비 차감)
    if (action === 'refund_request') {
      // 환불 요청 가능한 상태 확인
      if (!['shipping', 'delivered'].includes(order.status)) {
        return NextResponse.json(
          { error: '배송중 또는 배송완료 상태에서만 환불 요청할 수 있습니다.' },
          { status: 400 }
        )
      }

      if (!cancelReason) {
        return NextResponse.json(
          { error: '환불 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 반품 배송비 조회
      const settings = await getShopSettings()
      const returnShippingFee = parseInt(settings.return_shipping_fee || '5000')

      // 환불 예정 금액 계산
      const refundAmount = Math.max(0, order.totalPrice - returnShippingFee)

      await prisma.order.update({
        where: { orderNo },
        data: {
          status: 'refund_requested',
          cancelReason,
          // 예상 환불 금액 저장 (관리자가 최종 확정)
          refundAmount
        }
      })

      // 관리자에게 환불 요청 알림 발송 (비동기)
      createCancelRequestNotificationForAdmins(orderNo, order.ordererName, 'refund')
        .catch(err => console.error('관리자 환불 요청 알림 발송 실패:', err))

      return NextResponse.json({
        success: true,
        message: '환불 요청이 접수되었습니다.',
        returnShippingFee,
        expectedRefundAmount: refundAmount
      })
    }

    // 구매 확정
    if (action === 'confirm') {
      if (order.status !== 'delivered') {
        return NextResponse.json(
          { error: '배송 완료된 주문만 구매 확정할 수 있습니다.' },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { orderNo },
        data: {
          status: 'confirmed'
        }
      })

      return NextResponse.json({
        success: true,
        message: '구매가 확정되었습니다.'
      })
    }

    return NextResponse.json(
      { error: '유효하지 않은 요청입니다.' },
      { status: 400 }
    )
  } catch (error) {
    console.error('주문 수정 에러:', error)
    return NextResponse.json(
      { error: '주문 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
