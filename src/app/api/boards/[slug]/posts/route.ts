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

  // 관리자는 최대 레벨
  if (session.user.role === 'admin') {
    return { userId: session.user.id, level: 99 }
  }

  return { userId: session.user.id, level: session.user.level }
}

// 게시글 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''

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

    if (!board.isActive) {
      return NextResponse.json(
        { error: '비활성화된 게시판입니다.' },
        { status: 403 }
      )
    }

    // 권한 확인
    const { level } = await getUserLevel(request)
    if (level < board.listLevel) {
      return NextResponse.json(
        { error: '목록을 볼 권한이 없습니다.', requiredLevel: board.listLevel },
        { status: 403 }
      )
    }

    const limit = board.postsPerPage
    const skip = (page - 1) * limit

    // 검색 조건
    const where: Record<string, unknown> = {
      boardId: board.id,
      status: 'published'
    }

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { content: { contains: search } }
      ]
    }

    // 정렬 조건
    let orderBy: Record<string, string>[] = []
    switch (board.sortOrder) {
      case 'popular':
        orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }]
        break
      case 'oldest':
        orderBy = [{ createdAt: 'asc' }]
        break
      default:
        orderBy = [{ isNotice: 'desc' }, { createdAt: 'desc' }]
    }

    // 게시글 목록 조회
    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: {
          id: true,
          title: true,
          status: true,
          isNotice: true,
          isSecret: true,
          viewCount: true,
          likeCount: true,
          commentCount: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              nickname: true,
              name: true,
              image: true
            }
          }
        }
      }),
      prisma.post.count({ where })
    ])

    return NextResponse.json({
      success: true,
      board: {
        id: board.id,
        slug: board.slug,
        name: board.name,
        description: board.description,
        writeLevel: board.writeLevel,
        useComment: board.useComment,
        useReaction: board.useReaction
      },
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('게시글 목록 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 게시글 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { title, content, isNotice, isSecret } = body

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

    if (!board.isActive) {
      return NextResponse.json(
        { error: '비활성화된 게시판입니다.' },
        { status: 403 }
      )
    }

    // 로그인 및 권한 확인
    const { userId, level } = await getUserLevel(request)
    if (!userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    if (level < board.writeLevel) {
      return NextResponse.json(
        { error: '글을 작성할 권한이 없습니다.', requiredLevel: board.writeLevel },
        { status: 403 }
      )
    }

    // 필수 필드 검증
    if (!title?.trim()) {
      return NextResponse.json(
        { error: '제목을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: '내용을 입력해주세요.' },
        { status: 400 }
      )
    }

    // IP 주소
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // 게시글 생성
    const post = await prisma.post.create({
      data: {
        boardId: board.id,
        authorId: userId,
        title: title.trim(),
        content: content.trim(),
        isNotice: isNotice && level >= 9, // 레벨 9 이상만 공지 가능
        isSecret: isSecret && board.useSecret,
        ip
      },
      select: {
        id: true,
        title: true,
        createdAt: true
      }
    })

    // 게시판 글 수 업데이트
    await prisma.board.update({
      where: { id: board.id },
      data: { postCount: { increment: 1 } }
    })

    return NextResponse.json({
      success: true,
      message: '게시글이 작성되었습니다.',
      post
    }, { status: 201 })

  } catch (error) {
    console.error('게시글 작성 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
