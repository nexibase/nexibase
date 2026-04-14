import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocaleFromRequest, flattenTranslation } from '@/lib/translation/resolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const locale = getLocaleFromRequest(request)

    const content = await prisma.content.findUnique({
      where: { slug },
      include: { translations: { where: { locale } } }
    })

    if (!content) {
      return NextResponse.json(
        { error: '콘텐츠를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (!content.isPublic) {
      return NextResponse.json(
        { error: '비공개 콘텐츠입니다.' },
        { status: 403 }
      )
    }

    const localized = flattenTranslation(content as any, locale, ['title', 'content'])

    return NextResponse.json({
      success: true,
      content: localized
    })
  } catch (error) {
    console.error('콘텐츠 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
