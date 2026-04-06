import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 관리자용 주문 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || ''
    const search = searchParams.get('search') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const deleted = searchParams.get('deleted') === 'true'  // 삭제된 주문만 보기

    const skip = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    // 삭제 필터 (기본: 삭제되지 않은 주문만)
    if (deleted) {
      where.deletedAt = { not: null }
    } else {
      where.deletedAt = null
    }

    // 상태 필터
    if (status) {
      where.status = status
    }

    // 검색 (주문번호, 주문자명, 연락처)
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { ordererName: { contains: search } },
        { ordererPhone: { contains: search } },
        { recipientName: { contains: search } },
        { recipientPhone: { contains: search } },
      ]
    }

    // 날짜 필터
    if (startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(startDate)
      }
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt = {
        ...where.createdAt,
        lte: end
      }
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: { id: true, nickname: true, email: true }
          },
          items: {
            include: {
              product: {
                select: { images: true }
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

    // 상태별 통계 (삭제되지 않은 주문 기준)
    const [statusCounts, deletedCount] = await Promise.all([
      prisma.order.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { id: true }
      }),
      prisma.order.count({ where: { deletedAt: { not: null } } })
    ])

    // 삭제되지 않은 전체 주문 수
    const activeTotal = await prisma.order.count({ where: { deletedAt: null } })

    const stats = {
      all: activeTotal,
      pending: 0,
      paid: 0,
      preparing: 0,
      shipping: 0,
      delivered: 0,
      confirmed: 0,
      cancel_requested: 0,
      cancelled: 0,
      refund_requested: 0,
      refunded: 0,
      deleted: deletedCount,
    }

    statusCounts.forEach(s => {
      const key = s.status as keyof typeof stats
      if (key in stats) {
        stats[key] = s._count.id
      }
    })

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
      },
      stats
    })
  } catch (error) {
    console.error('주문 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '주문 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
