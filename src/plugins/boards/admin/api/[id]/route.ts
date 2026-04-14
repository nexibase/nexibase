import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { autoTranslateEntity, invalidateAutoTranslations } from '@/lib/translation/auto-translate'

// 게시판 상세 조회
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
      isActive,
      translations,
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

    // name / description 변경 여부 사전 확인
    const newName = name || existingBoard.name
    const newDescription = description !== undefined ? description : existingBoard.description
    const nameChanged = existingBoard.name !== newName
    const descChanged = existingBoard.description !== newDescription

    // 게시판 업데이트
    // 글쓰기/댓글쓰기는 항상 회원만 가능 (비회원 글쓰기는 이름/비번 필드가 필요하므로 지원하지 않음)
    const updatedBoard = await prisma.board.update({
      where: { id: boardId },
      data: {
        slug: slug || existingBoard.slug,
        name: newName,
        description: newDescription,
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

    // name / description 변경 시 자동 번역 재실행
    if (nameChanged || descChanged) {
      try {
        await invalidateAutoTranslations('board', boardId)
        await autoTranslateEntity('board', boardId, {
          name: updatedBoard.name,
          description: updatedBoard.description,
        })
      } catch (translateError) {
        console.error('[auto-translate] board 수정 번역 실패:', translateError)
      }
    }

    // 수동 번역 저장 (source='manual')
    if (translations && typeof translations === 'object') {
      for (const [locale, fields] of Object.entries(translations)) {
        try {
          await prisma.boardTranslation.upsert({
            where: { boardId_locale: { boardId, locale } },
            create: { boardId, locale, ...(fields as object), source: 'manual' },
            update: { ...(fields as object), source: 'manual' },
          })
        } catch (upsertError) {
          console.error(`[manual-translate] board locale=${locale} 저장 실패:`, upsertError)
        }
      }
    }

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
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

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
