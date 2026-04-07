import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const uuid = searchParams.get('uuid')

    const where: Record<string, unknown> = { status: 'published' }

    if (uuid) {
      const user = await prisma.user.findUnique({ where: { uuid }, select: { id: true } })
      if (!user) {
        return NextResponse.json({ posts: [], total: 0, page, totalPages: 0, member: null })
      }
      where.authorId = user.id
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          title: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
          board: { select: { slug: true, name: true } },
          author: { select: { id: true, uuid: true, nickname: true, image: true } },
        },
      }),
      prisma.post.count({ where }),
    ])

    let member = null
    if (uuid) {
      const u = await prisma.user.findUnique({
        where: { uuid },
        select: { nickname: true, image: true },
      })
      member = u
    }

    return NextResponse.json({
      posts,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      member,
    })
  } catch (error) {
    console.error('최신글 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
