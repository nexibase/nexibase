import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 사용자 레벨 확인 헬퍼
async function getUserLevel(request: NextRequest): Promise<{ userId: string | null; level: number }> {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return { userId: null, level: 0 }

  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: { id: true, level: true, role: true }
      }
    }
  })

  if (!session || new Date() > session.expires) {
    return { userId: null, level: 0 }
  }

  if (session.user.role === 'admin') {
    return { userId: session.user.id, level: 99 }
  }

  return { userId: session.user.id, level: session.user.level }
}

// 게시글 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await params

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
    const { userId, level } = await getUserLevel(request)
    if (level < board.readLevel) {
      return NextResponse.json(
        { error: '글을 읽을 권한이 없습니다.', requiredLevel: board.readLevel },
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
            nickname: true,
            name: true,
            image: true,
            level: true
          }
        },
        comments: board.useComment ? {
          where: { status: 'published', parentId: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: {
                id: true,
                nickname: true,
                name: true,
                image: true
              }
            },
            replies: {
              where: { status: 'published' },
              orderBy: { createdAt: 'asc' },
              include: {
                author: {
                  select: {
                    id: true,
                    nickname: true,
                    name: true,
                    image: true
                  }
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
    if (post.isSecret && post.authorId !== userId && level < 9) {
      return NextResponse.json(
        { error: '비밀글입니다.' },
        { status: 403 }
      )
    }

    // 조회수 증가 (본인 글 제외)
    if (post.authorId !== userId) {
      await prisma.post.update({
        where: { id: postId },
        data: { viewCount: { increment: 1 } }
      })
    }

    // 현재 사용자의 반응 조회
    let userReaction = null
    if (userId && board.useReaction) {
      const reaction = await prisma.reaction.findFirst({
        where: {
          userId,
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

    return NextResponse.json({
      success: true,
      board: {
        id: board.id,
        slug: board.slug,
        name: board.name,
        useComment: board.useComment,
        useReaction: board.useReaction,
        commentLevel: board.commentLevel
      },
      post: {
        ...post,
        viewCount: post.viewCount + (post.authorId !== userId ? 1 : 0)
      },
      userReaction,
      isAuthor: post.authorId === userId,
      prevPost,
      nextPost
    })
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
    const { slug, postId } = await params
    const body = await request.json()
    const { title, content, isNotice, isSecret } = body

    // 로그인 확인
    const { userId, level } = await getUserLevel(request)
    if (!userId) {
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
    if (post.authorId !== userId && level < 9) {
      return NextResponse.json(
        { error: '수정 권한이 없습니다.' },
        { status: 403 }
      )
    }

    // 게시글 수정
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title: title?.trim() || post.title,
        content: content?.trim() || post.content,
        isNotice: isNotice !== undefined ? (isNotice && level >= 9) : post.isNotice,
        isSecret: isSecret !== undefined ? (isSecret && board.useSecret) : post.isSecret
      }
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
    const { slug, postId } = await params

    // 로그인 확인
    const { userId, level } = await getUserLevel(request)
    if (!userId) {
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
    if (post.authorId !== userId && level < 9) {
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
