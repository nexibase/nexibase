import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 관리자 리뷰 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const rating = searchParams.get('rating') || '' // 1~5 또는 빈값
    const search = searchParams.get('search') || ''
    const showDeleted = searchParams.get('deleted') === 'true'
    const skip = (page - 1) * limit

    // 필터 조건
    const where: Record<string, unknown> = {}

    if (!showDeleted) {
      where.isActive = true
    }

    if (rating) {
      where.rating = parseInt(rating)
    }

    if (search) {
      where.OR = [
        { content: { contains: search } },
        { product: { name: { contains: search } } },
        { user: { name: { contains: search } } },
        { user: { nickname: { contains: search } } },
      ]
    }

    // 리뷰 조회
    const [reviews, total, stats] = await Promise.all([
      prisma.productReview.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, slug: true }
          },
          user: {
            select: { id: true, nickname: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.productReview.count({ where }),
      // 통계
      Promise.all([
        prisma.productReview.count({ where: { isActive: true } }),
        prisma.productReview.count({ where: { isActive: true, reply: null } }),
        prisma.productReview.count({ where: { isActive: true, reply: { not: null } } }),
        prisma.productReview.count({ where: { isActive: false } }),
      ])
    ])

    return NextResponse.json({
      reviews: reviews.map(review => ({
        ...review,
        images: review.images ? JSON.parse(review.images) : [],
        user: {
          ...review.user,
          nickname: review.user.nickname || '익명'
        }
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        all: stats[0],
        noReply: stats[1],
        replied: stats[2],
        deleted: stats[3]
      }
    })
  } catch (error) {
    console.error('관리자 리뷰 목록 조회 에러:', error)
    return NextResponse.json({ error: '리뷰를 불러오는데 실패했습니다.' }, { status: 500 })
  }
}
