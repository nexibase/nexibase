import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { createOrderStatusNotification, createOrderCancelledByAdminNotification } from '@/lib/notification'
import crypto from 'crypto'

// 쇼핑몰 설정 가져오기
async function getShopSettings() {
  const settings = await prisma.shopSetting.findMany()
  const settingsMap: Record<string, string> = {}
  settings.forEach(s => {
    settingsMap[s.key] = s.value
  })
  return settingsMap
}

// 배송 전 상태인지 확인
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

// 이니시스 결제 취소 (v2 API 직접 호출)
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

    console.log('이니시스 취소 요청 (관리자):', { mid, tid, type, timestamp, testMode })

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

// 주문 상세 조회 (ID 또는 주문번호로 조회 가능)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params

    // 순수 숫자이고 8자리 이하면 ID, 그 외에는 주문번호로 판단
    const isId = /^\d+$/.test(id) && id.length <= 8

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id },
      include: {
        user: {
          select: { id: true, nickname: true, email: true }
        },
        items: {
          include: {
            product: {
              select: { slug: true, images: true }
            }
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

    // 무통장입금인 경우 계좌정보 조회
    let bankInfo = null
    if (order.paymentMethod === 'bank' && order.status === 'pending') {
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
          applTime: paymentData.applTime || null,   // 승인시간
          tid: paymentData.tid || null             // 거래번호
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

// 주문 상태 변경 (ID 또는 주문번호로 조회 가능)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const isId = /^\d+$/.test(id) && id.length <= 8
    const body = await request.json()
    const {
      action,
      status,
      trackingCompany,
      trackingNumber,
      adminMemo,
      refundAmount,
    } = body

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 취소 요청 승인
    if (action === 'cancel_approve') {
      if (order.status !== 'cancel_requested') {
        return NextResponse.json(
          { error: '취소 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      const settings = await getShopSettings()
      let pgCancelResult = null

      // 카드 결제인 경우 PG 승인 취소
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('카드 결제 취소 시도 (관리자 승인), tid:', tid)
        pgCancelResult = await cancelInicisPayment(tid, order.cancelReason || '주문 취소', settings)
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
            cancelReason: order.cancelReason || '주문 취소',
            pgResult: pgCancelResult,
            cancelledBy: 'admin'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          // 파싱 실패 시 새로운 객체 생성
          updatedPaymentInfo = JSON.stringify({
            cancelInfo: {
              cancelledAt: new Date().toISOString(),
              cancelReason: order.cancelReason || '주문 취소',
              pgResult: pgCancelResult,
              cancelledBy: 'admin'
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
          where: { id: order.id },
          data: {
            status: 'cancelled',
            cancelledAt: new Date(),
            refundAmount: order.totalPrice,
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })
      })

      // 알림 생성
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, order.status, 'cancelled')
      }

      return NextResponse.json({
        success: true,
        message: '취소 요청이 승인되었습니다.',
        pgCancelResult
      })
    }

    // 취소 요청 거절 (배송중으로 변경)
    if (action === 'cancel_reject') {
      if (order.status !== 'cancel_requested') {
        return NextResponse.json(
          { error: '취소 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'shipping',
          shippedAt: new Date(),
          cancelReason: null  // 취소 사유 제거
        }
      })

      // 알림 생성 (취소 거절 -> 배송중)
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, order.status, 'shipping')
      }

      return NextResponse.json({
        success: true,
        message: '취소 요청이 거절되고 배송중으로 변경되었습니다.'
      })
    }

    // 환불 요청 승인
    if (action === 'refund_approve') {
      if (order.status !== 'refund_requested') {
        return NextResponse.json(
          { error: '환불 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      const settings = await getShopSettings()
      let pgCancelResult = null

      // 카드 결제인 경우 PG 환불 처리
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('카드 환불 처리 시도 (관리자 승인), tid:', tid)
        pgCancelResult = await cancelInicisPayment(tid, order.cancelReason || '환불 처리', settings)
        console.log('PG 환불 결과:', pgCancelResult)

        // 실제 운영 모드에서 PG 취소 실패 시 에러 반환
        const testMode = settings.pg_test_mode !== 'false'
        if (!testMode && !pgCancelResult.success) {
          return NextResponse.json(
            { error: `카드 결제 환불 실패: ${pgCancelResult.message}` },
            { status: 400 }
          )
        }
      }

      // paymentInfo에 환불 정보 추가
      let updatedPaymentInfo = order.paymentInfo
      if (pgCancelResult) {
        try {
          const paymentData = order.paymentInfo ? JSON.parse(order.paymentInfo) : {}
          paymentData.refundInfo = {
            refundedAt: new Date().toISOString(),
            refundReason: order.cancelReason || '환불 처리',
            refundAmount: order.refundAmount,
            pgResult: pgCancelResult,
            refundedBy: 'admin'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          updatedPaymentInfo = JSON.stringify({
            refundInfo: {
              refundedAt: new Date().toISOString(),
              refundReason: order.cancelReason || '환불 처리',
              refundAmount: order.refundAmount,
              pgResult: pgCancelResult,
              refundedBy: 'admin'
            }
          })
        }
      }

      // 재고 복구 + 환불 처리
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
          await tx.product.update({
            where: { id: item.productId },
            data: {
              soldCount: { decrement: item.quantity }
            }
          })
        }

        // 주문 상태 변경 (환불 완료)
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'refunded',
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })
      })

      // 알림 생성
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, order.status, 'refunded')
      }

      return NextResponse.json({
        success: true,
        message: '환불 요청이 승인되었습니다.',
        refundAmount: order.refundAmount,
        pgCancelResult
      })
    }

    // 환불 요청 거절
    if (action === 'refund_reject') {
      if (order.status !== 'refund_requested') {
        return NextResponse.json(
          { error: '환불 요청 상태가 아닙니다.' },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'delivered',  // 배송완료로 복원
          cancelReason: null,
          refundAmount: null
        }
      })

      return NextResponse.json({
        success: true,
        message: '환불 요청이 거절되었습니다.'
      })
    }

    // 관리자 주문 취소 (피치 못할 사정으로 인한 취소)
    if (action === 'admin_cancel') {
      const cancelReason = body.cancelReason

      if (!cancelReason) {
        return NextResponse.json(
          { error: '취소 사유를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 이미 취소/환불된 주문은 취소 불가
      if (['cancelled', 'refunded'].includes(order.status)) {
        return NextResponse.json(
          { error: '이미 취소 또는 환불된 주문입니다.' },
          { status: 400 }
        )
      }

      const settings = await getShopSettings()
      let pgCancelResult = null

      // 카드 결제인 경우 PG 승인 취소
      const tid = getPaymentTid(order.paymentInfo)
      if (order.paymentMethod === 'card' && tid) {
        console.log('관리자 주문 취소 - 카드 결제 취소 시도, tid:', tid)
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
            cancelledBy: 'admin'
          }
          updatedPaymentInfo = JSON.stringify(paymentData)
        } catch {
          updatedPaymentInfo = JSON.stringify({
            cancelInfo: {
              cancelledAt: new Date().toISOString(),
              cancelReason: cancelReason,
              pgResult: pgCancelResult,
              cancelledBy: 'admin'
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
          where: { id: order.id },
          data: {
            status: 'cancelled',
            cancelReason,
            cancelledAt: new Date(),
            refundAmount: order.totalPrice,
            refundedAt: new Date(),
            paymentInfo: updatedPaymentInfo
          }
        })
      })

      // 고객에게 관리자 취소 알림 발송 (취소 사유 포함)
      if (order.userId) {
        createOrderCancelledByAdminNotification(order.userId, order.orderNo, order.totalPrice, cancelReason)
          .catch(err => console.error('고객 취소 알림 발송 실패:', err))
      }

      return NextResponse.json({
        success: true,
        message: '주문이 취소되었습니다.',
        pgCancelResult
      })
    }

    // 무통장입금 입금확인
    if (action === 'confirm_payment') {
      if (order.paymentMethod !== 'bank') {
        return NextResponse.json(
          { error: '무통장입금 주문만 입금확인이 가능합니다.' },
          { status: 400 }
        )
      }

      if (order.status !== 'pending') {
        return NextResponse.json(
          { error: '결제대기 상태에서만 입금확인이 가능합니다.' },
          { status: 400 }
        )
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: new Date()
        }
      })

      // 고객에게 결제 완료 알림 발송
      if (order.userId) {
        await createOrderStatusNotification(order.userId, order.orderNo, 'pending', 'paid')
      }

      return NextResponse.json({
        success: true,
        message: '입금이 확인되었습니다.'
      })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // 상태 변경
    if (status && status !== order.status) {
      updateData.status = status

      // 상태별 추가 처리
      switch (status) {
        case 'paid':
          updateData.paidAt = new Date()
          break
        case 'shipping':
          updateData.shippedAt = new Date()
          if (trackingCompany) updateData.trackingCompany = trackingCompany
          if (trackingNumber) updateData.trackingNumber = trackingNumber
          break
        case 'delivered':
          updateData.deliveredAt = new Date()
          break
        case 'cancelled':
          updateData.cancelledAt = new Date()

          // 배송 전 취소: 전액 환불
          if (isBeforeShipping(order.status)) {
            updateData.refundAmount = order.totalPrice
            updateData.refundedAt = new Date()

            // 카드 결제인 경우 자동 취소
            const tid = getPaymentTid(order.paymentInfo)
            if (order.paymentMethod === 'card' && tid) {
              const settings = await getShopSettings()
              const cancelResult = await cancelInicisPayment(
                tid,
                body.cancelReason || '관리자에 의한 취소',
                settings
              )
              console.log('관리자 카드 취소 결과:', cancelResult)
            }
          } else {
            // 배송 후 취소: 반품 배송비 차감
            const settings = await getShopSettings()
            const returnShippingFee = parseInt(settings.return_shipping_fee || '5000')
            const calculatedRefund = Math.max(0, order.totalPrice - returnShippingFee)
            updateData.refundAmount = refundAmount || calculatedRefund
          }

          // 재고 복구
          await restoreStock(order.items)
          break
        case 'refunded':
          updateData.refundedAt = new Date()

          // 환불 금액 계산
          if (refundAmount) {
            updateData.refundAmount = refundAmount
          } else if (!order.refundAmount) {
            // 환불 금액이 없으면 반품 배송비 차감 후 계산
            const settings = await getShopSettings()
            const returnShippingFee = parseInt(settings.return_shipping_fee || '5000')
            updateData.refundAmount = Math.max(0, order.totalPrice - returnShippingFee)
          }

          // 카드 결제인 경우 환불 처리
          const refundTid = getPaymentTid(order.paymentInfo)
          if (order.paymentMethod === 'card' && refundTid) {
            const settings = await getShopSettings()
            const cancelResult = await cancelInicisPayment(
              refundTid,
              body.cancelReason || '관리자에 의한 환불',
              settings
            )
            console.log('관리자 카드 환불 결과:', cancelResult)
          }

          // 재고 복구 (아직 복구 안된 경우)
          if (!['cancelled', 'refunded'].includes(order.status)) {
            await restoreStock(order.items)
          }
          break
      }
    }

    // 배송 정보 업데이트
    if (trackingCompany !== undefined) updateData.trackingCompany = trackingCompany
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber

    // 관리자 메모
    if (adminMemo !== undefined) updateData.adminMemo = adminMemo

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: updateData
    })

    // 상태 변경 시 알림 생성
    if (status && status !== order.status && order.userId) {
      await createOrderStatusNotification(order.userId, order.orderNo, order.status, status)
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder
    })
  } catch (error) {
    console.error('주문 상태 변경 에러:', error)
    return NextResponse.json(
      { error: '주문 상태 변경 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 재고 복구 함수
async function restoreStock(items: { productId: number; optionId: number | null; quantity: number }[]) {
  for (const item of items) {
    if (item.optionId) {
      await prisma.productOption.update({
        where: { id: item.optionId },
        data: {
          stock: { increment: item.quantity }
        }
      })
    }
    await prisma.product.update({
      where: { id: item.productId },
      data: {
        soldCount: { decrement: item.quantity }
      }
    })
  }
}

// 주문 삭제 (소프트 삭제) - ID 또는 주문번호로 조회 가능
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const isId = /^\d+$/.test(id) && id.length <= 8

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id },
      include: { items: true }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 이미 삭제된 주문인지 확인
    if (order.deletedAt) {
      return NextResponse.json(
        { error: '이미 삭제된 주문입니다.' },
        { status: 400 }
      )
    }

    // 결제 완료 상태에서는 삭제 불가 (환불/취소 후 삭제 가능)
    if (['paid', 'preparing', 'shipping', 'delivered'].includes(order.status)) {
      return NextResponse.json(
        { error: '결제 완료된 주문은 취소/환불 처리 후 삭제할 수 있습니다.' },
        { status: 400 }
      )
    }

    // pending 상태에서 삭제 시 재고 복구 (결제 전이지만 재고가 차감되어 있는 경우)
    // cancelled/refunded 상태는 이미 재고 복구가 되어 있으므로 제외
    if (order.status === 'pending') {
      await restoreStock(order.items)
    }

    // 소프트 삭제 (deletedAt 설정)
    await prisma.order.update({
      where: { id: order.id },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({
      success: true,
      message: '주문이 삭제되었습니다.'
    })
  } catch (error) {
    console.error('주문 삭제 에러:', error)
    return NextResponse.json(
      { error: '주문 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 주문 복원 - ID 또는 주문번호로 조회 가능
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const isId = /^\d+$/.test(id) && id.length <= 8
    const body = await request.json()
    const { action } = body

    if (action !== 'restore') {
      return NextResponse.json(
        { error: '지원하지 않는 작업입니다.' },
        { status: 400 }
      )
    }

    const order = await prisma.order.findUnique({
      where: isId ? { id: parseInt(id) } : { orderNo: id }
    })

    if (!order) {
      return NextResponse.json(
        { error: '주문을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 삭제되지 않은 주문인지 확인
    if (!order.deletedAt) {
      return NextResponse.json(
        { error: '삭제되지 않은 주문입니다.' },
        { status: 400 }
      )
    }

    // 복원 (deletedAt을 null로 설정)
    await prisma.order.update({
      where: { id: order.id },
      data: { deletedAt: null }
    })

    return NextResponse.json({
      success: true,
      message: '주문이 복원되었습니다.'
    })
  } catch (error) {
    console.error('주문 복원 에러:', error)
    return NextResponse.json(
      { error: '주문 복원 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
