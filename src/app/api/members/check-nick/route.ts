import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mb_nick } = body;

    if (!mb_nick) {
      return NextResponse.json(
        { error: '닉네임이 필요합니다.' },
        { status: 400 }
      );
    }

    // 닉네임 길이 검증 (2-20자)
    if (mb_nick.length < 2 || mb_nick.length > 20) {
      return NextResponse.json(
        { error: '닉네임은 2-20자 사이여야 합니다.' },
        { status: 400 }
      );
    }

    // 특수문자 검증 (한글, 영문, 숫자, 언더바만 허용)
    const nicknameRegex = /^[가-힣a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(mb_nick)) {
      return NextResponse.json(
        { error: '닉네임은 한글, 영문, 숫자, 언더바(_)만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // 데이터베이스에서 닉네임 중복 확인
    const existingMember = await prisma.g5Member.findFirst({
      where: {
        mb_nick: mb_nick
      },
      select: {
        mb_nick: true
      }
    });

    if (existingMember) {
      return NextResponse.json({
        success: false,
        available: false,
        message: '이미 사용 중인 닉네임입니다.'
      });
    }

    return NextResponse.json({
      success: true,
      available: true,
      message: '사용 가능한 닉네임입니다.'
    });

  } catch (error) {
    console.error('닉네임 중복 검사 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 