import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Fetch policy list (grouped by slug)
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

    // Fetch the version list for a specific slug
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

    // Full list (the most recent active version per slug comes first)
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

    // Per-slug grouping info
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
    console.error('failed to fetch policies:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Create policy (new version)
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

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: '슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // Validate version format (e.g., 1.0, 1.1, 2.0)
    const versionRegex = /^\d+\.\d+$/
    if (!versionRegex.test(version)) {
      return NextResponse.json(
        { error: '버전은 X.Y 형식이어야 합니다. (예: 1.0, 2.1)' },
        { status: 400 }
      )
    }

    // Check for a duplicate slug+version pair
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

    // Create policy (inactive by default)
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
    console.error('failed to create policy:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Bulk delete policies
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
    console.error('failed to delete policy:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
