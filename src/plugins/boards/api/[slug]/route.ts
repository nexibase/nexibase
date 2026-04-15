import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Fetch board info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const board = await prisma.board.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        listMemberOnly: true,
        readMemberOnly: true,
        writeMemberOnly: true,
        commentMemberOnly: true,
        useComment: true,
        useReaction: true,
        useFile: true,
        useSecret: true,
        postsPerPage: true,
        sortOrder: true,
        displayType: true,
        isActive: true,
        postCount: true
      }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!board.isActive) {
      return NextResponse.json(
        { error: '비활성화된 게시판입니다.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      board
    })
  } catch (error) {
    console.error('failed to fetch board:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
