import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // 토큰으로 인증 정보 조회
    const verificationToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.json(
        { error: '유효하지 않은 인증 토큰입니다.' },
        { status: 400 }
      );
    }

    // 토큰 만료 확인
    if (new Date() > verificationToken.expiresAt) {
      // 만료된 토큰 삭제
      await prisma.emailVerificationToken.delete({
        where: { token },
      });
      
      return NextResponse.json(
        { error: '인증 토큰이 만료되었습니다. 다시 회원가입해주세요.' },
        { status: 400 }
      );
    }

    // 회원 이메일 인증 상태 업데이트
    await prisma.g5Member.updateMany({
      where: { mb_email: verificationToken.email },
      data: { mb_email_certify: new Date() },
    });

    // 사용된 토큰 삭제
    await prisma.emailVerificationToken.delete({
      where: { token },
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