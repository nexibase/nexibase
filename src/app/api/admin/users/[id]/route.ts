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

// 사용자 수정 / 복원
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)
    const body = await request.json()
    const { action, email, name, nickname, password, phone, role, status, adminNote } = body

    // 삭제된 사용자 복원
    if (action === 'restore') {
      const deletedUser = await prisma.user.findFirst({
        where: { id: userId, deletedAt: { not: null } }
      })

      if (!deletedUser) {
        return NextResponse.json(
          { success: false, message: '삭제된 사용자를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 이메일 중복 확인 (현재 활성 사용자 중)
      const emailExists = await prisma.user.findFirst({
        where: { email: deletedUser.email, deletedAt: null }
      })

      if (emailExists) {
        return NextResponse.json(
          { success: false, message: '동일한 이메일을 가진 사용자가 이미 존재합니다.' },
          { status: 400 }
        )
      }

      await prisma.user.update({
        where: { id: userId },
        data: { deletedAt: null }
      })

      return NextResponse.json({ success: true, message: '사용자가 복원되었습니다.' })
    }

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
      adminNote: adminNote || null,
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

// 사용자 삭제 (소프트 삭제 / 영구 삭제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const userId = parseInt(id)

    // body가 있는지 확인 (영구 삭제 여부)
    let permanent = false
    try {
      const body = await request.json()
      permanent = body.permanent === true
    } catch {
      // body가 없으면 소프트 삭제
    }

    // 영구 삭제
    if (permanent) {
      const userToDelete = await prisma.user.findUnique({
        where: { id: userId }
      })

      if (!userToDelete) {
        return NextResponse.json(
          { success: false, message: '사용자를 찾을 수 없습니다.' },
          { status: 404 }
        )
      }

      // 이미 삭제된 사용자만 영구 삭제 가능
      if (!userToDelete.deletedAt) {
        return NextResponse.json(
          { success: false, message: '활성 사용자는 영구 삭제할 수 없습니다. 먼저 삭제 처리해주세요.' },
          { status: 400 }
        )
      }

      // 관련 데이터 삭제 후 사용자 삭제
      await prisma.$transaction(async (tx) => {
        // 세션 삭제
        await tx.userSession.deleteMany({ where: { userId } })
        // 소셜 계정 연결 삭제
        await tx.account.deleteMany({ where: { userId } })
        // 알림 삭제
        await tx.notification.deleteMany({ where: { userId } })
        // 사용자 영구 삭제
        await tx.user.delete({ where: { id: userId } })
      })

      return NextResponse.json({ success: true, message: '사용자가 영구 삭제되었습니다.' })
    }

    // 소프트 삭제
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
