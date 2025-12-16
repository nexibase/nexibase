import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// Q&A 답변 등록/수정
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
    const qnaId = parseInt(id)
    const body = await request.json()
    const { answer } = body

    if (!answer || answer.trim().length === 0) {
      return NextResponse.json({ error: '답변 내용을 입력해주세요.' }, { status: 400 })
    }

    // Q&A 존재 확인
    const qna = await prisma.productQna.findUnique({
      where: { id: qnaId }
    })

    if (!qna) {
      return NextResponse.json({ error: 'Q&A를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 답변 등록
    const updated = await prisma.productQna.update({
      where: { id: qnaId },
      data: {
        answer: answer.trim(),
        answeredAt: new Date()
      },
      include: {
        product: {
          select: { id: true, name: true, slug: true }
        },
        user: {
          select: { id: true, name: true, nickname: true, email: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      qna: {
        ...updated,
        user: {
          ...updated.user,
          name: updated.user.nickname || updated.user.name || '익명'
        }
      }
    })
  } catch (error) {
    console.error('Q&A 답변 에러:', error)
    return NextResponse.json({ error: '답변 등록에 실패했습니다.' }, { status: 500 })
  }
}

// Q&A 삭제 (비활성화)
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
    const qnaId = parseInt(id)

    await prisma.productQna.update({
      where: { id: qnaId },
      data: { isActive: false }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Q&A 삭제 에러:', error)
    return NextResponse.json({ error: 'Q&A 삭제에 실패했습니다.' }, { status: 500 })
  }
}
