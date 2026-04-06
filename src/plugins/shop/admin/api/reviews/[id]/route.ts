import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 리뷰 답변 등록/수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const reviewId = parseInt(id)
    const body = await request.json()
    const { reply } = body

    // 리뷰 존재 확인
    const review = await prisma.productReview.findUnique({
      where: { id: reviewId }
    })

    if (!review) {
      return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 답변 등록/수정
    const updated = await prisma.productReview.update({
      where: { id: reviewId },
      data: {
        reply: reply?.trim() || null,
        repliedAt: reply?.trim() ? new Date() : null
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true }
        },
        user: {
          select: { id: true, nickname: true, email: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      review: {
        ...updated,
        images: updated.images ? JSON.parse(updated.images) : [],
        user: {
          ...updated.user,
          nickname: updated.user.nickname || '익명'
        }
      }
    })
  } catch (error) {
    console.error('리뷰 답변 에러:', error)
    return NextResponse.json({ error: '답변 등록에 실패했습니다.' }, { status: 500 })
  }
}

// 리뷰 삭제 (소프트 삭제) / 복구
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const { id } = await params
    const reviewId = parseInt(id)
    const { searchParams } = new URL(request.url)
    const restore = searchParams.get('restore') === 'true'

    const review = await prisma.productReview.findUnique({
      where: { id: reviewId }
    })

    if (!review) {
      return NextResponse.json({ error: '리뷰를 찾을 수 없습니다.' }, { status: 404 })
    }

    await prisma.productReview.update({
      where: { id: reviewId },
      data: { isActive: restore }
    })

    return NextResponse.json({
      success: true,
      message: restore ? '리뷰가 복구되었습니다.' : '리뷰가 삭제되었습니다.'
    })
  } catch (error) {
    console.error('리뷰 삭제/복구 에러:', error)
    return NextResponse.json({ error: '처리에 실패했습니다.' }, { status: 500 })
  }
}
