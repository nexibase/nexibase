import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    const { mb_nick, exclude_id } = await request.json();

    if (!mb_nick) {
      return NextResponse.json(
        { error: '닉네임을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 닉네임 형식 검증 (2-20자, 한글, 영문, 숫자, 일부 특수문자만 허용)
    const nickRegex = /^[가-힣a-zA-Z0-9._-]{2,20}$/;
    if (!nickRegex.test(mb_nick)) {
      return NextResponse.json(
        { error: '닉네임은 2-20자의 한글, 영문, 숫자, ., _, -만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // 데이터베이스에서 닉네임 중복 확인 (exclude_id가 있으면 해당 회원 제외)
    const whereCondition: Prisma.G5MemberWhereInput = {
      mb_nick: mb_nick
    };

    // 수정 모드일 때는 현재 회원을 제외하고 중복 검사
    if (exclude_id) {
      whereCondition.mb_id = {
        not: exclude_id
      };
    }

    const existingMember = await prisma.g5Member.findFirst({
      where: whereCondition,
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