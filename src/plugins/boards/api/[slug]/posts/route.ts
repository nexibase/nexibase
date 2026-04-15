import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { sanitizeHtml } from '@/lib/sanitize'

// Fetch post list
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''

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

    if (!board.isActive) {
      return NextResponse.json(
        { error: '비활성화된 게시판입니다.' },
        { status: 403 }
      )
    }

    // Authorization check
    const user = await getAuthUser()
    if (board.listMemberOnly && !user) {
      return NextResponse.json(
        { error: '목록을 볼 권한이 없습니다. 로그인이 필요합니다.', requireLogin: true },
        { status: 403 }
      )
    }

    const limit = board.postsPerPage
    const skip = (page - 1) * limit

    // Search conditions
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

    // Sort conditions
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

    // In gallery mode, also fetch attachment info
    const includeAttachments = board.displayType === 'gallery'

    // Fetch post list
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
          // In gallery mode, use the first image as the thumbnail
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

    // Attach thumbnail info in gallery mode
    // Use thumbnailPath when available, otherwise fall back to filePath
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
    console.error('failed to fetch posts:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Attachment interface
interface AttachmentFile {
  filename: string
  storedName: string
  filePath: string
  thumbnailPath?: string | null
  fileSize: number
  mimeType: string
}

// Write post
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await request.json()
    const { title, content, isNotice, isSecret, attachments } = body

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

    if (!board.isActive) {
      return NextResponse.json(
        { error: '비활성화된 게시판입니다.' },
        { status: 403 }
      )
    }

    // Login and authorization check
    const user = await getAuthUser()

    // Member-only board: unauthenticated request
    if (board.writeMemberOnly && !user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // Even on a guest-friendly board, writing requires login
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // Validate required fields
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

    // IP address
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Create the post and attachments within a transaction
    const post = await prisma.$transaction(async (tx) => {
      // Create post
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

      // Save attachments if any
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

      // Update the board's post count
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
    console.error('failed to create post:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
