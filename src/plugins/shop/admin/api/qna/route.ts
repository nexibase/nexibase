import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 관리자 Q&A 목록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') || '' // all, answered, unanswered
    const search = searchParams.get('search') || ''
    const skip = (page - 1) * limit

    // 필터 조건
    const where: Record<string, unknown> = {
      isActive: true
    }

    if (status === 'answered') {
      where.answer = { not: null }
    } else if (status === 'unanswered') {
      where.answer = null
    }

    if (search) {
      where.OR = [
        { question: { contains: search } },
        { product: { name: { contains: search } } },
        { user: { name: { contains: search } } },
        { user: { nickname: { contains: search } } },
      ]
    }

    // Q&A 조회
    const [qnas, total, stats] = await Promise.all([
      prisma.productQna.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, slug: true }
          },
          user: {
            select: { id: true, nickname: true, email: true }
          }
        },
        orderBy: [
          { answer: 'asc' }, // 미답변 우선
          { createdAt: 'desc' }
        ],
        skip,
        take: limit
      }),
      prisma.productQna.count({ where }),
      // 통계
      Promise.all([
        prisma.productQna.count({ where: { isActive: true } }),
        prisma.productQna.count({ where: { isActive: true, answer: null } }),
        prisma.productQna.count({ where: { isActive: true, answer: { not: null } } }),
      ])
    ])

    return NextResponse.json({
      qnas: qnas.map(qna => ({
        ...qna,
        user: {
          ...qna.user,
          nickname: qna.user.nickname || '익명'
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
        unanswered: stats[1],
        answered: stats[2]
      }
    })
  } catch (error) {
    console.error('관리자 Q&A 목록 조회 에러:', error)
    return NextResponse.json({ error: 'Q&A를 불러오는데 실패했습니다.' }, { status: 500 })
  }
}
