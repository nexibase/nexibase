import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '@/lib/types/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: '토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰에서 mb_no를 추출하여 DB에서 최신 사용자 정보 조회
    const member = await prisma.g5Member.findUnique({
      where: { mb_no: decoded.mb_no },
      select: {
        mb_no: true,
        mb_id: true,
        mb_email: true,
        mb_nick: true,
        mb_level: true,
        mb_datetime: true,
        mb_today_login: true
      }
    });

    if (!member) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

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