import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { sanitizeHtml } from '@/lib/sanitize'

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
    const user = await getAuthUser()
    if (board.listMemberOnly && !user) {
      return NextResponse.json(
        { error: '목록을 볼 권한이 없습니다. 로그인이 필요합니다.', requireLogin: true },
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

    // 갤러리 형식이면 첨부파일 정보도 함께 조회
    const includeAttachments = board.displayType === 'gallery'

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
              uuid: true,
              nickname: true,
              image: true
            }
          },
          _count: {
            select: { attachments: true }
          },
          // 갤러리 형식이면 첫 번째 이미지를 썸네일로 사용
          ...(includeAttachments && {
            attachments: {
              where: {
                mimeType: { startsWith: 'image/' }
              },
              take: 1,
              orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              select: {
                id: true,
                filePath: true,
                thumbnailPath: true,
                mimeType: true
              }
            }
          })
        }
      }),
      prisma.post.count({ where })
    ])

    // 갤러리 형식일 때 썸네일 정보 추가
    // thumbnailPath가 있으면 사용, 없으면 원본 filePath 사용
    const postsWithThumbnail = includeAttachments
      ? posts.map(post => {
          const attachment = (post as { attachments?: { filePath: string; thumbnailPath?: string | null }[] }).attachments?.[0]
          return {
            ...post,
            thumbnail: attachment?.thumbnailPath || attachment?.filePath || null,
            attachments: undefined // 불필요한 배열 제거
          }
        })
      : posts

    return NextResponse.json({
      success: true,
      board: {
        id: board.id,
        slug: board.slug,
        name: board.name,
        description: board.description,
        writeMemberOnly: board.writeMemberOnly,
        useComment: board.useComment,
        useReaction: board.useReaction,
        displayType: board.displayType
      },
      posts: postsWithThumbnail,
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

// 첨부파일 인터페이스
interface AttachmentFile {
  filename: string
  storedName: string
  filePath: string
  thumbnailPath?: string | null
  fileSize: number
  mimeType: string
}

// 게시글 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { title, content, isNotice, isSecret, attachments } = body

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
    const user = await getAuthUser()

    // 회원전용 게시판에서 비로그인 시
    if (board.writeMemberOnly && !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 비회원 게시판이더라도 글 작성 시에는 로그인 필요
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
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

    // 게시글 생성 + 첨부파일을 트랜잭션으로 처리
    const post = await prisma.$transaction(async (tx) => {
      // 게시글 생성
      const newPost = await tx.post.create({
        data: {
          boardId: board.id,
          authorId: user.id,
          title: title.trim(),
          content: sanitizeHtml(content.trim()),
          isNotice: isNotice && user.role === 'admin', // 관리자만 공지 가능
          isSecret: isSecret && board.useSecret,
          ip
        },
        select: {
          id: true,
          title: true,
          createdAt: true
        }
      })

      // 첨부파일이 있으면 저장
      if (attachments && Array.isArray(attachments) && attachments.length > 0 && board.useFile) {
        await tx.postAttachment.createMany({
          data: (attachments as AttachmentFile[]).map(file => ({
            postId: newPost.id,
            filename: file.filename,
            storedName: file.storedName,
            filePath: file.filePath,
            thumbnailPath: file.thumbnailPath || null,
            fileSize: file.fileSize,
            mimeType: file.mimeType
          }))
        })
      }

      // 게시판 글 수 업데이트
      await tx.board.update({
        where: { id: board.id },
        data: { postCount: { increment: 1 } }
      })

      return newPost
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
