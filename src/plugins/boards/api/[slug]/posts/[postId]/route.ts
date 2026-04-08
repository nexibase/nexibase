import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { sanitizeHtml } from '@/lib/sanitize'

// 게시글 상세 조회
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

    // 게시판 정보 조회
    const board = await prisma.board.findUnique({
      where: { slug }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인
    const user = await getAuthUser()
    if (board.readMemberOnly && !user) {
      return NextResponse.json(
        { error: '글을 읽을 권한이 없습니다. 로그인이 필요합니다.', requireLogin: true },
        { status: 403 }
      )
    }

    // 게시글 조회
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

    // 비밀글 확인
    if (post.isSecret && post.authorId !== user?.id && user?.role !== 'admin') {
      return NextResponse.json(
        { error: '비밀글입니다.' },
        { status: 403 }
      )
    }

    // 조회수 증가 (세션당 1회)
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

    // 현재 사용자의 반응 조회
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

    // 이전 게시글 조회 (현재 글보다 이전에 작성된 글 중 가장 최신)
    const prevPost = await prisma.post.findFirst({
      where: {
        boardId: board.id,
        status: 'published',
        createdAt: { lt: post.createdAt }
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true }
    })

    // 다음 게시글 조회 (현재 글보다 이후에 작성된 글 중 가장 오래된)
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

    // 조회한 게시글 목록을 쿠키에 저장 (세션 쿠키, 브라우저 닫으면 초기화)
    if (viewIncremented) {
      // 최대 200개까지 유지 (쿠키 크기 제한)
      const viewedArray = Array.from(viewedPosts).slice(-200)
      response.cookies.set('viewed_posts', viewedArray.join(','), {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
      })
    }

    return response
  } catch (error) {
    console.error('게시글 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시글 수정
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

    // 로그인 확인
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 게시판 정보 조회
    const board = await prisma.board.findUnique({
      where: { slug }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 게시글 조회
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인 (작성자 또는 관리자)
    if (post.authorId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: '수정 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 트랜잭션으로 게시글과 첨부파일 수정
    const updatedPost = await prisma.$transaction(async (tx) => {
      // 게시글 수정
      const updated = await tx.post.update({
        where: { id: postId },
        data: {
          title: title?.trim() || post.title,
          content: content ? sanitizeHtml(content.trim()) : post.content,
          isNotice: isNotice !== undefined ? (isNotice && user.role === 'admin') : post.isNotice,
          isSecret: isSecret !== undefined ? (isSecret && board.useSecret) : post.isSecret
        }
      })

      // 첨부파일 처리 (게시판이 파일 사용 설정된 경우만)
      if (board.useFile) {
        // 삭제할 첨부파일 삭제
        if (deletedAttachmentIds && Array.isArray(deletedAttachmentIds) && deletedAttachmentIds.length > 0) {
          await tx.postAttachment.deleteMany({
            where: {
              id: { in: deletedAttachmentIds },
              postId: postId
            }
          })
        }

        // 새 첨부파일 추가
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

        // 첨부파일 순서 업데이트 (기존 파일들)
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
    console.error('게시글 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시글 삭제
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

    // 로그인 확인
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 게시판 정보 조회
    const board = await prisma.board.findUnique({
      where: { slug }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 게시글 조회
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post) {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 권한 확인 (작성자 또는 관리자)
    if (post.authorId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: '삭제 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 게시글 삭제 (soft delete)
    await prisma.post.update({
      where: { id: postId },
      data: { status: 'deleted' }
    })

    // 게시판 글 수 감소
    await prisma.board.update({
      where: { id: board.id },
      data: { postCount: { decrement: 1 } }
    })

    return NextResponse.json({
      success: true,
      message: '게시글이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('게시글 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
