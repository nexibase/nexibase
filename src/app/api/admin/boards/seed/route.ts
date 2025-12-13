import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 기본 게시판 데이터
const DEFAULT_BOARDS = [
  {
    slug: 'free',
    name: '자유게시판',
    description: '자유롭게 이야기를 나누는 공간입니다.',
    category: 'community',
    listLevel: 0,
    readLevel: 0,
    writeLevel: 1,
    commentLevel: 1,
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
    listLevel: 0,
    readLevel: 0,
    writeLevel: 9,
    commentLevel: 1,
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
    listLevel: 0,
    readLevel: 0,
    writeLevel: 1,
    commentLevel: 1,
    useComment: true,
    useReaction: false,
    useFile: true,
    useSecret: true,
    postsPerPage: 20,
    sortOrder: 'latest',
    isActive: true,
  },
]

// 기본 게시판 생성
export async function POST() {
  try {
    // 이미 존재하는 게시판 slug 확인
    const existingSlugs = await prisma.board.findMany({
      where: {
        slug: { in: DEFAULT_BOARDS.map(b => b.slug) }
      },
      select: { slug: true }
    })

    const existingSlugSet = new Set(existingSlugs.map(b => b.slug))

    // 존재하지 않는 게시판만 생성
    const boardsToCreate = DEFAULT_BOARDS.filter(b => !existingSlugSet.has(b.slug))

    if (boardsToCreate.length === 0) {
      return NextResponse.json({
        success: true,
        message: '모든 기본 게시판이 이미 존재합니다.',
        created: 0
      })
    }

    // 게시판 생성
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
    console.error('기본 게시판 생성 에러:', error)
    return NextResponse.json(
      { error: '기본 게시판 생성에 실패했습니다.' },
      { status: 500 }
    )
  }
}
