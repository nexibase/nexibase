import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Fetch content list
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''

    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { slug: { contains: search } }
      ]
    }

    const [contents, total] = await Promise.all([
      prisma.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' }
      }),
      prisma.content.count({ where })
    ])

    return NextResponse.json({
      success: true,
      contents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('failed to fetch contents:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Create content
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { slug, title, content, isPublic } = body

    if (!slug || !title) {
      return NextResponse.json(
        { error: '슬러그와 제목은 필수입니다.' },
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

    // Check slug uniqueness
    const existing = await prisma.content.findUnique({
      where: { slug }
    })

    if (existing) {
      return NextResponse.json(
        { error: '이미 사용 중인 슬러그입니다.' },
        { status: 409 }
      )
    }

    const newContent = await prisma.content.create({
      data: {
        slug,
        title,
        content: content || '',
        isPublic: isPublic ?? true
      }
    })

    return NextResponse.json({
      success: true,
      message: '콘텐츠가 생성되었습니다.',
      content: newContent
    }, { status: 201 })

  } catch (error) {
    console.error('failed to create content:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Bulk delete contents
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
        { error: '삭제할 콘텐츠를 선택해주세요.' },
        { status: 400 }
      )
    }

    await prisma.content.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({
      success: true,
      message: `${ids.length}개의 콘텐츠가 삭제되었습니다.`
    })

  } catch (error) {
    console.error('failed to delete content:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
