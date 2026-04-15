import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Fetch site stats
export async function GET() {
  try {
    const [memberCount, boardCount, postCount, commentCount] = await Promise.all([
      prisma.user.count({ where: { status: 'active' } }),
      prisma.board.count({ where: { isActive: true } }),
      prisma.post.count(),
      prisma.comment.count()
    ])

    return NextResponse.json({
      success: true,
      stats: {
        memberCount,
        boardCount,
        postCount,
        commentCount
      }
    })
  } catch (error) {
    console.error('failed to fetch stats:', error)
    return NextResponse.json(
      { error: '통계를 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
