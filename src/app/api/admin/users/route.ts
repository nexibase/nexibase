import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const role = searchParams.get('role') || ''

    const skip = (page - 1) * limit

    // 검색 조건 - 삭제되지 않은 사용자만 조회
    const where: Record<string, unknown> = {
      deletedAt: null
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { nickname: { contains: search } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (role) {
      where.role = role
    }

    // 사용자 목록 조회
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

    // 통계 - 삭제되지 않은 사용자 + 삭제된 사용자
    const [totalUsers, activeUsers, bannedUsers, deletedUsers] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { status: 'active', deletedAt: null } }),
      prisma.user.count({ where: { status: 'banned', deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: { not: null } } }),
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
        bannedUsers,
        deletedUsers
      }
    })
  } catch (error) {
    console.error('사용자 목록 조회 실패:', error)
    return NextResponse.json(
      { success: false, message: '사용자 목록 조회 실패' },
      { status: 500 }
    )
  }
}

// 사용자 생성
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, nickname, password, phone, role, status } = body

    // 이메일 중복 확인 (삭제되지 않은 사용자 중)
    const existingUser = await prisma.user.findFirst({
      where: { email, deletedAt: null }
    })

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      )
    }

    // 비밀번호 해시
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null

    // 사용자 생성
    const user = await prisma.user.create({
      data: {
        email,
        name,
        nickname,
        password: hashedPassword,
        phone,
        role: role || 'user',
        status: status || 'active',
      }
    })

    return NextResponse.json({
      success: true,
      user: { ...user, password: undefined }
    })
  } catch (error) {
    console.error('사용자 생성 실패:', error)
    return NextResponse.json(
      { success: false, message: '사용자 생성 실패' },
      { status: 500 }
    )
  }
}

// 사용자 일괄 삭제 (소프트 삭제)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')?.split(',') || []
    const ids = idsParam.map(id => parseInt(id)).filter(id => !isNaN(id))

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: '삭제할 사용자를 선택하세요.' },
        { status: 400 }
      )
    }

    // 삭제 대상 중 관리자 수 확인 (삭제되지 않은 사용자 중)
    const adminsToDelete = await prisma.user.count({
      where: {
        id: { in: ids },
        role: 'admin',
        deletedAt: null
      }
    })

    if (adminsToDelete > 0) {
      // 전체 관리자 수 확인 (삭제되지 않은 사용자 중)
      const totalAdmins = await prisma.user.count({
        where: { role: 'admin', deletedAt: null }
      })

      // 삭제 후 관리자가 0명이 되면 방지
      if (totalAdmins - adminsToDelete < 1) {
        return NextResponse.json(
          { success: false, message: '최소 1명의 관리자가 있어야 합니다.' },
          { status: 400 }
        )
      }
    }

    // 소프트 삭제: deletedAt에 현재 시간 설정
    await prisma.user.updateMany({
      where: {
        id: { in: ids },
        deletedAt: null
      },
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
