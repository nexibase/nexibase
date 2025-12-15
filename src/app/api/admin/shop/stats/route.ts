import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // 날짜 계산
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // 상품 통계
    const [totalProducts, activeProducts, soldOutProducts] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { isActive: true, isSoldOut: false } }),
      prisma.product.count({ where: { isSoldOut: true } }),
    ])

    // 주문 통계
    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      preparingOrders,
      shippingOrders,
      deliveredOrders,
      cancelledOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { status: 'paid' } }),
      prisma.order.count({ where: { status: 'preparing' } }),
      prisma.order.count({ where: { status: 'shipping' } }),
      prisma.order.count({ where: { status: 'delivered' } }),
      prisma.order.count({ where: { status: 'cancelled' } }),
    ])

    // 매출 통계 (취소 제외)
    const [todaySales, weekSales, monthSales] = await Promise.all([
      prisma.order.aggregate({
        _sum: { finalPrice: true },
        where: {
          createdAt: { gte: todayStart },
          status: { notIn: ['cancelled', 'refunded'] },
        },
      }),
      prisma.order.aggregate({
        _sum: { finalPrice: true },
        where: {
          createdAt: { gte: weekStart },
          status: { notIn: ['cancelled', 'refunded'] },
        },
      }),
      prisma.order.aggregate({
        _sum: { finalPrice: true },
        where: {
          createdAt: { gte: monthStart },
          status: { notIn: ['cancelled', 'refunded'] },
        },
      }),
    ])

    // 최근 주문 5건
    const recentOrders = await prisma.order.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json({
      products: {
        total: totalProducts,
        active: activeProducts,
        soldOut: soldOutProducts,
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        preparing: preparingOrders,
        shipping: shippingOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      sales: {
        today: todaySales._sum.finalPrice || 0,
        week: weekSales._sum.finalPrice || 0,
        month: monthSales._sum.finalPrice || 0,
      },
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        ordererName: order.ordererName,
        finalPrice: order.finalPrice,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
        itemCount: order._count.items,
      })),
    })
  } catch (error) {
    console.error('쇼핑몰 통계 조회 에러:', error)
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
