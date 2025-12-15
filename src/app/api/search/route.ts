import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// FULLTEXT 검색 API
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const boardSlug = searchParams.get('board') || null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sort = searchParams.get('sort') || 'relevance' // relevance, latest, popular

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: '검색어는 2자 이상 입력해주세요.' },
        { status: 400 }
      )
    }

    const offset = (page - 1) * limit

    // 게시판 필터 조건
    let boardCondition = ''
    if (boardSlug) {
      const board = await prisma.board.findUnique({
        where: { slug: boardSlug },
        select: { id: true }
      })
      if (board) {
        boardCondition = `AND p.boardId = ${board.id}`
      }
    }

    // 정렬 조건
    let orderBy = ''
    switch (sort) {
      case 'latest':
        orderBy = 'ORDER BY p.createdAt DESC'
        break
      case 'popular':
        orderBy = 'ORDER BY p.viewCount DESC, p.createdAt DESC'
        break
      case 'relevance':
      default:
        orderBy = 'ORDER BY relevance DESC, p.createdAt DESC'
        break
    }

    // MySQL FULLTEXT 검색 (자연어 모드)
    // 검색어를 + 로 연결하여 boolean 모드로 검색
    const searchTerms = query.split(/\s+/).filter(term => term.length >= 2)
    const booleanQuery = searchTerms.map(term => `+${term}*`).join(' ')

    // 검색 결과 조회
    const posts = await prisma.$queryRaw<Array<{
      id: number
      title: string
      content: string
      viewCount: number
      likeCount: number
      commentCount: number
      createdAt: Date
      authorId: number
      authorNickname: string | null
      authorName: string | null
      boardId: number
      boardSlug: string
      boardName: string
      relevance: number
    }>>`
      SELECT
        p.id,
        p.title,
        SUBSTRING(p.content, 1, 200) as content,
        p.viewCount,
        p.likeCount,
        p.commentCount,
        p.createdAt,
        p.authorId,
        u.nickname as authorNickname,
        u.name as authorName,
        p.boardId,
        b.slug as boardSlug,
        b.name as boardName,
        MATCH(p.title, p.content) AGAINST(${booleanQuery} IN BOOLEAN MODE) as relevance
      FROM posts p
      INNER JOIN users u ON p.authorId = u.id
      INNER JOIN boards b ON p.boardId = b.id
      WHERE MATCH(p.title, p.content) AGAINST(${booleanQuery} IN BOOLEAN MODE)
        AND p.status = 'published'
        AND p.isSecret = false
        AND b.isActive = true
        ${boardCondition ? prisma.$queryRaw`${boardCondition}` : prisma.$queryRaw``}
      ${sort === 'latest'
        ? prisma.$queryRaw`ORDER BY p.createdAt DESC`
        : sort === 'popular'
        ? prisma.$queryRaw`ORDER BY p.viewCount DESC, p.createdAt DESC`
        : prisma.$queryRaw`ORDER BY relevance DESC, p.createdAt DESC`
      }
      LIMIT ${limit}
      OFFSET ${offset}
    `

    // 총 검색 결과 수
    const countResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) as total
      FROM posts p
      INNER JOIN boards b ON p.boardId = b.id
      WHERE MATCH(p.title, p.content) AGAINST(${booleanQuery} IN BOOLEAN MODE)
        AND p.status = 'published'
        AND p.isSecret = false
        AND b.isActive = true
        ${boardCondition ? prisma.$queryRaw`${boardCondition}` : prisma.$queryRaw``}
    `

    const total = Number(countResult[0]?.total || 0)
    const totalPages = Math.ceil(total / limit)

    // 결과 포맷팅
    const formattedPosts = posts.map(post => ({
      id: post.id,
      title: post.title,
      excerpt: post.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
      viewCount: post.viewCount,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      createdAt: post.createdAt,
      author: {
        id: post.authorId,
        nickname: post.authorNickname,
        name: post.authorName
      },
      board: {
        id: post.boardId,
        slug: post.boardSlug,
        name: post.boardName
      }
    }))

    // 검색 가능한 게시판 목록
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      success: true,
      query,
      posts: formattedPosts,
      pagination: {
        page,
        limit,
        total,
        totalPages
      },
      boards
    })
  } catch (error) {
    console.error('검색 에러:', error)

    // FULLTEXT 인덱스가 없는 경우 LIKE 검색으로 폴백
    try {
      return await fallbackSearch(request)
    } catch (fallbackError) {
      console.error('폴백 검색 에러:', fallbackError)
      return NextResponse.json(
        { error: '검색 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
  }
}

// FULLTEXT 인덱스가 없을 때 LIKE 검색 폴백
async function fallbackSearch(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const boardSlug = searchParams.get('board') || null
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const sort = searchParams.get('sort') || 'latest'

  if (!query || query.length < 2) {
    return NextResponse.json(
      { error: '검색어는 2자 이상 입력해주세요.' },
      { status: 400 }
    )
  }

  const skip = (page - 1) * limit

  // 게시판 필터
  const boardFilter = boardSlug
    ? { board: { slug: boardSlug, isActive: true } }
    : { board: { isActive: true } }

  // 정렬 조건
  const orderBy = sort === 'popular'
    ? [{ viewCount: 'desc' as const }, { createdAt: 'desc' as const }]
    : [{ createdAt: 'desc' as const }]

  // LIKE 검색
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { status: 'published' },
          { isSecret: false },
          boardFilter
        ]
      },
      select: {
        id: true,
        title: true,
        content: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            nickname: true,
            name: true
          }
        },
        board: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      },
      orderBy,
      skip,
      take: limit
    }),
    prisma.post.count({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { status: 'published' },
          { isSecret: false },
          boardFilter
        ]
      }
    })
  ])

  const totalPages = Math.ceil(total / limit)

  const formattedPosts = posts.map(post => ({
    id: post.id,
    title: post.title,
    excerpt: post.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
    viewCount: post.viewCount,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    author: post.author,
    board: post.board
  }))

  const boards = await prisma.board.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' }
  })

  return NextResponse.json({
    success: true,
    query,
    posts: formattedPosts,
    pagination: {
      page,
      limit,
      total,
      totalPages
    },
    boards,
    searchMode: 'fallback' // LIKE 검색 사용 표시
  })
}
