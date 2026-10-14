import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { sanitizeHtml } from '@/lib/sanitize'

// Fetch post detail
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId: postIdParam } = await params
    const postId = parseInt(postIdParam)

    if (isNaN(postId)) {
      return NextResponse.json(
        { error: '잘못된 게시글 ID입니다.' },
        { status: 400 }
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

    // Authorization check
    const user = await getAuthUser()
    if (board.readMemberOnly && !user) {
      return NextResponse.json(
        { error: '글을 읽을 권한이 없습니다. 로그인이 필요합니다.', requireLogin: true },
        { status: 403 }
      )
    }

    // Fetch post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            uuid: true,
            nickname: true,
            image: true
          }
        },
        attachments: board.useFile ? {
          select: {
            id: true,
            filename: true,
            filePath: true,
            thumbnailPath: true,
            fileSize: true,
            mimeType: true,
            downloadCount: true,
            sortOrder: true
          },
          orderBy: { sortOrder: 'asc' }
        } : false,
        comments: board.useComment ? {
          where: { status: 'published' },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                uuid: true,
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
        } : false
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    if (post.boardId !== board.id) {
      return NextResponse.json(
        { error: '게시판 정보가 일치하지 않습니다.' },
        { status: 400 }
      )
    }

    if (post.status !== 'published') {
      return NextResponse.json(
        { error: '삭제되었거나 숨겨진 게시글입니다.' },
        { status: 404 }
      )
    }

    // Check for a private post
    if (post.isSecret && post.authorId !== user?.id && user?.role !== 'admin') {
      return NextResponse.json(
        { error: '비밀글입니다.' },
        { status: 403 }
      )
    }

    // Increment view count (once per session)
    const viewedCookie = request.cookies.get('viewed_posts')?.value || ''
    const viewedPosts = new Set(viewedCookie.split(',').filter(Boolean))
    const viewedKey = `${slug}:${postId}`
    let viewIncremented = false

    if (!viewedPosts.has(viewedKey)) {
      await prisma.post.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } }
      })
      viewedPosts.add(viewedKey)
      viewIncremented = true
    }

    // Fetch the current user's reaction
    let userReaction = null
    if (user && board.useReaction) {
      const reaction = await prisma.reaction.findFirst({
        where: {
          userId: user.id,
          postId,
          type: 'like'
        }
      })
      userReaction = reaction ? reaction.type : null
    }

    // Fetch the previous post (newest post older than the current one)
    const prevPost = await prisma.post.findFirst({
      where: {
        boardId: board.id,
        status: 'published',
        createdAt: { lt: post.createdAt }
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true }
    })

    // Fetch the next post (oldest post newer than the current one)
    const nextPost = await prisma.post.findFirst({
      where: {
        boardId: board.id,
        status: 'published',
        createdAt: { gt: post.createdAt }
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true }
    })

    const response = NextResponse.json({
      success: true,
      board: {
        id: board.id,
        slug: board.slug,
        name: board.name,
        useComment: board.useComment,
        useReaction: board.useReaction,
        useFile: board.useFile,
        commentMemberOnly: board.commentMemberOnly,
        displayType: board.displayType
      },
      post: {
        ...post,
        viewCount: post.viewCount + (viewIncremented ? 1 : 0)
      },
      userReaction,
      isAuthor: post.authorId === user?.id,
      prevPost,
      nextPost
    })

    // Store the visited-post list in a session cookie (cleared when the browser closes)
    if (viewIncremented) {
      // Keep at most 200 (cookie size limit)
      const viewedArray = Array.from(viewedPosts).slice(-200)
      response.cookies.set('viewed_posts', viewedArray.join(','), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    }

    return response
  } catch (error) {
    console.error('failed to fetch post:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Edit post
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId: postIdParam } = await params
    const postId = parseInt(postIdParam)

    if (isNaN(postId)) {
      return NextResponse.json(
        { error: '잘못된 게시글 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, content, isNotice, isSecret, attachments, deletedAttachmentIds, attachmentOrder } = body

    if (content && content.length > 4_000_000) {
      return NextResponse.json(
        { error: '본문이 너무 깁니다.' },
        { status: 413 }
      )
    }

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

    // Fetch post
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Authorization check (author or admin)
    if (post.authorId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: '수정 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // Update the post and attachments within a transaction
    const updatedPost = await prisma.$transaction(async (tx) => {
      // Edit post
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          title: title?.trim() || post.title,
          content: content ? sanitizeHtml(content.trim()) : post.content,
          isNotice: isNotice !== undefined ? (isNotice && user.role === 'admin') : post.isNotice,
          isSecret: isSecret !== undefined ? (isSecret && board.useSecret) : post.isSecret
        }
      })

      // Handle attachments (only when the board allows files)
      if (board.useFile) {
        // Delete attachments flagged for removal
        if (deletedAttachmentIds && Array.isArray(deletedAttachmentIds) && deletedAttachmentIds.length > 0) {
          await tx.postAttachment.deleteMany({
            where: {
              id: { in: deletedAttachmentIds },
              postId: postId
            }
          })
        }

        // Add new attachments
        if (attachments && Array.isArray(attachments) && attachments.length > 0) {
          await tx.postAttachment.createMany({
            data: attachments.map((file: { filename: string; storedName: string; filePath: string; thumbnailPath?: string | null; fileSize: number; mimeType: string }) => ({
              postId: postId,
              filename: file.filename,
              storedName: file.storedName,
              filePath: file.filePath,
              thumbnailPath: file.thumbnailPath || null,
              fileSize: file.fileSize,
              mimeType: file.mimeType
            }))
          })
        }

        // Update the ordering of existing attachments
        if (attachmentOrder && Array.isArray(attachmentOrder) && attachmentOrder.length > 0) {
          for (let i = 0; i < attachmentOrder.length; i++) {
            await tx.postAttachment.updateMany({
              where: {
                id: attachmentOrder[i],
                postId: postId
              },
              data: {
                sortOrder: i
              }
            })
          }
        }
      }

      return updated
    })

    return NextResponse.json({
      success: true,
      message: '게시글이 수정되었습니다.',
      post: updatedPost
    })

  } catch (error) {
    console.error('failed to update post:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Delete post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId: postIdParam } = await params
    const postId = parseInt(postIdParam)

    if (isNaN(postId)) {
      return NextResponse.json(
        { error: '잘못된 게시글 ID입니다.' },
        { status: 400 }
      )
    }

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

    // Fetch post
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Authorization check (author or admin)
    if (post.authorId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: '삭제 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // Delete post (soft delete)
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'deleted' }
    })

    // Decrement the board's post count
    await prisma.board.update({
      where: { id: board.id },
      data: { postCount: { decrement: 1 } }
    })

    return NextResponse.json({
      success: true,
      message: '게시글이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('failed to delete post:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
