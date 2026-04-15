import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '5')

    const posts = await prisma.post.findMany({
      where: { authorId: user.id, status: 'published' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
      },
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('failed to fetch my posts:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
