import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Fetch the public board list (active boards only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    const boards = await prisma.board.findMany({
      where: {
        isActive: true
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        category: true,
        postCount: true
      },
      orderBy: { createdAt: 'asc' },
      take: limit
    })

    return NextResponse.json({ boards })
  } catch (error) {
    console.error('failed to fetch boards:', error)
    return NextResponse.json(
      { error: '게시판 목록을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
