import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 주문 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
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
      paymentMethod,
    } = body

    // 필수 필드 검증
    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: '주문 상품이 없습니다.' },
        { status: 400 }
      )
    }

    if (!ordererName || !ordererPhone) {
      return NextResponse.json(
        { error: '주문자 정보를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!recipientName || !recipientPhone || !zipCode || !address) {
      return NextResponse.json(
        { error: '배송지 정보를 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!paymentMethod || !['bank', 'card'].includes(paymentMethod)) {
      return NextResponse.json(
        { error: '결제 방법을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 상품 및 옵션 유효성 검증 + 재고 확인
    let totalPrice = 0
    const orderItems: {
      productId: number
      optionId: number | null
      productName: string
      optionText: string
      price: number
      quantity: number
      subtotal: number
    }[] = []

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          options: item.optionId ? {
            where: { id: item.optionId }
          } : undefined
        }
      })

      if (!product || !product.isActive) {
        return NextResponse.json(
          { error: `상품을 찾을 수 없습니다: ${item.productName}` },
          { status: 400 }
        )
      }

      if (product.isSoldOut) {
        return NextResponse.json(
          { error: `품절된 상품입니다: ${product.name}` },
          { status: 400 }
        )
      }

      let price = product.price
      let optionText = ''

      // 옵션이 있는 경우
      if (item.optionId) {
        const option = product.options?.[0]
        if (!option || !option.isActive) {
          return NextResponse.json(
            { error: `옵션을 찾을 수 없습니다: ${item.productName}` },
            { status: 400 }
          )
        }

        if (option.stock < item.quantity) {
          return NextResponse.json(
            { error: `재고가 부족합니다: ${product.name} (재고: ${option.stock})` },
            { status: 400 }
          )
        }

        price = option.price
        const optionParts = []
        if (option.option1) optionParts.push(option.option1)
        if (option.option2) optionParts.push(option.option2)
        if (option.option3) optionParts.push(option.option3)
        optionText = optionParts.join(' / ')
      }

      const subtotal = price * item.quantity
      totalPrice += subtotal

      orderItems.push({
        productId: product.id,
        optionId: item.optionId || null,
        productName: product.name,
        optionText,
        price,
        quantity: item.quantity,
        subtotal,
      })
    }

    // 배송비 계산
    const deliveryFeeResult = await calculateDeliveryFee(zipCode, totalPrice)
    const deliveryFee = deliveryFeeResult.fee
    const finalPrice = totalPrice + deliveryFee

    // 주문번호 생성
    const orderNo = generateOrderNo()

    // 트랜잭션으로 주문 생성 + 재고 차감
    const order = await prisma.$transaction(async (tx) => {
      // 주문 생성
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          userId: session.id,
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
          status: 'pending',
          paymentMethod,
          items: {
            create: orderItems.map(item => ({
              productId: item.productId,
              optionId: item.optionId,
              productName: item.productName,
              optionText: item.optionText,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal,
            }))
          }
        },
        include: {
          items: true
        }
      })

      // 재고 차감
      for (const item of orderItems) {
        if (item.optionId) {
          await tx.productOption.update({
            where: { id: item.optionId },
            data: {
              stock: { decrement: item.quantity }
            }
          })
        }
        // 판매 수량 증가
        await tx.product.update({
          where: { id: item.productId },
          data: {
            soldCount: { increment: item.quantity }
          }
        })
      }

      return newOrder
    })

    return NextResponse.json({
      success: true,
      order: {
        orderNo: order.orderNo,
        totalPrice: order.totalPrice,
        deliveryFee: order.deliveryFee,
        finalPrice: order.finalPrice,
        paymentMethod: order.paymentMethod,
        status: order.status,
      }
    })
  } catch (error) {
    console.error('주문 생성 에러:', error)
    return NextResponse.json(
      { error: '주문 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 내 주문 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status') || ''

    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: session.id
    }

    if (status) {
      where.status = status
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  images: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({ where })
    ])

    // 이미지 처리
    const ordersWithImages = orders.map(order => ({
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
          product: undefined
        }
      })
    }))

    return NextResponse.json({
      orders: ordersWithImages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('주문 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '주문 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 주문번호 생성 (YYMMDDHHMMSS-mmmXX = 18자리)
function generateOrderNo(): string {
  const now = new Date()
  const yy = String(now.getFullYear()).slice(-2)
  const MM = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  const rand = String(Math.floor(Math.random() * 100)).padStart(2, '0')

  return `${yy}${MM}${dd}${hh}${mm}${ss}-${ms}${rand}`
}

// 배송비 계산
async function calculateDeliveryFee(zipCode: string, totalPrice: number): Promise<{ fee: number; policyName: string }> {
  const policies = await prisma.deliveryFee.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' }
  })

  if (policies.length === 0) {
    return { fee: 0, policyName: '무료배송' }
  }

  const zipNum = parseInt(zipCode)

  // 지역별 정책 매칭
  for (const policy of policies) {
    if (policy.isDefault) continue

    try {
      const regions = JSON.parse(policy.regions || '[]') as string[]
      for (const region of regions) {
        if (region.includes('-')) {
          const [start, end] = region.split('-').map(r => parseInt(r.trim()))
          if (zipNum >= start && zipNum <= end) {
            // 무료배송 조건 확인
            if (policy.freeAmount && totalPrice >= policy.freeAmount) {
              return { fee: 0, policyName: `${policy.name} (무료배송)` }
            }
            return { fee: policy.fee, policyName: policy.name }
          }
        } else if (zipCode.startsWith(region.trim())) {
          if (policy.freeAmount && totalPrice >= policy.freeAmount) {
            return { fee: 0, policyName: `${policy.name} (무료배송)` }
          }
          return { fee: policy.fee, policyName: policy.name }
        }
      }
    } catch {
      continue
    }
  }

  // 기본 정책 적용
  const defaultPolicy = policies.find(p => p.isDefault)
  if (defaultPolicy) {
    if (defaultPolicy.freeAmount && totalPrice >= defaultPolicy.freeAmount) {
      return { fee: 0, policyName: `${defaultPolicy.name} (무료배송)` }
    }
    return { fee: defaultPolicy.fee, policyName: defaultPolicy.name }
  }

  return { fee: 0, policyName: '무료배송' }
}
