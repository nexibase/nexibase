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

    // Base filter shared by notice and regular queries
    const baseWhere: Record<string, unknown> = {
      boardId: board.id,
      status: 'published',
    }

    const searchFilter: Record<string, unknown> = search
      ? {
          OR: [
            { title: { contains: search } },
            { content: { contains: search } },
          ],
        }
      : {}

    // Non-notice sort (notice sort field is dropped because notices are fetched separately)
    let orderBy: Record<string, string>[] = []
    switch (board.sortOrder) {
      case 'popular':
        orderBy = [{ viewCount: 'desc' }, { createdAt: 'desc' }]
        break
      case 'oldest':
        orderBy = [{ createdAt: 'asc' }]
        break
      default:
        orderBy = [{ createdAt: 'desc' }]
    }

    // In gallery mode, also fetch attachment info
    const includeAttachments = board.displayType === 'gallery'

    const postSelect = {
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
          image: true,
        },
      },
      _count: {
        select: { attachments: true },
      },
      ...(includeAttachments && {
        attachments: {
          where: { mimeType: { startsWith: 'image/' } },
          take: 1,
          orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
          select: {
            id: true,
            filePath: true,
            thumbnailPath: true,
            mimeType: true,
          },
        },
      }),
    }

    const noticeWhere = { ...baseWhere, isNotice: true }
    const postWhere = { ...baseWhere, isNotice: false, ...searchFilter }

    const [notices, posts, total] = await Promise.all([
      prisma.post.findMany({
        where: noticeWhere,
        orderBy: [{ createdAt: 'desc' }],
        select: postSelect,
      }),
      prisma.post.findMany({
        where: postWhere,
        skip,
        take: limit,
        orderBy,
        select: postSelect,
      }),
      prisma.post.count({ where: postWhere }),
    ])

    // Attach thumbnail info in gallery mode (applies to both arrays)
    const attachThumbnail = <T extends { attachments?: { filePath: string; thumbnailPath?: string | null }[] }>(list: T[]) =>
      list.map(p => {
        const attachment = p.attachments?.[0]
        return {
          ...p,
          thumbnail: attachment?.thumbnailPath || attachment?.filePath || null,
          attachments: undefined,
        }
      })

    const finalNotices = includeAttachments ? attachThumbnail(notices as never) : notices
    const finalPosts   = includeAttachments ? attachThumbnail(posts as never)   : posts

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
        postsPerPage: board.postsPerPage,
        displayType: board.displayType,
        showPostNumber: board.showPostNumber,
      },
      notices: finalNotices,
      posts: finalPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
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
