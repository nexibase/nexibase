import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 게시판 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''

    const skip = (page - 1) * limit

    // 검색 조건
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

    // 게시판 목록 조회
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
    console.error('게시판 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시판 생성
export async function POST(request: NextRequest) {
  try {
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
      isActive
    } = body

    // 필수 필드 검증
    if (!slug || !name) {
      return NextResponse.json(
        { error: '슬러그와 게시판 이름은 필수입니다.' },
        { status: 400 }
      )
    }

    // 슬러그 형식 검증 (영문, 숫자, 하이픈만 허용)
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json(
        { error: '슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    // 슬러그 중복 확인
    const existingBoard = await prisma.board.findUnique({
      where: { slug }
    })

    if (existingBoard) {
      return NextResponse.json(
        { error: '이미 사용 중인 슬러그입니다.' },
        { status: 409 }
      )
    }

    // 게시판 생성
    // 글쓰기/댓글쓰기는 항상 회원만 가능 (비회원 글쓰기는 이름/비번 필드가 필요하므로 지원하지 않음)
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
        isActive: isActive ?? true
      }
    })

    return NextResponse.json({
      success: true,
      message: '게시판이 생성되었습니다.',
      board: newBoard
    }, { status: 201 })

  } catch (error) {
    console.error('게시판 생성 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시판 일괄 삭제
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: '삭제할 게시판을 선택해주세요.' },
        { status: 400 }
      )
    }

    // 게시판 삭제 (연관된 posts, comments, reactions는 CASCADE로 자동 삭제)
    await prisma.board.deleteMany({
      where: { id: { in: ids } }
    })

    return NextResponse.json({
      success: true,
      message: `${ids.length}개의 게시판이 삭제되었습니다.`
    })

  } catch (error) {
    console.error('게시판 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
