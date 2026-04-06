import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// 약관 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const policyId = parseInt(id)

    if (isNaN(policyId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const policy = await prisma.policy.findUnique({
      where: { id: policyId }
    })

    if (!policy) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      policy
    })
  } catch (error) {
    console.error('약관 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 약관 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const policyId = parseInt(id)

    if (isNaN(policyId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, content } = body

    if (!title) {
      return NextResponse.json(
        { error: '제목은 필수입니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.policy.findUnique({
      where: { id: policyId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const updated = await prisma.policy.update({
      where: { id: policyId },
      data: {
        title,
        content: content ?? existing.content
      }
    })

    return NextResponse.json({
      success: true,
      message: '약관이 수정되었습니다.',
      policy: updated
    })

  } catch (error) {
    console.error('약관 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 약관 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { id } = await params
    const policyId = parseInt(id)

    if (isNaN(policyId)) {
      return NextResponse.json(
        { error: '유효하지 않은 ID입니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.policy.findUnique({
      where: { id: policyId }
    })

    if (!existing) {
      return NextResponse.json(
        { error: '약관을 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    await prisma.policy.delete({
      where: { id: policyId }
    })

    return NextResponse.json({
      success: true,
      message: '약관이 삭제되었습니다.'
    })

  } catch (error) {
    console.error('약관 삭제 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
