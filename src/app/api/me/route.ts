import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 토큰 가져오기
    const token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: '인증 토큰이 없습니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰에서 사용자 정보 직접 추출 (DB 접근 없이)
    const member = {
      mb_no: decoded.mb_no,
      mb_id: decoded.mb_id,
      mb_email: decoded.mb_email,
      mb_nick: decoded.mb_nick,
      mb_level: decoded.mb_level,
      mb_datetime: decoded.mb_datetime,
      mb_today_login: decoded.mb_today_login
    };

    return NextResponse.json({
      member: member
    });

  } catch (error) {
    console.error('사용자 정보 조회 에러:', error);
    
    // JWT 검증 실패 시
    if (error instanceof jwt.JsonWebTokenError) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 