import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePBKDF2Hash, generateUniqueId } from '@/lib/auth';
import { generateEmailVerificationToken, sendEmailVerificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, nickname } = body;

    // 필수 필드 검증
    if (!email || !password || !nickname) {
      return NextResponse.json(
        { error: '이메일, 비밀번호, 닉네임은 필수입니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 닉네임 형식 검증
    if (nickname.length < 2 || nickname.length > 20) {
      return NextResponse.json(
        { error: '닉네임은 2-20자 사이여야 합니다.' },
        { status: 400 }
      );
    }

    const nicknameRegex = /^[가-힣a-zA-Z0-9_]+$/;
    if (!nicknameRegex.test(nickname)) {
      return NextResponse.json(
        { error: '닉네임은 한글, 영문, 숫자, 언더바(_)만 사용 가능합니다.' },
        { status: 400 }
      );
    }

    // // 비밀번호 길이 검증
    // if (password.length < 6) {
    //   return NextResponse.json(
    //     { error: '비밀번호는 최소 6자 이상이어야 합니다.' },
    //     { status: 400 }
    //   );
    // }

    // 이메일 중복 확인
    const existingEmail = await prisma.g5Member.findFirst({
      where: { mb_email: email.toLowerCase() },
      select: { mb_email: true }
    });

    if (existingEmail) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    // 닉네임 중복 확인
    const existingNickname = await prisma.g5Member.findFirst({
      where: { mb_nick: nickname },
      select: { mb_nick: true }
    });

    if (existingNickname) {
      return NextResponse.json(
        { error: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      );
    }

    // 비밀번호 해시화 (공통 함수 사용)
    const hashedPassword = generatePBKDF2Hash(password);

    // 클라이언트 IP 주소 가져오기
    const clientIP = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1';

    // 그누보드5 방식의 이메일 인증 토큰 생성
    const mb_md5 = generateEmailVerificationToken();
    const mb_id = generateUniqueId(email);

    // 회원 정보 저장 (그누보드5 방식)
    const newMember = await prisma.g5Member.create({
      data: {
        mb_id: mb_id,
        mb_password: hashedPassword,
        mb_name: nickname,
        mb_nick: nickname,
        mb_email: email.toLowerCase(),
        mb_level: 2,
        mb_datetime: new Date(),
        mb_ip: clientIP,
        mb_nick_date: new Date(),
        mb_point: 0,
        mb_today_login: new Date('1970-01-01'),
        mb_email_certify: new Date('1970-01-01'), // 인증 전 기본값
        mb_email_certify2: mb_md5, // 인증 토큰 저장
        mb_open_date: new Date('1970-01-01'),
        mb_signature: '',
        mb_memo: '',
        mb_lost_certify: 'N',
        mb_profile: ''
      },
      select: {
        mb_no: true,
        mb_id: true,
        mb_nick: true,
        mb_email: true,
        mb_datetime: true
      }
    });

    // 회원가입 후 이메일 인증 메일 발송 (그누보드5 방식)
    await sendEmailVerificationEmail(newMember.mb_email, mb_id, mb_md5);

    return NextResponse.json({
      success: true,
      message: '회원가입이 완료되었습니다. 이메일을 확인하여 인증을 완료해주세요.',
      member: newMember
    }, { status: 201 });

  } catch (error) {
    console.error('회원가입 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 