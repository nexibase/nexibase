import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Sync reaction counts (POST)
export async function POST() {
  try {
    // Admin check
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403 }
      )
    }

    // Compute reaction counts for every post
    const posts = await prisma.post.findMany({
      select: { id: true }
    })

    let updated = 0

    for (const post of posts) {
      // Compute reaction counts for the given post
      const reactionCount = await prisma.reaction.count({
        where: { postId: post.id }
      })

      // Update likeCount
      await prisma.post.update({
        where: { id: post.id },
        data: { likeCount: reactionCount }
      })

      updated++
    }

    return NextResponse.json({
      success: true,
      message: `${updated}개 게시글의 리액션 수가 동기화되었습니다.`
    })

  } catch (error) {
    console.error('failed to sync reactions:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
