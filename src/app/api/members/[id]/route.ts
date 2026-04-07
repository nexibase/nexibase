import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // uuid 또는 숫자 id 모두 지원
    const isUuid = id.includes('-')
    const user = await prisma.user.findUnique({
      where: isUuid ? { uuid: id } : { id: parseInt(id) },
      select: {
        id: true,
        uuid: true,
        nickname: true,
        image: true,
        level: true,
        createdAt: true,
        _count: {
          select: {
            posts: true,
            comments: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        uuid: user.uuid,
        nickname: user.nickname,
        image: user.image,
        level: user.level,
        createdAt: user.createdAt,
        postCount: user._count.posts,
        commentCount: user._count.comments,
      }
    })
  } catch (error) {
    console.error('회원 프로필 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
