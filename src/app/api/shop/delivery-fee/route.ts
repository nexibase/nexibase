import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 배송비 계산 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { zipCode, totalAmount, totalPrice } = body
    const amount = totalAmount || totalPrice || 0  // 둘 다 지원

    if (!zipCode) {
      return NextResponse.json({ error: '우편번호가 필요합니다.' }, { status: 400 })
    }

    // 모든 활성화된 배송비 정책 조회
    const deliveryFees = await prisma.deliveryFee.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]
    })

    if (deliveryFees.length === 0) {
      return NextResponse.json({
        success: true,
        fee: 0,
        policyName: '무료배송',
        message: '배송비 정책이 설정되지 않았습니다.'
      })
    }

    // 우편번호로 지역 매칭
    const zipNum = parseInt(zipCode.replace(/\D/g, ''))
    let matchedPolicy = null

    for (const policy of deliveryFees) {
      const regions: string[] = policy.regions ? JSON.parse(policy.regions) : []

      // 기본 배송비는 건너뜀 (나중에 폴백으로 사용)
      if (policy.isDefault || regions.length === 0) continue

      // 우편번호 범위 체크
      for (const region of regions) {
        if (region.includes('-')) {
          // 범위: 63000-63644
          const [start, end] = region.split('-').map(r => parseInt(r.trim()))
          if (zipNum >= start && zipNum <= end) {
            matchedPolicy = policy
            break
          }
        } else {
          // 단일 우편번호
          const single = parseInt(region.trim())
          if (zipNum === single || zipCode.startsWith(region.trim())) {
            matchedPolicy = policy
            break
          }
        }
      }

      if (matchedPolicy) break
    }

    // 매칭된 정책이 없으면 기본 배송비 사용
    if (!matchedPolicy) {
      // isDefault가 true인 정책 우선, 없으면 regions가 비어있는 정책 사용
      matchedPolicy = deliveryFees.find(p => p.isDefault)
        || deliveryFees.find(p => !p.regions || JSON.parse(p.regions).length === 0)
        || deliveryFees[deliveryFees.length - 1]  // 마지막 정책 (sortOrder가 가장 큰)
    }

    // 무료배송 체크
    let fee = matchedPolicy.fee
    let isFreeShipping = false

    if (matchedPolicy.freeAmount && amount >= matchedPolicy.freeAmount) {
      fee = 0
      isFreeShipping = true
    }

    return NextResponse.json({
      success: true,
      fee,
      policyName: matchedPolicy.name,
      originalFee: matchedPolicy.fee,
      isFreeShipping,
      freeShippingAmount: matchedPolicy.freeAmount,
      message: isFreeShipping
        ? `${matchedPolicy.freeAmount?.toLocaleString()}원 이상 구매로 무료배송`
        : matchedPolicy.freeAmount
          ? `${matchedPolicy.freeAmount.toLocaleString()}원 이상 구매 시 무료배송`
          : null
    })
  } catch (error) {
    console.error('배송비 계산 에러:', error)
    return NextResponse.json({ error: '배송비 계산 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
