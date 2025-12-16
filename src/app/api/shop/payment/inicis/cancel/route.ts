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
    const { orderNo, cancelReason } = body

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

    // 테스트 모드에서는 외부 API 호출 없이 바로 성공 처리
    if (testMode) {
      console.log('테스트 모드: 실제 PG 취소 API 호출 생략, tid:', tid)
      return NextResponse.json({
        success: true,
        message: '테스트 모드 - 취소 처리 완료',
        needsPGCancel: false,
        cancelResult: {
          success: true,
          message: '테스트 모드 - PG 취소 API 호출 생략',
          data: null
        }
      })
    }

    // 실제 운영 모드에서만 이니시스 API 호출
    const mid = settings.pg_mid || 'INIpayTest'
    const iniApiKey = settings.pg_apikey || ''

    if (!iniApiKey) {
      return NextResponse.json({
        success: false,
        error: 'PG API Key가 설정되지 않았습니다.',
        needsPGCancel: false
      }, { status: 400 })
    }

    // 이니시스 취소 API 호출
    const cancelResult = await cancelInicisPayment({
      mid,
      iniApiKey,
      tid,
      cancelReason: cancelReason || '고객 요청에 의한 취소'
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

// 이니시스 결제 취소 함수 (v2 API - 공식 샘플 기준)
async function cancelInicisPayment({
  mid,
  iniApiKey,
  tid,
  cancelReason
}: {
  mid: string
  iniApiKey: string
  tid: string
  cancelReason: string
}) {
  // AbortController로 타임아웃 설정 (10초)
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    // 이니시스 취소 API URL (v2)
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

    console.log('이니시스 취소 요청:', { mid, tid, type, timestamp })
    console.log('PLAINTXT:', plainTxt)
    console.log('HASHDATA:', hashData)
    console.log('REQUEST:', JSON.stringify(params))

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

    // 이니시스 응답 코드 확인
    // resultCode가 '00'이면 성공
    if (result.resultCode === '00') {
      return {
        success: true,
        message: '결제 취소 성공',
        data: result
      }
    } else {
      return {
        success: false,
        message: result.resultMsg || '결제 취소 실패',
        data: result
      }
    }
  } catch (error) {
    clearTimeout(timeoutId)

    // 타임아웃 에러 처리
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('이니시스 취소 API 타임아웃')
      return {
        success: false,
        message: '결제 취소 API 응답 시간 초과',
        error: 'TIMEOUT'
      }
    }

    console.error('이니시스 취소 API 호출 에러:', error)
    return {
      success: false,
      message: '결제 취소 API 호출 실패',
      error
    }
  }
}
