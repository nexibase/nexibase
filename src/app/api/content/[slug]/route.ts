import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 콘텐츠 조회 (공개된 콘텐츠만)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const content = await prisma.content.findUnique({
      where: { slug }
    })

    if (!content) {
      return NextResponse.json(
        { error: '콘텐츠를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 비공개 콘텐츠는 접근 불가
    if (!content.isPublic) {
      return NextResponse.json(
        { error: '비공개 콘텐츠입니다.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      content
    })
  } catch (error) {
    console.error('콘텐츠 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
