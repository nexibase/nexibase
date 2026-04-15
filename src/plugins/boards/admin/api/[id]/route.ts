import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Fetch board detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const boardId = parseInt(id)

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        _count: {
          select: { posts: true }
        }
      }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      board
    })
  } catch (error) {
    console.error('failed to fetch board:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Edit board
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const boardId = parseInt(id)
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

    // Check whether the board exists
    const existingBoard = await prisma.board.findUnique({
      where: { id: boardId }
    })

    if (!existingBoard) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Check uniqueness when the slug changes
    if (slug && slug !== existingBoard.slug) {
      const slugRegex = /^[a-z0-9-]+$/
      if (!slugRegex.test(slug)) {
        return NextResponse.json(
          { error: '슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' },
          { status: 400 }
        )
      }

      const duplicateSlug = await prisma.board.findUnique({
        where: { slug }
      })

      if (duplicateSlug) {
        return NextResponse.json(
          { error: '이미 사용 중인 슬러그입니다.' },
          { status: 409 }
        )
      }
    }

    // Update board
    // Posting and commenting are member-only (guest posting requires name/password fields and is not supported)
    const updatedBoard = await prisma.board.update({
      where: { id: boardId },
      data: {
        slug: slug || existingBoard.slug,
        name: name || existingBoard.name,
        description: description !== undefined ? description : existingBoard.description,
        category: category !== undefined ? category : existingBoard.category,
        listMemberOnly: listMemberOnly ?? existingBoard.listMemberOnly,
        readMemberOnly: readMemberOnly ?? existingBoard.readMemberOnly,
        writeMemberOnly: true,  // 항상 회원만 가능
        commentMemberOnly: true,  // 항상 회원만 가능
        useComment: useComment ?? existingBoard.useComment,
        useReaction: useReaction ?? existingBoard.useReaction,
        useFile: useFile ?? existingBoard.useFile,
        useSecret: useSecret ?? existingBoard.useSecret,
        postsPerPage: postsPerPage ?? existingBoard.postsPerPage,
        sortOrder: sortOrder || existingBoard.sortOrder,
        displayType: displayType || existingBoard.displayType,
        isActive: isActive ?? existingBoard.isActive
      }
    })

    return NextResponse.json({
      success: true,
      message: '게시판이 수정되었습니다.',
      board: updatedBoard
    })

  } catch (error) {
    console.error('failed to update board:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Delete board
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const boardId = parseInt(id)

    // Check whether the board exists
    const existingBoard = await prisma.board.findUnique({
      where: { id: boardId }
    })

    if (!existingBoard) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Delete the board (related posts, comments, and reactions cascade automatically)
    await prisma.board.delete({
      where: { id: boardId }
    })

    return NextResponse.json({
      success: true,
      message: '게시판이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('failed to delete board:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
