import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { existsSync, unlinkSync } from 'fs'
import path from 'path'

// NextAuth 세션에서 사용자 조회 헬퍼
async function getUserFromSession() {
  const nextAuthSession = await getServerSession(authOptions)
  if (nextAuthSession?.user?.email) {
    const user = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email }
    })
    if (user) return user
  }
  return null
}

export async function GET() {
  try {
    const nextAuthSession = await getServerSession(authOptions)

    if (!nextAuthSession?.user?.email) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: nextAuthSession.user.email },
      select: {
        id: true,
        email: true,
        nickname: true,
        image: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
        password: true,
        provider: true,
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      )
    }

    const { password, ...userWithoutPassword } = user
    return NextResponse.json({
      user: userWithoutPassword,
      hasPassword: !!password
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
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { nickname, name, phone, currentPassword, newPassword } = body

    // 업데이트할 데이터
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {}

    // 이름(실명) 업데이트
    if (name !== undefined) {
      updateData.name = name.trim() || null
    }

    // 전화번호 업데이트
    if (phone !== undefined) {
      updateData.phone = phone.trim() || null
    }

    // 닉네임 업데이트
    if (nickname !== undefined) {
      if (nickname.trim().length < 2) {
        return NextResponse.json(
          { error: '닉네임은 2자 이상 입력해주세요.' },
          { status: 400 }
        )
      }
      // 한글, 영문, 숫자만 허용
      if (!/^[가-힣a-zA-Z0-9]+$/.test(nickname.trim())) {
        return NextResponse.json(
          { error: '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.' },
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
        nickname: true,
        name: true,
        phone: true,
        image: true,
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

// 회원 탈퇴
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromSession()
    if (!user) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      )
    }

    // 관리자는 탈퇴 불가 (body 파싱 전에 체크)
    if (user.role === 'admin') {
      return NextResponse.json(
        { error: '관리자 계정은 탈퇴할 수 없습니다. 다른 관리자에게 권한을 이전한 후 탈퇴해주세요.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { password, confirmText } = body

    // 탈퇴 확인 문구 검증
    if (confirmText !== '회원탈퇴') {
      return NextResponse.json(
        { error: '탈퇴 확인 문구를 정확히 입력해주세요.' },
        { status: 400 }
      )
    }

    // 소셜 로그인 계정인 경우 비밀번호 확인 생략
    if (user.password) {
      if (!password) {
        return NextResponse.json(
          { error: '비밀번호를 입력해주세요.' },
          { status: 400 }
        )
      }

      const isValidPassword = await bcrypt.compare(password, user.password)
      if (!isValidPassword) {
        return NextResponse.json(
          { error: '비밀번호가 일치하지 않습니다.' },
          { status: 400 }
        )
      }
    }

    // 프로필 이미지 파일 삭제 (로컬 파일인 경우)
    if (user.image && user.image.startsWith('/uploads/profiles/')) {
      const imagePath = path.join(process.cwd(), 'public', user.image)
      try {
        if (existsSync(imagePath)) {
          unlinkSync(imagePath)
          console.log(`프로필 이미지 삭제: ${user.image}`)
        }
      } catch (e) {
        console.error('프로필 이미지 삭제 에러:', e)
      }
    }

    // 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      // 1. 연결된 소셜 계정 삭제
      await tx.account.deleteMany({
        where: { userId: user.id }
      })

      // 2. 사용자 정보 익명화 + 소프트 삭제
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `**deleted_${user.id}**`,
          nickname: `**탈퇴회원_${user.id}**`,
          password: null,
          image: null,
          status: 'withdrawn',
          deletedAt: new Date()
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: '회원 탈퇴가 완료되었습니다.'
    })

  } catch (error) {
    console.error('회원 탈퇴 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
