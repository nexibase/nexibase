import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

// Allowed reaction types (positive only)
const REACTION_TYPES = ['like', 'haha', 'agree', 'thanks', 'wow'] as const
type ReactionType = typeof REACTION_TYPES[number]

// Fetch comment reactions (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string; commentId: string }> }
) {
  try {
    const { commentId: commentIdParam } = await params
    const commentId = parseInt(commentIdParam)

    // User check
    const user = await getAuthUser()

    // Aggregate reactions
    const reactions = await prisma.reaction.groupBy({
      by: ['type'],
      where: { commentId },
      _count: { type: true }
    })

    // Fetch the user's reaction
    let userReactions: string[] = []
    if (user) {
      const userReactionRecords = await prisma.reaction.findMany({
        where: { commentId, userId: user.id },
        select: { type: true }
      })
      userReactions = userReactionRecords.map(r => r.type)
    }

    // Format the result
    const reactionCounts: Record<string, number> = {}
    for (const r of reactions) {
      reactionCounts[r.type] = r._count.type
    }

    return NextResponse.json({
      success: true,
      reactions: reactionCounts,
      userReactions,
      total: Object.values(reactionCounts).reduce((a, b) => a + b, 0)
    })

  } catch (error) {
    console.error('failed to fetch comment reactions:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// Toggle comment reaction (POST)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string; commentId: string }> }
) {
  try {
    const { slug, commentId: commentIdParam } = await params
    const commentId = parseInt(commentIdParam)
    const body = await request.json()
    const { type = 'like' } = body

    // Ensure the reaction type is valid
    if (!REACTION_TYPES.includes(type as ReactionType)) {
      return NextResponse.json(
        { error: '유효하지 않은 리액션 타입입니다.' },
        { status: 400 }
      )
    }

    // Login check
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

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

    // Check whether reactions are enabled
    if (!board.useReaction) {
      return NextResponse.json(
        { error: '이 게시판은 반응 기능을 사용하지 않습니다.' },
        { status: 400 }
      )
    }

    // Comment check
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    })

    if (!comment || comment.status !== 'published') {
      return NextResponse.json(
        { error: '댓글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Check for an existing reaction of the same type
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        userId: user.id,
        commentId,
        type
      }
    })

    let reacted = false

    if (existingReaction) {
      // If the reaction already exists, remove it
      await prisma.reaction.delete({
        where: { id: existingReaction.id }
      })

      // Update likeCount (only for the "like" type)
      if (type === 'like') {
        await prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } }
        })
      }
    } else {
      // Add reaction
      await prisma.reaction.create({
        data: {
          type,
          userId: user.id,
          commentId
        }
      })

      // Update likeCount (only for the "like" type)
      if (type === 'like') {
        await prisma.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } }
        })
      }

      reacted = true
    }

    // Fetch the updated reaction info
    const reactions = await prisma.reaction.groupBy({
      by: ['type'],
      where: { commentId },
      _count: { type: true }
    })

    const userReactionRecords = await prisma.reaction.findMany({
      where: { commentId, userId: user.id },
      select: { type: true }
    })

    const reactionCounts: Record<string, number> = {}
    for (const r of reactions) {
      reactionCounts[r.type] = r._count.type
    }

    return NextResponse.json({
      success: true,
      reacted,
      type,
      reactions: reactionCounts,
      userReactions: userReactionRecords.map(r => r.type),
      total: Object.values(reactionCounts).reduce((a, b) => a + b, 0)
    })

  } catch (error) {
    console.error('failed to process comment reaction:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
