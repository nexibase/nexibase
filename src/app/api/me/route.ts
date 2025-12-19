import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// 세션에서 사용자 조회 헬퍼
async function getUserFromSession(request: NextRequest) {
  const sessionToken = request.cookies.get('session-token')?.value
  if (!sessionToken) return null

  const session = await prisma.userSession.findUnique({
    where: { sessionToken },
    include: { user: true }
  })

  if (!session || new Date() > session.expires) {
    if (session) {
      await prisma.userSession.delete({ where: { id: session.id } })
    }
    return null
  }

  return session.user
}

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 세션 토큰 가져오기
    const sessionToken = request.cookies.get('session-token')?.value

    if (!sessionToken) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 세션 조회 및 사용자 정보 가져오기
    const session = await prisma.userSession.findUnique({
      where: { sessionToken },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            nickname: true,
            image: true,
            phone: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true
          }
        }
      }
    })

    // 세션이 없거나 만료됨
    if (!session) {
      return NextResponse.json(
        { error: '세션이 유효하지 않습니다.' },
        { status: 401 }
      )
    }

    // 세션 만료 확인
    if (new Date() > session.expires) {
      // 만료된 세션 삭제
      await prisma.userSession.delete({
        where: { id: session.id }
      })

      return NextResponse.json(
        { error: '세션이 만료되었습니다. 다시 로그인해주세요.' },
        { status: 401 }
      )
    }

    // 사용자 정보 반환
    return NextResponse.json({
      user: session.user
    })

  } catch (error) {
    console.error('사용자 정보 조회 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// 프로필 수정
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromSession(request)
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name, nickname, phone, currentPassword, newPassword } = body

    // 업데이트할 데이터
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // 이름 업데이트
    if (name !== undefined) {
      if (name.trim().length < 2) {
        return NextResponse.json(
          { error: '이름은 2자 이상 입력해주세요.' },
          { status: 400 }
        )
      }
      updateData.name = name.trim()
    }

    // 닉네임 업데이트
    if (nickname !== undefined) {
      if (nickname.trim().length < 2) {
        return NextResponse.json(
          { error: '닉네임은 2자 이상 입력해주세요.' },
          { status: 400 }
        )
      }
      // 닉네임 중복 체크
      const existingUser = await prisma.user.findFirst({
        where: {
          nickname: nickname.trim(),
          id: { not: user.id }
        }
      })
      if (existingUser) {
        return NextResponse.json(
          { error: '이미 사용 중인 닉네임입니다.' },
          { status: 400 }
        )
      }
      updateData.nickname = nickname.trim()
    }

    // 전화번호 업데이트
    if (phone !== undefined) {
      updateData.phone = phone.trim() || null
    }

    // 비밀번호 변경
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: '현재 비밀번호를 입력해주세요.' },
          { status: 400 }
        )
      }

      // 현재 비밀번호 확인
      if (!user.password) {
        return NextResponse.json(
          { error: '소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.' },
          { status: 400 }
        )
      }
      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: '현재 비밀번호가 일치하지 않습니다.' },
          { status: 400 }
        )
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: '새 비밀번호는 6자 이상 입력해주세요.' },
          { status: 400 }
        )
      }

      updateData.password = await bcrypt.hash(newPassword, 10)
    }

    // 업데이트할 내용이 없으면 에러
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: '변경할 내용이 없습니다.' },
        { status: 400 }
      )
    }

    // 사용자 정보 업데이트
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        nickname: true,
        image: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      message: '프로필이 수정되었습니다.',
      user: updatedUser
    })

  } catch (error) {
    console.error('프로필 수정 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
