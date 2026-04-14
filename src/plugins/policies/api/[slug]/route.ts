import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getLocaleFromRequest, flattenTranslation } from '@/lib/translation/resolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const version = searchParams.get('v')
    const locale = getLocaleFromRequest(request)

    let policy

    if (version) {
      policy = await prisma.policy.findUnique({
        where: {
          slug_version: { slug, version }
        },
        include: { translations: { where: { locale } } }
      })
    } else {
      policy = await prisma.policy.findFirst({
        where: { slug, isActive: true },
        include: { translations: { where: { locale } } }
      })
    }

    if (!policy) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const versions = await prisma.policy.findMany({
      where: { slug },
      select: {
        version: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    const localized = flattenTranslation(policy as any, locale, ['title', 'content'])

    return NextResponse.json({
      success: true,
      policy: localized,
      versions
    })
  } catch (error) {
    console.error('약관 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
