import { NextRequest, NextResponse } from 'next/server';

// 임시 데이터베이스 (실제로는 데이터베이스 연결 필요)
const existingEmails = [
  'test@example.com',
  'user@test.com',
  'admin@site.com'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: '이메일이 필요합니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 확인 (실제로는 데이터베이스 쿼리)
    const isEmailTaken = existingEmails.includes(email.toLowerCase());

    return NextResponse.json({
      available: !isEmailTaken,
      message: isEmailTaken 
        ? '이미 사용중인 이메일입니다.' 
        : '사용 가능한 이메일입니다.'
    });

  } catch (error) {
    console.error('이메일 확인 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 