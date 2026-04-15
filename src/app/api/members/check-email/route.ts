import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: '이메일을 입력해주세요.' },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existingUser) {
      return NextResponse.json({
        available: false,
        message: '이미 사용 중인 이메일입니다.'
      })
    }

    return NextResponse.json({
      available: true,
      message: '사용 가능한 이메일입니다.'
    })

  } catch (error) {
    console.error('email check error:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
