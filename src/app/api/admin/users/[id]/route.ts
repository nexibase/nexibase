import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getAdminUser } from '@/lib/auth'

// Fetch user detail
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
    console.error('failed to fetch user:', error)
    return NextResponse.json(
      { success: false, message: '사용자 조회 실패' },
      { status: 500 }
    )
  }
}

// Update / restore user
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
    const userId = parseInt(id)
    const body = await request.json()
    const { action, email, nickname, password, role, level, status, adminNote } = body

    // Restore deleted user
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

      // Email uniqueness check (against active users)
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

    // Look up an existing user (not deleted)
    const existingUser = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null }
    })

    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Guard: keep at least one admin
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

    // Email uniqueness check (against other non-deleted users)
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

    // Update data
    const updateData: Record<string, unknown> = {
      email,
      nickname,
      role,
      level: level !== undefined ? parseInt(level) || 1 : undefined,
      status,
      adminNote: adminNote || null,
    }

    // Only update when a password is provided
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
    console.error('failed to update user:', error)
    return NextResponse.json(
      { success: false, message: '사용자 수정 실패', error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

// Delete user (soft / permanent)
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
    const userId = parseInt(id)

    // Check for a request body (permanent-delete flag)
    let permanent = false
    try {
      const body = await request.json()
      permanent = body.permanent === true
    } catch {
      // Soft-delete when the body is missing
    }

    // Prevent self-deletion
    if (userId === admin.id) {
      return NextResponse.json(
        { success: false, message: '본인 계정은 삭제할 수 없습니다.' },
        { status: 400 }
      )
    }

    // Permanent delete
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

      // Only already-deleted users can be permanently removed
      if (!userToDelete.deletedAt) {
        return NextResponse.json(
          { success: false, message: '활성 사용자는 영구 삭제할 수 없습니다. 먼저 삭제 처리해주세요.' },
          { status: 400 }
        )
      }

      // Delete related data, then the user
      await prisma.$transaction(async (tx) => {
        // Unlink social accounts
        await tx.account.deleteMany({ where: { userId } })
        // Delete notifications
        await tx.notification.deleteMany({ where: { userId } })
        // Permanently delete user
        await tx.user.delete({ where: { id: userId } })
      })

      return NextResponse.json({ success: true, message: '사용자가 영구 삭제되었습니다.' })
    }

    // Soft delete
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId, deletedAt: null }
    })

    if (!userToDelete) {
      return NextResponse.json(
        { success: false, message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    // Guard: keep at least one admin
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

    // Soft delete: set deletedAt to now
    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('failed to delete user:', error)
    return NextResponse.json(
      { success: false, message: '사용자 삭제 실패' },
      { status: 500 }
    )
  }
}
