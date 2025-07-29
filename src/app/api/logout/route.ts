import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // HTTP-only 쿠키를 제거하는 응답 생성
    const response = NextResponse.json({
      success: true,
      message: '로그아웃이 완료되었습니다.'
    }, { status: 200 });

    // 쿠키 삭제
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('로그아웃 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 