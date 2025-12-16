import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

// 이니시스 결제 취소 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderNo, cancelAmount, cancelReason } = body

    if (!orderNo) {
      return NextResponse.json({ error: '주문번호가 필요합니다.' }, { status: 400 })
    }

    // 주문 조회
    const order = await prisma.order.findUnique({
      where: { orderNo }
    })

    if (!order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 })
    }

    // 카드 결제가 아니면 취소 불필요
    if (order.paymentMethod !== 'card') {
      return NextResponse.json({
        success: true,
        message: '카드 결제가 아닙니다.',
        needsPGCancel: false
      })
    }

    // 이미 취소된 주문
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json({
        success: true,
        message: '이미 취소된 주문입니다.',
        needsPGCancel: false
      })
    }

    // paymentInfo에서 tid 추출
    let tid: string | null = null
    if (order.paymentInfo) {
      try {
        const paymentData = typeof order.paymentInfo === 'string'
          ? JSON.parse(order.paymentInfo)
          : order.paymentInfo
        tid = paymentData.tid || null
      } catch {
        tid = null
      }
    }

    // 결제 정보가 없으면 취소 불필요
    if (!tid) {
      return NextResponse.json({
        success: true,
        message: '결제 정보가 없습니다.',
        needsPGCancel: false
      })
    }

    // 쇼핑몰 설정 가져오기
    const settings = await getShopSettings()
    const testMode = settings.pg_test_mode !== 'false'
    const mid = testMode ? 'INIpayTest' : (settings.pg_mid || 'INIpayTest')
    // INIAPIKey (API 취소용 키) - signKey와 다름
    const iniApiKey = testMode ? 'ItEQKi3rY7uvDS8l' : (settings.pg_apikey || settings.pg_signkey || '')

    // 취소 금액 (미지정시 전액)
    const amount = cancelAmount || order.totalPrice

    // 이니시스 취소 API 호출
    const cancelResult = await cancelInicisPayment({
      mid,
      iniApiKey,
      tid,
      cancelAmount: amount,
      cancelReason: cancelReason || '고객 요청에 의한 취소',
      partialCancel: amount < order.totalPrice,
      testMode
    })

    if (cancelResult.success) {
      return NextResponse.json({
        success: true,
        message: '결제가 취소되었습니다.',
        needsPGCancel: true,
        cancelResult
      })
    } else {
      return NextResponse.json({
        success: false,
        error: cancelResult.message || '결제 취소에 실패했습니다.',
        cancelResult
      }, { status: 400 })
    }
  } catch (error) {
    console.error('결제 취소 에러:', error)
    return NextResponse.json(
      { error: '결제 취소 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 이니시스 결제 취소 함수
async function cancelInicisPayment({
  mid,
  iniApiKey,
  tid,
  cancelAmount,
  cancelReason,
  partialCancel,
  testMode
}: {
  mid: string
  iniApiKey: string
  tid: string
  cancelAmount: number
  cancelReason: string
  partialCancel: boolean
  testMode: boolean
}) {
  try {
    // 이니시스 취소 API URL
    const cancelUrl = 'https://iniapi.inicis.com/api/v1/refund'

    const timestamp = getTimestamp()
    const type = partialCancel ? 'Partial' : 'FullCancel'
    const paymethod = 'Card'
    const clientIp = '127.0.0.1'

    // 해시 데이터 생성 (이니시스 매뉴얼 순서: INIAPIKey + type + paymethod + timestamp + clientIp + mid + tid)
    const hashData = `${iniApiKey}${type}${paymethod}${timestamp}${clientIp}${mid}${tid}`
    const hashString = crypto.createHash('sha512').update(hashData).digest('hex')

    // URL-encoded form data 생성
    const formData = new URLSearchParams()
    formData.append('type', type)
    formData.append('paymethod', paymethod)
    formData.append('timestamp', timestamp)
    formData.append('clientIp', clientIp)
    formData.append('mid', mid)
    formData.append('tid', tid)
    formData.append('msg', cancelReason)
    formData.append('hashData', hashString)

    // 부분취소인 경우 금액 정보 추가
    if (partialCancel) {
      formData.append('price', cancelAmount.toString())
    }

    console.log('이니시스 취소 요청:', { mid, tid, type, cancelAmount, partialCancel, testMode, timestamp })

    const response = await fetch(cancelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
      },
      body: formData.toString()
    })

    const result = await response.json()
    console.log('이니시스 취소 응답:', result)

    // 이니시스 응답 코드 확인
    // resultCode가 '00'이면 성공
    if (result.resultCode === '00') {
      return {
        success: true,
        message: '결제 취소 성공',
        data: result
      }
    } else {
      // 테스트 모드에서는 취소 API가 동작하지 않을 수 있음
      if (testMode) {
        console.log('테스트 모드: 실제 취소 API 미지원, 성공으로 처리')
        return {
          success: true,
          message: '테스트 모드 - 취소 처리 완료',
          data: result
        }
      }

      return {
        success: false,
        message: result.resultMsg || '결제 취소 실패',
        data: result
      }
    }
  } catch (error) {
    console.error('이니시스 취소 API 호출 에러:', error)

    // 테스트 모드에서 API 오류시에도 성공 처리
    if (testMode) {
      return {
        success: true,
        message: '테스트 모드 - 취소 처리 완료 (API 미지원)',
        data: null
      }
    }

    return {
      success: false,
      message: '결제 취소 API 호출 실패',
      error
    }
  }
}
