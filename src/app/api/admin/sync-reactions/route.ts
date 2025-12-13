import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 관리자 확인 헬퍼
async function isAdmin(request: NextRequest): Promise<boolean> {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return false

  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: { role: true }
      }
    }
  })

  if (!session || new Date() > session.expires) {
    return false
  }

  return session.user.role === 'admin'
}

// 리액션 수 동기화 (POST)
export async function POST(request: NextRequest) {
  try {
    // 관리자 확인
    if (!await isAdmin(request)) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 모든 게시글의 리액션 수 계산
    const posts = await prisma.post.findMany({
      select: { id: true }
    })

    let updated = 0

    for (const post of posts) {
      // 해당 게시글의 리액션 수 계산
      const reactionCount = await prisma.reaction.count({
        where: { postId: post.id }
      })

      // likeCount 업데이트
      await prisma.post.update({
        where: { id: post.id },
        data: { likeCount: reactionCount }
      })

      updated++
    }

    return NextResponse.json({
      success: true,
      message: `${updated}개 게시글의 리액션 수가 동기화되었습니다.`
    })

  } catch (error) {
    console.error('리액션 동기화 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
