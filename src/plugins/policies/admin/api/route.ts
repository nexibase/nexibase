import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 약관 목록 조회 (슬러그별 그룹핑)
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const skip = (page - 1) * limit

    // 특정 슬러그의 버전 목록 조회
    if (slug) {
      const policies = await prisma.policy.findMany({
        where: { slug },
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({
        success: true,
        policies
      })
    }

    // 전체 목록 (슬러그별 최신 활성 버전 우선)
    const [policies, total] = await Promise.all([
      prisma.policy.findMany({
        skip,
        take: limit,
        orderBy: [
          { slug: 'asc' },
          { isActive: 'desc' },
          { createdAt: 'desc' }
        ]
      }),
      prisma.policy.count()
    ])

    // 슬러그별 그룹핑 정보
    const slugGroups = await prisma.policy.groupBy({
      by: ['slug'],
      _count: { id: true }
    })

    return NextResponse.json({
      success: true,
      policies,
      slugGroups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('약관 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 약관 생성 (새 버전)
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { slug, version, title, content } = body

    if (!slug || !version || !title) {
      return NextResponse.json(
        { error: '슬러그, 버전, 제목은 필수입니다.' },
        { status: 400 }
      )
    }

    // 슬러그 형식 검증
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: '슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // 버전 형식 검증 (예: 1.0, 1.1, 2.0)
    const versionRegex = /^\d+\.\d+$/
    if (!versionRegex.test(version)) {
      return NextResponse.json(
        { error: '버전은 X.Y 형식이어야 합니다. (예: 1.0, 2.1)' },
        { status: 400 }
      )
    }

    // 동일 슬러그+버전 중복 확인
    const existing = await prisma.policy.findUnique({
      where: {
        slug_version: { slug, version }
      }
    })

    if (existing) {
      return NextResponse.json(
        { error: '동일한 슬러그와 버전이 이미 존재합니다.' },
        { status: 409 }
      )
    }

    // 약관 생성 (기본 비활성 상태)
    const newPolicy = await prisma.policy.create({
      data: {
        slug,
        version,
        title,
        content: content || '',
        isActive: false
      }
    })

    return NextResponse.json({
      success: true,
      message: '약관이 생성되었습니다. 활성화하려면 별도로 활성화해주세요.',
      policy: newPolicy
    }, { status: 201 })

  } catch (error) {
    console.error('약관 생성 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 약관 일괄 삭제
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '삭제할 약관을 선택해주세요.' },
        { status: 400 }
      )
    }

    await prisma.policy.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({
      success: true,
      message: `${ids.length}개의 약관이 삭제되었습니다.`
    })

  } catch (error) {
    console.error('약관 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
