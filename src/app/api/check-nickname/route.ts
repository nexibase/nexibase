import { NextRequest, NextResponse } from 'next/server';

// 임시 데이터베이스 (실제로는 데이터베이스 연결 필요)
const existingNicknames = [
  'admin',
  'user123',
  'test_user',
  '관리자',
  '사용자'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname } = body;

    if (!nickname) {
      return NextResponse.json(
        { error: '닉네임이 필요합니다.' },
        { status: 400 }
      );
    }

    // 닉네임 길이 검증 (2-20자)
    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { error: '닉네임은 2-20자 사이여야 합니다.' },
        { status: 400 }
      );
    }

    // 특수문자 검증 (한글, 영문, 숫자, 언더바만 허용)
    const nicknameRegex = /^[가-힣a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) {
      return NextResponse.json(
        { error: '닉네임은 한글, 영문, 숫자, 언더바(_)만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // 닉네임 중복 확인 (실제로는 데이터베이스 쿼리)
    const isNicknameTaken = existingNicknames.includes(nickname.toLowerCase());

    return NextResponse.json({
      available: !isNicknameTaken,
      message: isNicknameTaken 
        ? '이미 사용중인 닉네임입니다.' 
        : '사용 가능한 닉네임입니다.'
    });

  } catch (error) {
    console.error('닉네임 확인 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 