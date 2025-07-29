import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mb_id = searchParams.get('mb_id');
    const mb_md5 = searchParams.get('mb_md5');

    if (!mb_id || !mb_md5) {
      return NextResponse.json(
        { error: '인증 정보가 올바르지 않습니다.' },
        { status: 400 }
      );
    }

    // 회원 정보 조회
    const member = await prisma.g5Member.findFirst({
      where: { 
        mb_id: mb_id,
        mb_email_certify2: mb_md5
      },
      select: {
        mb_id: true,
        mb_email: true,
        mb_email_certify: true,
        mb_email_certify2: true
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: '유효하지 않은 인증 정보입니다.' },
        { status: 400 }
      );
    }

    // 이미 인증된 회원인지 확인
    const certifyDate = new Date(member.mb_email_certify);
    const limitDate = new Date('1980-01-01');
    
    if (certifyDate > limitDate) {
      return NextResponse.json(
        { error: '이미 인증이 완료된 회원입니다.' },
        { status: 400 }
      );
    }

    // 이메일 인증 완료 처리 (그누보드5 방식)
    await prisma.g5Member.update({
      where: { mb_id: mb_id },
      data: { 
        mb_email_certify: new Date(),
        mb_email_certify2: '' // 인증 완료 후 토큰 초기화
      },
    });

    return NextResponse.json({
      success: true,
      message: '이메일 인증이 완료되었습니다.',
    });

  } catch (error) {
    console.error('이메일 인증 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 