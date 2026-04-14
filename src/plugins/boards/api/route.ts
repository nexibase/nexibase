import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocaleFromRequest, flattenTranslations } from '@/lib/translation/resolver'

// 공개 게시판 목록 조회 (활성 게시판만)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const locale = getLocaleFromRequest(request)

    const boards = await prisma.board.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        postCount: true,
        translations: { where: { locale } }
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    })

    const localized = flattenTranslations(boards as any, locale, ['name', 'description'])

    return NextResponse.json({ boards: localized })
  } catch (error) {
    console.error('게시판 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '게시판 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
