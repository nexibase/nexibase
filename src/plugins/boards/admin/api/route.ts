import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Fetch board list
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
    const category = searchParams.get('category') || ''

    const skip = (page - 1) * limit

    // Search conditions
    const where: Record<string, unknown> = {}
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } }
      ]
    }
    if (category) {
      where.category = category
    }

    // Fetch board list
    const [boards, total] = await Promise.all([
      prisma.board.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.board.count({ where })
    ])

    return NextResponse.json({
      success: true,
      boards,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('failed to fetch boards:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Create board
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      slug,
      name,
      description,
      category,
      listMemberOnly,
      readMemberOnly,
      writeMemberOnly,
      commentMemberOnly,
      useComment,
      useReaction,
      useFile,
      useSecret,
      postsPerPage,
      sortOrder,
      displayType,
      isActive
    } = body

    // Validate required fields
    if (!slug || !name) {
      return NextResponse.json(
        { error: '슬러그와 게시판 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    // Validate slug format (only letters, digits, and hyphens allowed)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: '슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // Check slug uniqueness
    const existingBoard = await prisma.board.findUnique({
      where: { slug }
    })

    if (existingBoard) {
      return NextResponse.json(
        { error: '이미 사용 중인 슬러그입니다.' },
        { status: 409 }
      )
    }

    // Create board
    // Posting and commenting are member-only (guest posting requires name/password fields and is not supported)
    const newBoard = await prisma.board.create({
      data: {
        slug,
        name,
        description: description || null,
        category: category || null,
        listMemberOnly: listMemberOnly ?? false,
        readMemberOnly: readMemberOnly ?? false,
        writeMemberOnly: true,  // 항상 회원만 가능
        commentMemberOnly: true,  // 항상 회원만 가능
        useComment: useComment ?? true,
        useReaction: useReaction ?? true,
        useFile: useFile ?? true,
        useSecret: useSecret ?? false,
        postsPerPage: postsPerPage ?? 20,
        sortOrder: sortOrder || 'latest',
        displayType: displayType || 'list',
        isActive: isActive ?? true
      }
    })

    return NextResponse.json({
      success: true,
      message: '게시판이 생성되었습니다.',
      board: newBoard
    }, { status: 201 })

  } catch (error) {
    console.error('failed to create board:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Bulk delete boards
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
        { error: '삭제할 게시판을 선택해주세요.' },
        { status: 400 }
      )
    }

    // Delete the board (related posts, comments, and reactions cascade automatically)
    await prisma.board.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({
      success: true,
      message: `${ids.length}개의 게시판이 삭제되었습니다.`
    })

  } catch (error) {
    console.error('failed to delete board:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
