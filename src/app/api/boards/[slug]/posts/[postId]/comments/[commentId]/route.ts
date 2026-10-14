import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string; commentId: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { commentId: commentIdParam } = await params
    const commentId = parseInt(commentIdParam)
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })
    }

    const comment = await prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) {
      return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (comment.authorId !== user.id && user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: { content: content.trim() },
      include: { author: { select: { id: true, nickname: true, image: true } } }
    })

    return NextResponse.json({ success: true, comment: updated })
  } catch (error) {
    console.error('failed to update comment:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string; commentId: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { postId: postIdParam, commentId: commentIdParam } = await params
    const postId = parseInt(postIdParam)
    const commentId = parseInt(commentIdParam)

    const comment = await prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) {
      return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (comment.authorId !== user.id && user.role !== 'admin' && user.role !== 'manager') {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    // Also decrement the reply count
    const replyCount = await prisma.comment.count({ where: { parentId: commentId } })
    await prisma.comment.deleteMany({ where: { parentId: commentId } })
    await prisma.comment.delete({ where: { id: commentId } })

    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { decrement: 1 + replyCount } }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('failed to delete comment:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
