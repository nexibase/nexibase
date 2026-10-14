import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Default board data
const DEFAULT_BOARDS = [
  {
    slug: 'free',
    name: '자유게시판',
    description: '자유롭게 이야기를 나누는 공간입니다.',
    category: 'community',
    listMemberOnly: false,
    readMemberOnly: false,
    writeMemberOnly: true,
    commentMemberOnly: true,
    useComment: true,
    useReaction: true,
    useFile: true,
    useSecret: false,
    postsPerPage: 20,
    sortOrder: 'latest',
    isActive: true,
  },
  {
    slug: 'notice',
    name: '공지사항',
    description: '중요한 공지사항을 확인하세요.',
    category: 'notice',
    listMemberOnly: false,
    readMemberOnly: false,
    writeMemberOnly: true, // 관리자만 쓸 수 있도록 별도 처리 필요
    commentMemberOnly: true,
    useComment: true,
    useReaction: true,
    useFile: true,
    useSecret: false,
    postsPerPage: 20,
    sortOrder: 'latest',
    isActive: true,
  },
  {
    slug: 'qa',
    name: '문의게시판',
    description: '궁금한 점을 문의해주세요.',
    category: 'support',
    listMemberOnly: false,
    readMemberOnly: false,
    writeMemberOnly: true,
    commentMemberOnly: true,
    useComment: true,
    useReaction: false,
    useFile: true,
    useSecret: true,
    postsPerPage: 20,
    sortOrder: 'latest',
    isActive: true,
  },
]

// Create default boards
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    // Check for an existing board slug
    const existingSlugs = await prisma.board.findMany({
      where: {
        slug: { in: DEFAULT_BOARDS.map(b => b.slug) }
      },
      select: { slug: true }
    })

    const existingSlugSet = new Set(existingSlugs.map(b => b.slug))

    // Only create boards that do not already exist
    const boardsToCreate = DEFAULT_BOARDS.filter(b => !existingSlugSet.has(b.slug))

    if (boardsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 기본 게시판이 이미 존재합니다.',
        created: 0
      })
    }

    // Create board
    const result = await prisma.board.createMany({
      data: boardsToCreate
    })

    return NextResponse.json({
      success: true,
      message: `${result.count}개의 기본 게시판이 생성되었습니다.`,
      created: result.count,
      boards: boardsToCreate.map(b => b.name)
    })

  } catch (error) {
    console.error('failed to create default boards:', error)
    return NextResponse.json(
      { error: '기본 게시판 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
