import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 인기 게시글 조회 (좋아요 + 조회수 + 댓글수 기반)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const period = searchParams.get('period') || 'week' // day, week, month, all

    // 기간 필터
    let dateFilter: Date | undefined
    const now = new Date()
    switch (period) {
      case 'day':
        dateFilter = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case 'week':
        dateFilter = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case 'month':
        dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case 'all':
      default:
        dateFilter = undefined
    }

    const where = {
      isSecret: false,
      board: {
        isActive: true
      },
      ...(dateFilter && { createdAt: { gte: dateFilter } })
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: {
          id: true,
          title: true,
          content: true,
          createdAt: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          author: {
            select: {
              nickname: true
            }
          },
          board: {
            select: {
              slug: true,
              name: true
            }
          }
        },
        orderBy: [
          { likeCount: 'desc' },
          { viewCount: 'desc' },
          { commentCount: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.post.count({ where })
    ])

    return NextResponse.json({
      success: true,
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('인기 게시글 조회 에러:', error)
    return NextResponse.json(
      { error: '게시글을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
