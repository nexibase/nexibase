import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 리뷰 작성 가능한 주문 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ orders: [] })
    }

    const { slug } = await params

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ orders: [] })
    }

    // 배송완료/구매확정 된 주문 중 아직 리뷰를 작성하지 않은 주문 찾기
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId: product.id,
        order: {
          userId: session.id,
          status: { in: ['delivered', 'confirmed'] },
          deletedAt: null
        }
      },
      include: {
        order: {
          select: { id: true, orderNo: true }
        }
      }
    })

    // 이미 리뷰가 작성된 orderItemId 조회
    const existingReviews = await prisma.productReview.findMany({
      where: {
        orderItemId: { in: orderItems.map(item => item.id) }
      },
      select: { orderItemId: true }
    })

    const reviewedItemIds = new Set(existingReviews.map(r => r.orderItemId))

    // 리뷰 미작성 주문만 필터링
    const reviewableOrders = orderItems
      .filter(item => !reviewedItemIds.has(item.id))
      .map(item => ({
        orderId: item.order.id,
        orderItemId: item.id,
        productName: item.productName,
        optionText: item.optionText,
        orderNo: item.order.orderNo
      }))

    return NextResponse.json({ orders: reviewableOrders })
  } catch (error) {
    console.error('리뷰 가능 주문 조회 에러:', error)
    return NextResponse.json({ orders: [] })
  }
}
