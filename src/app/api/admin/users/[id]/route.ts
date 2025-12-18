import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 사용자 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        accounts: {
          select: {
            id: true,
            provider: true,
            providerAccountId: true,
            createdAt: true,
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      user: { ...user, password: undefined }
    })
  } catch (error) {
    console.error('사용자 조회 실패:', error)
    return NextResponse.json(
      { success: false, message: '사용자 조회 실패' },
      { status: 500 }
    )
  }
}

// 사용자 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    const body = await request.json()
    const { email, name, nickname, password, phone, role, status } = body

    // 기존 사용자 확인 (삭제되지 않은 사용자)
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null }
    })

    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 관리자 최소 1명 유지 체크
    if (existingUser.role === 'admin' && role !== 'admin') {
      const adminCount = await prisma.user.count({
        where: { role: 'admin', deletedAt: null }
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, message: '최소 1명의 관리자가 있어야 합니다.' },
          { status: 400 }
        )
      }
    }

    // 이메일 중복 확인 (다른 삭제되지 않은 사용자)
    if (email !== existingUser.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email, deletedAt: null }
      })
      if (emailExists) {
        return NextResponse.json(
          { success: false, message: '이미 사용 중인 이메일입니다.' },
          { status: 400 }
        )
      }
    }

    // 업데이트 데이터
    const updateData: Record<string, unknown> = {
      email,
      name,
      nickname,
      phone,
      role,
      status,
    }

    // 비밀번호가 제공된 경우에만 업데이트
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      user: { ...user, password: undefined }
    })
  } catch (error) {
    console.error('사용자 수정 실패:', error)
    return NextResponse.json(
      { success: false, message: '사용자 수정 실패', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// 사용자 삭제 (소프트 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    // 삭제하려는 사용자 확인
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null }
    })

    if (!userToDelete) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // 관리자 최소 1명 유지 체크
    if (userToDelete.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: { role: 'admin', deletedAt: null }
      })
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, message: '최소 1명의 관리자가 있어야 합니다.' },
          { status: 400 }
        )
      }
    }

    // 소프트 삭제: deletedAt에 현재 시간 설정
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('사용자 삭제 실패:', error)
    return NextResponse.json(
      { success: false, message: '사용자 삭제 실패' },
      { status: 500 }
    )
  }
}
