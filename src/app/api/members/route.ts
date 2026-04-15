import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Signup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, nickname } = body

    // Validate required fields
    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요.' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식을 입력하세요.' },
        { status: 400 }
      )
    }

    // Validate nickname length
    if (nickname.trim().length < 2) {
      return NextResponse.json(
        { error: '닉네임은 최소 2자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    // Validate nickname characters (only Korean, English, and digits)
    if (!/^[가-힣a-zA-Z0-9]+$/.test(nickname.trim())) {
      return NextResponse.json(
        { error: '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.' },
        { status: 400 }
      )
    }

    // Email uniqueness check
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 400 }
      )
    }

    // Nickname uniqueness check
    const existingNickname = await prisma.user.findFirst({
      where: { nickname }
    })

    if (existingNickname) {
      return NextResponse.json(
        { error: '이미 사용 중인 닉네임입니다.' },
        { status: 400 }
      )
    }

    // Check whether this is the first user (used to seed the admin)
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        nickname,
        role: isFirstUser ? 'admin' : 'user',
        status: 'active'
      }
    })

    return NextResponse.json({
      success: true,
      message: isFirstUser
        ? '관리자로 회원가입되었습니다.'
        : '회원가입이 완료되었습니다.',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role
      }
    }, { status: 201 })

  } catch (error) {
    console.error('signup error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
