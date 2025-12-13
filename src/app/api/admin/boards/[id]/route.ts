import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 게시판 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    console.error('게시판 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시판 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const boardId = parseInt(id)
    const body = await request.json()
    const {
      slug,
      name,
      description,
      category,
      listLevel,
      readLevel,
      writeLevel,
      commentLevel,
      useComment,
      useReaction,
      useFile,
      useSecret,
      postsPerPage,
      sortOrder,
      isActive
    } = body

    // 게시판 존재 확인
    const existingBoard = await prisma.board.findUnique({
      where: { id: boardId }
    })

    if (!existingBoard) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 슬러그 변경 시 중복 확인
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

    // 게시판 업데이트
    const updatedBoard = await prisma.board.update({
      where: { id: boardId },
      data: {
        slug: slug || existingBoard.slug,
        name: name || existingBoard.name,
        description: description !== undefined ? description : existingBoard.description,
        category: category !== undefined ? category : existingBoard.category,
        listLevel: listLevel ?? existingBoard.listLevel,
        readLevel: readLevel ?? existingBoard.readLevel,
        writeLevel: writeLevel ?? existingBoard.writeLevel,
        commentLevel: commentLevel ?? existingBoard.commentLevel,
        useComment: useComment ?? existingBoard.useComment,
        useReaction: useReaction ?? existingBoard.useReaction,
        useFile: useFile ?? existingBoard.useFile,
        useSecret: useSecret ?? existingBoard.useSecret,
        postsPerPage: postsPerPage ?? existingBoard.postsPerPage,
        sortOrder: sortOrder || existingBoard.sortOrder,
        isActive: isActive ?? existingBoard.isActive
      }
    })

    return NextResponse.json({
      success: true,
      message: '게시판이 수정되었습니다.',
      board: updatedBoard
    })

  } catch (error) {
    console.error('게시판 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시판 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const boardId = parseInt(id)

    // 게시판 존재 확인
    const existingBoard = await prisma.board.findUnique({
      where: { id: boardId }
    })

    if (!existingBoard) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 게시판 삭제 (연관된 posts, comments, reactions는 CASCADE로 자동 삭제)
    await prisma.board.delete({
      where: { id: boardId }
    })

    return NextResponse.json({
      success: true,
      message: '게시판이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('게시판 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
