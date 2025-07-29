import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mb_id } = body;

    if (!mb_id) {
      return NextResponse.json(
        { error: '회원 아이디가 필요합니다.' },
        { status: 400 }
      );
    }

    // 회원 ID 중복 확인
    const existingMember = await prisma.g5Member.findFirst({
      where: { mb_id },
      select: { mb_id: true }
    });

    if (existingMember) {
      return NextResponse.json({
        success: false,
        available: false,
        message: '이미 사용 중인 회원 아이디입니다.'
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '사용 가능한 회원 아이디입니다.'
    });

  } catch (error) {
    console.error('회원 아이디 중복 검사 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 