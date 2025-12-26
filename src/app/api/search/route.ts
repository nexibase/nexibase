import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 통합 검색 API (게시글, 콘텐츠, 정책)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    const type = searchParams.get('type') || 'all' // all, posts, contents, policies
    const boardSlug = searchParams.get('board') || null
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sort = searchParams.get('sort') || 'relevance'

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: '검색어는 2자 이상 입력해주세요.' },
        { status: 400 }
      )
    }

    // 각 타입별 검색 결과
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      posts: { items: any[]; total: number }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      contents: { items: any[]; total: number }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      policies: { items: any[]; total: number }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products: { items: any[]; total: number }
    } = {
      posts: { items: [], total: 0 },
      contents: { items: [], total: 0 },
      policies: { items: [], total: 0 },
      products: { items: [], total: 0 }
    }

    // 게시글 검색
    if (type === 'all' || type === 'posts') {
      const postsResult = await searchPosts(query, page, limit, sort, boardSlug)
      results.posts = postsResult
    }

    // 콘텐츠 검색
    if (type === 'all' || type === 'contents') {
      const contentsResult = await searchContents(query, type === 'contents' ? page : 1, type === 'contents' ? limit : 5)
      results.contents = contentsResult
    }

    // 정책 검색
    if (type === 'all' || type === 'policies') {
      const policiesResult = await searchPolicies(query, type === 'policies' ? page : 1, type === 'policies' ? limit : 5)
      results.policies = policiesResult
    }

    // 상품 검색
    if (type === 'all' || type === 'products') {
      const productsResult = await searchProducts(query, type === 'products' ? page : 1, type === 'products' ? limit : 5)
      results.products = productsResult
    }

    // 전체 결과 수
    const totalAll = results.posts.total + results.contents.total + results.policies.total + results.products.total

    // 게시판 목록 (필터용)
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: { name: 'asc' }
    })

    // 현재 타입에 따른 페이지네이션
    let currentTotal = totalAll
    let currentTotalPages = 1
    if (type === 'posts') {
      currentTotal = results.posts.total
      currentTotalPages = Math.ceil(currentTotal / limit)
    } else if (type === 'contents') {
      currentTotal = results.contents.total
      currentTotalPages = Math.ceil(currentTotal / limit)
    } else if (type === 'policies') {
      currentTotal = results.policies.total
      currentTotalPages = Math.ceil(currentTotal / limit)
    } else if (type === 'products') {
      currentTotal = results.products.total
      currentTotalPages = Math.ceil(currentTotal / limit)
    }

    return NextResponse.json({
      success: true,
      query,
      type,
      results,
      counts: {
        all: totalAll,
        posts: results.posts.total,
        contents: results.contents.total,
        policies: results.policies.total,
        products: results.products.total
      },
      pagination: {
        page,
        limit,
        total: currentTotal,
        totalPages: currentTotalPages
      },
      boards
    })
  } catch (error) {
    console.error('검색 에러:', error)

    // 폴백 검색
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

// 게시글 검색 (FULLTEXT)
async function searchPosts(
  query: string,
  page: number,
  limit: number,
  sort: string,
  boardSlug: string | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ items: any[]; total: number }> {
  const offset = (page - 1) * limit
  const searchTerms = query.split(/\s+/).filter(term => term.length >= 2)
  const booleanQuery = searchTerms.length > 0
    ? searchTerms.map(term => `+${term}*`).join(' ')
    : `+${query}*`

  // 게시판 필터
  let boardId: number | null = null
  if (boardSlug) {
    const board = await prisma.board.findUnique({
      where: { slug: boardSlug },
      select: { id: true }
    })
    boardId = board?.id || null
  }

  try {
    // FULLTEXT 검색 시도
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
        ${boardId ? prisma.$queryRaw`AND p.boardId = ${boardId}` : prisma.$queryRaw``}
      ${sort === 'latest'
        ? prisma.$queryRaw`ORDER BY p.createdAt DESC`
        : sort === 'popular'
        ? prisma.$queryRaw`ORDER BY p.viewCount DESC, p.createdAt DESC`
        : prisma.$queryRaw`ORDER BY relevance DESC, p.createdAt DESC`
      }
      LIMIT ${limit}
      OFFSET ${offset}
    `

    const countResult = await prisma.$queryRaw<Array<{ total: bigint }>>`
      SELECT COUNT(*) as total
      FROM posts p
      INNER JOIN boards b ON p.boardId = b.id
      WHERE MATCH(p.title, p.content) AGAINST(${booleanQuery} IN BOOLEAN MODE)
        AND p.status = 'published'
        AND p.isSecret = false
        AND b.isActive = true
        ${boardId ? prisma.$queryRaw`AND p.boardId = ${boardId}` : prisma.$queryRaw``}
    `

    const total = Number(countResult[0]?.total || 0)

    const items = posts.map(post => ({
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

    return { items, total }
  } catch {
    // FULLTEXT 실패 시 LIKE 검색
    return searchPostsLike(query, page, limit, sort, boardSlug)
  }
}

// 게시글 LIKE 검색 (폴백)
async function searchPostsLike(
  query: string,
  page: number,
  limit: number,
  sort: string,
  boardSlug: string | null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ items: any[]; total: number }> {
  const skip = (page - 1) * limit

  const boardFilter = boardSlug
    ? { board: { slug: boardSlug, isActive: true } }
    : { board: { isActive: true } }

  const orderBy = sort === 'popular'
    ? [{ viewCount: 'desc' as const }, { createdAt: 'desc' as const }]
    : [{ createdAt: 'desc' as const }]

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
          select: { id: true, nickname: true }
        },
        board: {
          select: { id: true, slug: true, name: true }
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

  const items = posts.map(post => ({
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

  return { items, total }
}

// 콘텐츠 검색
async function searchContents(
  query: string,
  page: number,
  limit: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ items: any[]; total: number }> {
  const skip = (page - 1) * limit

  const [contents, total] = await Promise.all([
    prisma.content.findMany({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { isPublic: true }
        ]
      },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.content.count({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { isPublic: true }
        ]
      }
    })
  ])

  const items = contents.map(content => ({
    id: content.id,
    slug: content.slug,
    title: content.title,
    excerpt: content.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
    updatedAt: content.updatedAt
  }))

  return { items, total }
}

// 정책 검색
async function searchPolicies(
  query: string,
  page: number,
  limit: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ items: any[]; total: number }> {
  const skip = (page - 1) * limit

  const [policies, total] = await Promise.all([
    prisma.policy.findMany({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { isActive: true }
        ]
      },
      select: {
        id: true,
        slug: true,
        version: true,
        title: true,
        content: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.policy.count({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { isActive: true }
        ]
      }
    })
  ])

  const items = policies.map(policy => ({
    id: policy.id,
    slug: policy.slug,
    version: policy.version,
    title: policy.title,
    excerpt: policy.content.replace(/<[^>]*>/g, '').substring(0, 150) + '...',
    updatedAt: policy.updatedAt
  }))

  return { items, total }
}

// 상품 검색
async function searchProducts(
  query: string,
  page: number,
  limit: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ items: any[]; total: number }> {
  const skip = (page - 1) * limit

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { isActive: true }
        ]
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        originPrice: true,
        images: true,
        isSoldOut: true,
        category: {
          select: { id: true, name: true, slug: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.product.count({
      where: {
        AND: [
          {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { content: { contains: query } }
            ]
          },
          { isActive: true }
        ]
      }
    })
  ])

  const items = products.map(product => {
    // 이미지 목록에서 첫번째 이미지 추출
    let thumbnail = null
    if (product.images) {
      try {
        const images = JSON.parse(product.images)
        thumbnail = Array.isArray(images) && images.length > 0 ? images[0] : null
      } catch {
        thumbnail = null
      }
    }

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      originPrice: product.originPrice,
      thumbnail,
      isSoldOut: product.isSoldOut,
      category: product.category
    }
  })

  return { items, total }
}

// 폴백 검색 (전체)
async function fallbackSearch(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.trim()
  const type = searchParams.get('type') || 'all'
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    posts: { items: any[]; total: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contents: { items: any[]; total: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    policies: { items: any[]; total: number }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    products: { items: any[]; total: number }
  } = {
    posts: { items: [], total: 0 },
    contents: { items: [], total: 0 },
    policies: { items: [], total: 0 },
    products: { items: [], total: 0 }
  }

  if (type === 'all' || type === 'posts') {
    results.posts = await searchPostsLike(query, page, limit, sort, boardSlug)
  }

  if (type === 'all' || type === 'contents') {
    results.contents = await searchContents(query, type === 'contents' ? page : 1, type === 'contents' ? limit : 5)
  }

  if (type === 'all' || type === 'policies') {
    results.policies = await searchPolicies(query, type === 'policies' ? page : 1, type === 'policies' ? limit : 5)
  }

  if (type === 'all' || type === 'products') {
    results.products = await searchProducts(query, type === 'products' ? page : 1, type === 'products' ? limit : 5)
  }

  const totalAll = results.posts.total + results.contents.total + results.policies.total + results.products.total

  const boards = await prisma.board.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' }
  })

  let currentTotal = totalAll
  let currentTotalPages = 1
  if (type === 'posts') {
    currentTotal = results.posts.total
    currentTotalPages = Math.ceil(currentTotal / limit)
  } else if (type === 'contents') {
    currentTotal = results.contents.total
    currentTotalPages = Math.ceil(currentTotal / limit)
  } else if (type === 'policies') {
    currentTotal = results.policies.total
    currentTotalPages = Math.ceil(currentTotal / limit)
  } else if (type === 'products') {
    currentTotal = results.products.total
    currentTotalPages = Math.ceil(currentTotal / limit)
  }

  return NextResponse.json({
    success: true,
    query,
    type,
    results,
    counts: {
      all: totalAll,
      posts: results.posts.total,
      contents: results.contents.total,
      policies: results.policies.total,
      products: results.products.total
    },
    pagination: {
      page,
      limit,
      total: currentTotal,
      totalPages: currentTotalPages
    },
    boards,
    searchMode: 'fallback'
  })
}
