import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // 필수 필드 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // 이메일로 사용자 검색
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        accounts: {
          select: { provider: true }
        }
      }
    })

    // 사용자가 존재하지 않음
    if (!user) {
      return NextResponse.json(
        { error: '등록되지 않은 이메일입니다.' },
        { status: 401 }
      )
    }

    // 소셜 로그인 사용자인 경우 (비밀번호 없음)
    if (!user.password) {
      const providers = user.accounts.map(a => a.provider).join(', ')
      return NextResponse.json(
        {
          error: `이 계정은 소셜 로그인(${providers})으로 가입되었습니다. 해당 소셜 계정으로 로그인해주세요.`,
          socialOnly: true,
          providers: user.accounts.map(a => a.provider)
        },
        { status: 401 }
      )
    }

    // 계정 상태 확인 (삭제, 차단, 비활성 - 구체적인 이유는 노출하지 않음)
    if (user.deletedAt || user.status === 'banned' || user.status === 'inactive') {
      return NextResponse.json(
        { error: '로그인할 수 없는 계정입니다. 관리자에게 문의해주세요.' },
        { status: 403 }
      )
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }

    // 클라이언트 IP 가져오기
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // 로그인 시간 및 IP 업데이트
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip
      }
    })

    // 세션 토큰 생성
    const sessionToken = randomUUID()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7일 후 만료

    // 세션 저장
    await prisma.userSession.create({
      data: {
        sessionToken,
        userId: user.id,
        expires: expiresAt
      }
    })

    // 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그인이 완료되었습니다.',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        image: user.image,
        loginTime: new Date().toISOString()
      }
    })

    // HTTP-only 쿠키에 세션 토큰 설정
    response.cookies.set('session-token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7일
      path: '/',
    })

    return response

  } catch (error) {
    console.error('로그인 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
