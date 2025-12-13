import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 사용자 레벨 확인 헬퍼
async function getUserLevel(request: NextRequest): Promise<{ userId: number | null; level: number }> {
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

// 댓글 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId: postIdParam } = await params
    const postId = parseInt(postIdParam)
    const body = await request.json()
    const { content, parentId } = body

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

    // 댓글 권한 확인
    if (level < board.commentLevel) {
      return NextResponse.json(
        { error: '댓글을 쓸 권한이 없습니다.', requiredLevel: board.commentLevel },
        { status: 403 }
      )
    }

    // 댓글 기능 확인
    if (!board.useComment) {
      return NextResponse.json(
        { error: '이 게시판은 댓글 기능을 사용하지 않습니다.' },
        { status: 400 }
      )
    }

    // 게시글 확인
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post || post.status !== 'published') {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 대댓글인 경우 부모 댓글 확인
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

    // 내용 검증
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: '댓글 내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    // 댓글 생성
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        authorId: userId,
        postId,
        parentId: parentId ? parseInt(parentId) : null
      },
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
    })

    // 게시글 댓글 수 증가
    await prisma.post.update({
      where: { id: postId },
      data: { commentCount: { increment: 1 } }
    })

    return NextResponse.json({
      success: true,
      message: '댓글이 등록되었습니다.',
      comment
    }, { status: 201 })

  } catch (error) {
    console.error('댓글 작성 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 댓글 목록 조회
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
        parentId: null
      },
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
    })

    return NextResponse.json({
      success: true,
      comments
    })

  } catch (error) {
    console.error('댓글 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
