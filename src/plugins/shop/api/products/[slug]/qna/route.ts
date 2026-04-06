import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 상품 Q&A 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const skip = (page - 1) * limit

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Q&A 조회
    const [qnas, total] = await Promise.all([
      prisma.productQna.findMany({
        where: {
          productId: product.id,
          isActive: true
        },
        include: {
          user: {
            select: { id: true, nickname: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.productQna.count({
        where: {
          productId: product.id,
          isActive: true
        }
      })
    ])

    // 비밀글 처리: 본인 또는 관리자만 내용 볼 수 있음
    const currentUserId = session ? session.id : null
    const processedQnas = qnas.map(qna => {
      const isOwner = currentUserId !== null && currentUserId === qna.userId
      const isAdmin = session && session.role === 'admin'
      const canView = !qna.isSecret || isOwner || isAdmin

      return {
        ...qna,
        question: canView ? qna.question : '비밀글입니다.',
        answer: canView ? qna.answer : (qna.answer ? '비밀 답변입니다.' : null),
        user: {
          ...qna.user,
          nickname: maskName(qna.user.nickname || '익명')
        },
        canView,
        isOwner
      }
    })

    return NextResponse.json({
      qnas: processedQnas,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Q&A 목록 조회 에러:', error)
    return NextResponse.json({ error: 'Q&A를 불러오는데 실패했습니다.' }, { status: 500 })
  }
}

// Q&A 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { question, isSecret } = body

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 })
    }

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Q&A 생성
    const qna = await prisma.productQna.create({
      data: {
        productId: product.id,
        userId: session.id,
        question: question.trim(),
        isSecret: !!isSecret
      },
      include: {
        user: {
          select: { id: true, nickname: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      qna: {
        ...qna,
        user: {
          ...qna.user,
          nickname: maskName(qna.user.nickname || '익명')
        },
        canView: true,
        isOwner: true
      }
    })
  } catch (error) {
    console.error('Q&A 작성 에러:', error)
    return NextResponse.json({ error: 'Q&A 작성에 실패했습니다.' }, { status: 500 })
  }
}

// Q&A 수정 (답변 전에만 가능)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const body = await request.json()
    const { qnaId, question, isSecret } = body

    if (!qnaId) {
      return NextResponse.json({ error: 'Q&A ID가 필요합니다.' }, { status: 400 })
    }

    if (!question || question.trim().length === 0) {
      return NextResponse.json({ error: '질문 내용을 입력해주세요.' }, { status: 400 })
    }

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Q&A 찾기
    const qna = await prisma.productQna.findUnique({
      where: { id: qnaId }
    })

    if (!qna || qna.productId !== product.id) {
      return NextResponse.json({ error: 'Q&A를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 확인
    if (qna.userId !== session.id) {
      return NextResponse.json({ error: '본인의 Q&A만 수정할 수 있습니다.' }, { status: 403 })
    }

    // 답변이 있으면 수정 불가
    if (qna.answer) {
      return NextResponse.json({ error: '답변이 등록된 Q&A는 수정할 수 없습니다.' }, { status: 400 })
    }

    // 수정
    const updatedQna = await prisma.productQna.update({
      where: { id: qnaId },
      data: {
        question: question.trim(),
        isSecret: !!isSecret
      },
      include: {
        user: {
          select: { id: true, nickname: true }
        }
      }
    })

    return NextResponse.json({
      success: true,
      qna: {
        ...updatedQna,
        user: {
          ...updatedQna.user,
          nickname: maskName(updatedQna.user.nickname || '익명')
        },
        canView: true,
        isOwner: true
      }
    })
  } catch (error) {
    console.error('Q&A 수정 에러:', error)
    return NextResponse.json({ error: 'Q&A 수정에 실패했습니다.' }, { status: 500 })
  }
}

// Q&A 삭제 (답변 전에만 가능)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const qnaId = parseInt(searchParams.get('id') || '0')

    if (!qnaId) {
      return NextResponse.json({ error: 'Q&A ID가 필요합니다.' }, { status: 400 })
    }

    // 상품 찾기
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true }
    })

    if (!product) {
      return NextResponse.json({ error: '상품을 찾을 수 없습니다.' }, { status: 404 })
    }

    // Q&A 찾기
    const qna = await prisma.productQna.findUnique({
      where: { id: qnaId }
    })

    if (!qna || qna.productId !== product.id) {
      return NextResponse.json({ error: 'Q&A를 찾을 수 없습니다.' }, { status: 404 })
    }

    // 본인 확인
    if (qna.userId !== session.id) {
      return NextResponse.json({ error: '본인의 Q&A만 삭제할 수 있습니다.' }, { status: 403 })
    }

    // 답변이 있으면 삭제 불가
    if (qna.answer) {
      return NextResponse.json({ error: '답변이 등록된 Q&A는 삭제할 수 없습니다.' }, { status: 400 })
    }

    // 소프트 삭제
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

// 이름 마스킹
function maskName(name: string): string {
  if (name.length <= 1) return '*'
  if (name.length === 2) return name[0] + '*'
  return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
}
