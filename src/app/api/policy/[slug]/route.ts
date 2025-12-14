import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 약관 조회 (활성 버전 또는 특정 버전)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const version = searchParams.get('v')

    let policy

    if (version) {
      // 특정 버전 조회
      policy = await prisma.policy.findUnique({
        where: {
          slug_version: { slug, version }
        }
      })
    } else {
      // 활성 버전 조회
      policy = await prisma.policy.findFirst({
        where: { slug, isActive: true }
      })
    }

    if (!policy) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 해당 슬러그의 모든 버전 목록 (버전 선택용)
    const versions = await prisma.policy.findMany({
      where: { slug },
      select: {
        version: true,
        isActive: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      policy,
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
