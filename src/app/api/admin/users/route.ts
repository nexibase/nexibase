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

    // 검색 조건
    const where: Record<string, unknown> = {}

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

    // 통계
    const [totalUsers, activeUsers, bannedUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { status: 'banned' } }),
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
        bannedUsers
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
    const { email, name, nickname, password, phone, role, status, level } = body

    // 이메일 중복 확인
    const existingUser = await prisma.user.findUnique({
      where: { email }
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
        level: level ?? 1,
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

// 사용자 일괄 삭제
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

    await prisma.user.deleteMany({
      where: {
        id: { in: ids }
      }
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
