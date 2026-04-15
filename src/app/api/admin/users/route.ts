import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getAdminUser } from '@/lib/auth'

// Fetch user list
export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const role = searchParams.get('role') || ''

    const skip = (page - 1) * limit

    // Search conditions
    const where: Record<string, unknown> = {}

    // Withdrawn user: status is 'withdrawn' (user-initiated withdrawal)
    // Deleted user: deletedAt is set but status is not 'withdrawn' (admin-initiated delete)
    // Otherwise only active users (deletedAt is null) are included
    if (status === 'withdrawn') {
      where.status = 'withdrawn'
    } else if (status === 'deleted') {
      where.deletedAt = { not: null }
      where.status = { not: 'withdrawn' }
    } else {
      where.deletedAt = null
      if (status) {
        where.status = status
      }
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { nickname: { contains: search } },
      ]
    }

    if (role) {
      where.role = role
    }

    // Fetch user list
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          accounts: {
            select: {
              provider: true,
            }
          }
        }
      }),
      prisma.user.count({ where })
    ])

    // Stats — user counts by status
    const [totalUsers, activeUsers, inactiveUsers, bannedUsers, withdrawnUsers, deletedUsers] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { status: 'active', deletedAt: null } }),
      prisma.user.count({ where: { status: 'inactive', deletedAt: null } }),
      prisma.user.count({ where: { status: 'banned', deletedAt: null } }),
      prisma.user.count({ where: { status: 'withdrawn' } }), // 탈퇴 회원 (직접 탈퇴)
      prisma.user.count({ where: { deletedAt: { not: null }, status: { not: 'withdrawn' } } }), // 삭제된 사용자 (관리자 삭제)
    ])

    return NextResponse.json({
      success: true,
      users: users.map(user => ({
        ...user,
        password: undefined, // 비밀번호 제외
        providers: user.accounts.map(acc => acc.provider)
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        bannedUsers,
        withdrawnUsers,
        deletedUsers
      }
    })
  } catch (error) {
    console.error('failed to fetch user list:', error)
    return NextResponse.json(
      { success: false, message: '사용자 목록 조회 실패', error: String(error) },
      { status: 500 }
    )
  }
}

// Create user
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { email, nickname, password, role, status, adminNote } = body

    // Email uniqueness check (against non-deleted users)
    const existingUser = await prisma.user.findFirst({
      where: { email, deletedAt: null }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      )
    }

    // Hash password
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        nickname,
        password: hashedPassword,
        role: role || 'user',
        status: status || 'active',
        adminNote: adminNote || null,
      }
    })

    return NextResponse.json({
      success: true,
      user: { ...user, password: undefined }
    })
  } catch (error) {
    console.error('failed to create user:', error)
    return NextResponse.json(
      { success: false, message: '사용자 생성 실패' },
      { status: 500 }
    )
  }
}

// Bulk delete users (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')?.split(',') || []
    const ids = idsParam.map(id => parseInt(id)).filter(id => !isNaN(id))

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: '삭제할 사용자를 선택하세요.' },
        { status: 400 }
      )
    }

    // Count admins in the delete set (among non-deleted users)
    const adminsToDelete = await prisma.user.count({
      where: {
        id: { in: ids },
        role: 'admin',
        deletedAt: null
      }
    })

    if (adminsToDelete > 0) {
      // Count total admins (among non-deleted users)
      const totalAdmins = await prisma.user.count({
        where: { role: 'admin', deletedAt: null }
      })

      // Prevent removing the last admin
      if (totalAdmins - adminsToDelete < 1) {
        return NextResponse.json(
          { success: false, message: '최소 1명의 관리자가 있어야 합니다.' },
          { status: 400 }
        )
      }
    }

    // Soft delete: set deletedAt to now
    await prisma.user.updateMany({
      where: {
        id: { in: ids },
        deletedAt: null
      },
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
