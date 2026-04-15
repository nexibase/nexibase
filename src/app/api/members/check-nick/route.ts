import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { nickname } = body

    if (!nickname) {
      return NextResponse.json(
        { error: '닉네임을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (nickname.length < 2) {
      return NextResponse.json({
        available: false,
        message: '닉네임은 최소 2자 이상이어야 합니다.'
      })
    }

    const existingUser = await prisma.user.findFirst({
      where: { nickname }
    })

    if (existingUser) {
      return NextResponse.json({
        available: false,
        message: '이미 사용 중인 닉네임입니다.'
      })
    }

    return NextResponse.json({
      available: true,
      message: '사용 가능한 닉네임입니다.'
    })

  } catch (error) {
    console.error('nickname check error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
