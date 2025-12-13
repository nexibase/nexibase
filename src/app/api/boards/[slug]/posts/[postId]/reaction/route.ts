import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateId } from '@/lib/id'

// 허용된 리액션 타입 (긍정적인 것만)
const REACTION_TYPES = ['like', 'haha', 'agree', 'thanks', 'wow'] as const
type ReactionType = typeof REACTION_TYPES[number]

// 사용자 정보 확인 헬퍼
async function getUser(request: NextRequest): Promise<{ userId: string | null }> {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return { userId: null }

  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: {
      user: {
        select: { id: true }
      }
    }
  })

  if (!session || new Date() > session.expires) {
    return { userId: null }
  }

  return { userId: session.user.id }
}

// 리액션 조회 (GET)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { postId } = await params

    // 사용자 확인
    const { userId } = await getUser(request)

    // 리액션 집계
    const reactions = await prisma.reaction.groupBy({
      by: ['type'],
      where: { postId },
      _count: { type: true }
    })

    // 사용자의 리액션 조회
    let userReactions: string[] = []
    if (userId) {
      const userReactionRecords = await prisma.reaction.findMany({
        where: { postId, userId },
        select: { type: true }
      })
      userReactions = userReactionRecords.map(r => r.type)
    }

    // 결과 포맷팅
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
    console.error('리액션 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 리액션 토글 (POST)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { slug, postId } = await params
    const body = await request.json()
    const { type = 'like' } = body

    // 유효한 리액션 타입인지 확인
    if (!REACTION_TYPES.includes(type as ReactionType)) {
      return NextResponse.json(
        { error: '유효하지 않은 리액션 타입입니다.' },
        { status: 400 }
      )
    }

    // 로그인 확인
    const { userId } = await getUser(request)
    if (!userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 게시판 정보 조회
    const board = await prisma.board.findUnique({
      where: { slug }
    })

    if (!board) {
      return NextResponse.json(
        { error: '게시판을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 반응 기능 확인
    if (!board.useReaction) {
      return NextResponse.json(
        { error: '이 게시판은 반응 기능을 사용하지 않습니다.' },
        { status: 400 }
      )
    }

    // 게시글 확인
    const post = await prisma.post.findUnique({
      where: { id: postId }
    })

    if (!post || post.status !== 'published') {
      return NextResponse.json(
        { error: '게시글을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 기존 반응 확인 (같은 타입)
    const existingReaction = await prisma.reaction.findFirst({
      where: {
        userId,
        postId,
        type
      }
    })

    let reacted = false

    if (existingReaction) {
      // 이미 반응이 있으면 취소
      await prisma.reaction.delete({
        where: { id: existingReaction.id }
      })

      // likeCount 업데이트 (모든 리액션 타입)
      await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { decrement: 1 } }
      })
    } else {
      // 반응 추가
      await prisma.reaction.create({
        data: {
          id: generateId(),
          type,
          userId,
          postId
        }
      })

      // likeCount 업데이트 (모든 리액션 타입)
      await prisma.post.update({
        where: { id: postId },
        data: { likeCount: { increment: 1 } }
      })

      reacted = true
    }

    // 업데이트된 리액션 정보 조회
    const reactions = await prisma.reaction.groupBy({
      by: ['type'],
      where: { postId },
      _count: { type: true }
    })

    const userReactionRecords = await prisma.reaction.findMany({
      where: { postId, userId },
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
    console.error('반응 처리 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
