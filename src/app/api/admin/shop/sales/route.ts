import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 매출 관리 API - 구매확정/배송완료 주문 조회 및 통계
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const tab = searchParams.get('tab') || 'summary' // summary, orders, settlement
    const period = searchParams.get('period') || 'month' // today, week, month, year, custom
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search') || ''

    // 기간 필터 계산
    const now = new Date()
    let dateFrom: Date
    let dateTo: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

    switch (period) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
        break
      case 'yesterday':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0)
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999)
        break
      case 'week':
        dateFrom = new Date(now)
        dateFrom.setDate(now.getDate() - 7)
        dateFrom.setHours(0, 0, 0, 0)
        break
      case 'prev_week':
        // 이전 주 (지난주 월요일 ~ 일요일)
        const dayOfWeek = now.getDay() // 0=일, 1=월, ...
        const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToLastSunday, 23, 59, 59, 999)
        dateFrom = new Date(dateTo.getFullYear(), dateTo.getMonth(), dateTo.getDate() - 6, 0, 0, 0, 0)
        break
      case 'month':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'prev_month':
        // 이전 달 (전월 1일 ~ 말일)
        dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0)
        dateTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999) // 이번달 0일 = 전월 말일
        break
      case 'year':
        dateFrom = new Date(now.getFullYear(), 0, 1)
        break
      case 'custom':
        if (startDate && endDate) {
          dateFrom = new Date(startDate)
          dateFrom.setHours(0, 0, 0, 0)
          dateTo = new Date(endDate)
          dateTo.setHours(23, 59, 59, 999)
        } else {
          dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
        }
        break
      default:
        dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    }

    // 매출 대상: 배송완료(delivered) + 구매확정(confirmed)
    const salesStatuses = ['delivered', 'confirmed']

    // 기본 조건
    const baseWhere = {
      status: { in: salesStatuses },
      deletedAt: null,
      paidAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    }

    if (tab === 'summary') {
      // 요약 통계
      const [
        totalSales,
        orderCount,
        cancelledCount,
        refundedAmount,
        dailySales,
        topProducts,
      ] = await Promise.all([
        // 총 매출
        prisma.order.aggregate({
          where: baseWhere,
          _sum: { finalPrice: true },
        }),
        // 주문 건수
        prisma.order.count({ where: baseWhere }),
        // 취소/환불 건수 (같은 기간)
        prisma.order.count({
          where: {
            status: { in: ['cancelled', 'refunded'] },
            deletedAt: null,
            updatedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
        }),
        // 환불 금액
        prisma.order.aggregate({
          where: {
            status: 'refunded',
            deletedAt: null,
            refundedAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          },
          _sum: { refundAmount: true },
        }),
        // 일별 매출 (최근 30일)
        prisma.$queryRaw<{ date: string; amount: number; count: number }[]>`
          SELECT
            DATE(paidAt) as date,
            SUM(finalPrice) as amount,
            COUNT(*) as count
          FROM orders
          WHERE status IN ('delivered', 'confirmed')
            AND deletedAt IS NULL
            AND paidAt >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY DATE(paidAt)
          ORDER BY date DESC
        `,
        // 인기 상품 (판매량 기준 상위 10개)
        prisma.$queryRaw<{ productId: number; productName: string; productSlug: string; productImages: string | null; totalQty: number; totalAmount: number }[]>`
          SELECT
            oi.productId,
            oi.productName,
            p.slug as productSlug,
            p.images as productImages,
            SUM(oi.quantity) as totalQty,
            SUM(oi.subtotal) as totalAmount
          FROM order_items oi
          JOIN orders o ON oi.orderId = o.id
          LEFT JOIN products p ON oi.productId = p.id
          WHERE o.status IN ('delivered', 'confirmed')
            AND o.deletedAt IS NULL
            AND o.paidAt >= ${dateFrom}
            AND o.paidAt <= ${dateTo}
          GROUP BY oi.productId, oi.productName, p.slug, p.images
          ORDER BY totalQty DESC
          LIMIT 10
        `,
      ])

      // 전월 대비 계산
      const prevMonthStart = new Date(dateFrom)
      prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)
      const prevMonthEnd = new Date(dateFrom)
      prevMonthEnd.setDate(prevMonthEnd.getDate() - 1)
      prevMonthEnd.setHours(23, 59, 59, 999)

      const prevSales = await prisma.order.aggregate({
        where: {
          status: { in: salesStatuses },
          deletedAt: null,
          paidAt: {
            gte: prevMonthStart,
            lte: prevMonthEnd,
          },
        },
        _sum: { finalPrice: true },
      })

      const currentTotal = totalSales._sum.finalPrice || 0
      const prevTotal = prevSales._sum.finalPrice || 0
      const growthRate = prevTotal > 0
        ? ((currentTotal - prevTotal) / prevTotal * 100).toFixed(1)
        : null

      return NextResponse.json({
        summary: {
          totalSales: currentTotal,
          orderCount,
          averageOrderValue: orderCount > 0 ? Math.round(currentTotal / orderCount) : 0,
          cancelledCount,
          refundedAmount: refundedAmount._sum.refundAmount || 0,
          netSales: currentTotal - (refundedAmount._sum.refundAmount || 0),
          growthRate,
        },
        dailySales: dailySales.map(d => ({
          date: d.date,
          amount: Number(d.amount),
          count: Number(d.count),
        })),
        topProducts: topProducts.map(p => {
          // 썸네일 이미지 추출
          let thumbnail = null
          if (p.productImages) {
            try {
              const images = JSON.parse(p.productImages)
              if (Array.isArray(images) && images.length > 0) {
                thumbnail = images[0].replace(/\.webp$/, '-thumb.webp')
              }
            } catch {
              thumbnail = null
            }
          }
          return {
            productId: p.productId,
            productName: p.productName,
            productSlug: p.productSlug,
            thumbnail,
            totalQty: Number(p.totalQty),
            totalAmount: Number(p.totalAmount),
          }
        }),
        period: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
        },
      })
    }

    if (tab === 'orders') {
      // 주문 목록
      const searchWhere = search
        ? {
            OR: [
              { orderNo: { contains: search } },
              { ordererName: { contains: search } },
              { ordererPhone: { contains: search } },
            ],
          }
        : {}

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where: {
            ...baseWhere,
            ...searchWhere,
          },
          include: {
            items: {
              include: {
                product: {
                  select: { images: true },
                },
              },
            },
            user: {
              select: { id: true, nickname: true, email: true },
            },
          },
          orderBy: { paidAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.order.count({
          where: {
            ...baseWhere,
            ...searchWhere,
          },
        }),
      ])

      return NextResponse.json({
        orders: orders.map(order => ({
          ...order,
          items: order.items.map(item => {
            // images는 JSON 문자열로 저장되어 있음
            let productImage = null
            if (item.product?.images) {
              try {
                const images = JSON.parse(item.product.images as string)
                if (Array.isArray(images) && images.length > 0) {
                  // 썸네일 이미지 사용 (원본.webp -> 원본-thumb.webp)
                  const originalImage = images[0]
                  productImage = originalImage.replace(/\.webp$/, '-thumb.webp')
                }
              } catch {
                productImage = null
              }
            }
            return {
              ...item,
              productImage,
              product: undefined, // product 객체 제거 (불필요한 데이터)
            }
          }),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        period: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
        },
      })
    }

    if (tab === 'settlement') {
      // 정산 정보
      const [totalSales, orderCount] = await Promise.all([
        prisma.order.aggregate({
          where: baseWhere,
          _sum: {
            finalPrice: true,
            deliveryFee: true,
          },
        }),
        prisma.order.count({ where: baseWhere }),
      ])

      // 결제수단별 통계
      const paymentMethodStats = await prisma.order.groupBy({
        by: ['paymentMethod'],
        where: baseWhere,
        _sum: { finalPrice: true },
        _count: true,
      })

      const totalAmount = totalSales._sum.finalPrice || 0
      const deliveryFeeTotal = totalSales._sum.deliveryFee || 0
      const productAmount = totalAmount - deliveryFeeTotal

      // PG 수수료 계산 (카드: 3.3%, 무통장: 0원 기준)
      const cardSales = paymentMethodStats.find(p => p.paymentMethod === 'card')
      const bankSales = paymentMethodStats.find(p => p.paymentMethod === 'bank')

      const cardAmount = cardSales?._sum.finalPrice || 0
      const bankAmount = bankSales?._sum.finalPrice || 0
      const pgFee = Math.round(cardAmount * 0.033) // 카드 수수료 3.3%

      const netSettlement = totalAmount - pgFee

      return NextResponse.json({
        settlement: {
          totalAmount,
          productAmount,
          deliveryFeeTotal,
          orderCount,
          pgFee,
          netSettlement,
          paymentMethods: {
            card: {
              amount: cardAmount,
              count: cardSales?._count || 0,
              fee: Math.round(cardAmount * 0.033),
              feeRate: 3.3,
            },
            bank: {
              amount: bankAmount,
              count: bankSales?._count || 0,
              fee: 0,
              feeRate: 0,
            },
          },
        },
        period: {
          from: dateFrom.toISOString(),
          to: dateTo.toISOString(),
        },
      })
    }

    return NextResponse.json({ error: '잘못된 탭입니다.' }, { status: 400 })
  } catch (error) {
    console.error('매출 관리 API 에러:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
