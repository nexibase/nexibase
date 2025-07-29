import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '@/lib/types/auth';

export async function GET(request: NextRequest) {
  try {
    // 쿠키에서 토큰 가져오기 (HTTP-only 쿠키)
    const token = request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: '토큰이 필요합니다.' },
        { status: 401 }
      );
    }

    // JWT 토큰 검증 및 디코드
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    if (!decoded) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // JWT 페이로드에서 사용자 정보 직접 반환 (DB 조회 없음)
    return NextResponse.json({
      member: {
        mb_no: decoded.mb_no,
        mb_id: decoded.mb_id,
        mb_email: decoded.mb_email,
        mb_nick: decoded.mb_nick,
        mb_level: decoded.mb_level,
        mb_datetime: decoded.mb_datetime,
        mb_today_login: decoded.mb_today_login
      }
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
  }
} 