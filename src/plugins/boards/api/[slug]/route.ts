import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocaleFromRequest, flattenTranslation } from '@/lib/translation/resolver'

// 게시판 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const locale = getLocaleFromRequest(request)

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
        postCount: true,
        translations: { where: { locale } }
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

    const localized = flattenTranslation(board as any, locale, ['name', 'description'])

    return NextResponse.json({
      success: true,
      board: localized
    })
  } catch (error) {
    console.error('게시판 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
