import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import {
  createPostCommentNotification,
  createCommentReplyNotification,
  createMentionNotification,
} from '@/lib/notification'
import { parseMentions, resolveMentions } from '@/lib/mentions'

// Write comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId: postIdParam } = await params
    const postId = parseInt(postIdParam)
    const body = await request.json()
    const { content, parentId } = body

    // Login check
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // Fetch board info
    const board = await prisma.board.findUnique({
      where: { slug }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Comment authorization check
    if (board.commentMemberOnly && !user) {
      return NextResponse.json(
        { error: '댓글을 쓸 권한이 없습니다. 로그인이 필요합니다.', requireLogin: true },
        { status: 403 }
      )
    }

    // Check whether comments are enabled
    if (!board.useComment) {
      return NextResponse.json(
        { error: '이 게시판은 댓글 기능을 사용하지 않습니다.' },
        { status: 400 }
      )
    }

    // Post check
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post || post.status !== 'published') {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // For nested comments, verify the parent comment
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parseInt(parentId) }
      })

      if (!parentComment || parentComment.postId !== postId) {
        return NextResponse.json(
          { error: '부모 댓글을 찾을 수 없습니다.' },
          { status: 404 }
        )
      }
    }

    // Validate content
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: '댓글 내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        authorId: user.id,
        postId,
        parentId: parentId ? parseInt(parentId) : null
      },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            image: true
          }
        }
      }
    })

    // Increment the post's comment count
    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } }
    })

    // --- Notification fan-out ---------------------------------------------
    // Build recipient map: one notification per user max per comment.
    // Priority: mention (handled later) > comment_reply > post_comment.
    const recipientKind = new Map<number, 'post_comment' | 'comment_reply'>()

    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parseInt(parentId) },
        select: { authorId: true },
      })
      if (parent && parent.authorId !== user.id) {
        recipientKind.set(parent.authorId, 'comment_reply')
      }
      if (post.authorId !== user.id && !recipientKind.has(post.authorId)) {
        recipientKind.set(post.authorId, 'post_comment')
      }
    } else {
      if (post.authorId !== user.id) {
        recipientKind.set(post.authorId, 'post_comment')
      }
    }

    const postLink = `/boards/${slug}/${postId}`
    const excerpt = content.trim().slice(0, 80)
    const fromUserName = user.nickname

    for (const [uid, kind] of recipientKind) {
      if (kind === 'comment_reply') {
        await createCommentReplyNotification({
          userId: uid, fromUserName, postTitle: post.title, postLink, excerpt,
        })
      } else {
        await createPostCommentNotification({
          userId: uid, fromUserName, postTitle: post.title, postLink, excerpt,
        })
      }
    }

    // Mentions (skip self, skip users already covered above, cap at 10)
    const nicknames = parseMentions(content).slice(0, 10)
    if (nicknames.length > 0) {
      const mentioned = await resolveMentions(nicknames)
      for (const m of mentioned) {
        if (m.id === user.id) continue
        if (recipientKind.has(m.id)) continue
        await createMentionNotification({
          userId: m.id, fromUserName, postTitle: post.title, postLink, excerpt,
        })
      }
    }
    // --- end fan-out -----------------------------------------------------

    return NextResponse.json({
      success: true,
      message: '댓글이 등록되었습니다.',
      comment
    }, { status: 201 })

  } catch (error) {
    console.error('failed to create comment:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Fetch comment list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { postId: postIdParam } = await params
    const postId = parseInt(postIdParam)

    const comments = await prisma.comment.findMany({
      where: {
        postId,
        status: 'published',
      },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            image: true
          }
        },
        parent: {
          select: {
            author: {
              select: { nickname: true }
            }
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      comments
    })

  } catch (error) {
    console.error('failed to fetch comments:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
