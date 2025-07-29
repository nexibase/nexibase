import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePBKDF2Hash } from '@/lib/auth';

interface WhereClause {
  mb_id?: { contains: string };
  mb_name?: { contains: string };
  mb_nick?: { contains: string };
  mb_email?: { contains: string };
  mb_intercept_date?: { not: string };
  mb_leave_date?: { not: string };
}

// 회원 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const searchType = searchParams.get('searchType') || '';
    const searchValue = searchParams.get('searchValue') || '';
    const filter = searchParams.get('filter') || '전체목록';

    const skip = (page - 1) * limit;

    // 검색 조건 구성
    const whereClause: WhereClause = {};
    
    if (searchValue) {
      switch (searchType) {
        case '회원아이디':
          whereClause.mb_id = { contains: searchValue };
          break;
        case '이름':
          whereClause.mb_name = { contains: searchValue };
          break;
        case '닉네임':
          whereClause.mb_nick = { contains: searchValue };
          break;
        case '이메일':
          whereClause.mb_email = { contains: searchValue };
          break;
      }
    }

    // 필터 조건 추가
    if (filter === '차단') {
      whereClause.mb_intercept_date = { not: '' };
    } else if (filter === '탈퇴') {
      whereClause.mb_leave_date = { not: '' };
    }

    // 회원 목록 조회
    const members = await prisma.g5Member.findMany({
      where: whereClause,
      select: {
        mb_no: true,
        mb_id: true,
        mb_name: true,
        mb_nick: true,
        mb_email: true,
        mb_level: true,
        mb_certify: true,
        mb_adult: true,
        mb_mailling: true,
        mb_sms: true,
        mb_open: true,
        mb_point: true,
        mb_today_login: true,
        mb_datetime: true,
        mb_leave_date: true,
        mb_intercept_date: true,
        mb_email_certify: true,
        mb_hp: true,
        mb_tel: true
      },
      orderBy: { mb_datetime: 'desc' },
      skip,
      take: limit
    });

    // 전체 회원 수 조회
    const totalCount = await prisma.g5Member.count({ where: whereClause });

    // 통계 정보
    const totalMembers = await prisma.g5Member.count();
    const blockedMembers = await prisma.g5Member.count({
      where: { mb_intercept_date: { not: '' } }
    });
    const withdrawnMembers = await prisma.g5Member.count({
      where: { mb_leave_date: { not: '' } }
    });

    return NextResponse.json({
      success: true,
      members,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      stats: {
        totalMembers,
        blockedMembers,
        withdrawnMembers
      }
    });

  } catch (error) {
    console.error('회원 목록 조회 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// 회원 정보 수정
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { mb_id, updates } = body;

    if (!mb_id) {
      return NextResponse.json(
        { error: '회원 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const updatedMember = await prisma.g5Member.update({
      where: { mb_id },
      data: updates,
      select: {
        mb_no: true,
        mb_id: true,
        mb_name: true,
        mb_nick: true,
        mb_email: true,
        mb_level: true,
        mb_certify: true,
        mb_adult: true,
        mb_mailling: true,
        mb_sms: true,
        mb_open: true,
        mb_point: true,
        mb_today_login: true,
        mb_datetime: true
      }
    });

    return NextResponse.json({
      success: true,
      message: '회원 정보가 수정되었습니다.',
      member: updatedMember
    });

  } catch (error) {
    console.error('회원 정보 수정 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// 회원 삭제 (실제 삭제가 아닌 탈퇴 처리)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mb_id = searchParams.get('mb_id');

    if (!mb_id) {
      return NextResponse.json(
        { error: '회원 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    // 탈퇴 처리 (실제 삭제가 아닌 탈퇴 날짜 기록)
    await prisma.g5Member.update({
      where: { mb_id },
      data: {
        mb_leave_date: new Date().toISOString().slice(0, 10).replace(/-/g, '')
      }
    });

    return NextResponse.json({
      success: true,
      message: '회원이 탈퇴 처리되었습니다.'
    });

  } catch (error) {
    console.error('회원 삭제 에러:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
} 

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      mb_id,
      mb_password,
      mb_name,
      mb_nick,
      mb_email,
      mb_level,
      mb_certify,
      mb_adult,
      mb_mailling,
      mb_sms,
      mb_open,
      mb_point,
      mb_hp,
      mb_tel
    } = body

    // 필수 필드 검증
    if (!mb_id || !mb_password || !mb_name || !mb_nick || !mb_email) {
      return NextResponse.json(
        { error: '필수 필드를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    // 회원 ID 중복 확인
    const existingMember = await prisma.g5Member.findFirst({
      where: { mb_id },
      select: { mb_id: true }
    })

    if (existingMember) {
      return NextResponse.json(
        { error: '이미 사용 중인 회원 ID입니다.' },
        { status: 409 }
      )
    }

    // 이메일 중복 확인
    const existingEmail = await prisma.g5Member.findFirst({
      where: { mb_email: mb_email.toLowerCase() },
      select: { mb_email: true }
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      )
    }

    // 닉네임 중복 확인
    const existingNickname = await prisma.g5Member.findFirst({
      where: { mb_nick },
      select: { mb_nick: true }
    })

    if (existingNickname) {
      return NextResponse.json(
        { error: '이미 사용 중인 닉네임입니다.' },
        { status: 409 }
      )
    }

    // 비밀번호 해시화
    const hashedPassword = generatePBKDF2Hash(mb_password)

    // 클라이언트 IP 주소 가져오기
    const clientIP = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      '127.0.0.1'

    // 회원 정보 저장
    const newMember = await prisma.g5Member.create({
      data: {
        mb_id,
        mb_password: hashedPassword,
        mb_name,
        mb_nick,
        mb_email: mb_email.toLowerCase(),
        mb_level: mb_level || 2,
        mb_certify: mb_certify || '',
        mb_adult: mb_adult || 0,
        mb_mailling: mb_mailling || 0,
        mb_sms: mb_sms || 0,
        mb_open: mb_open || 0,
        mb_point: mb_point || 0,
        mb_hp: mb_hp || '',
        mb_tel: mb_tel || '',
        mb_datetime: new Date(),
        mb_ip: clientIP,
        mb_nick_date: new Date(),
        mb_today_login: new Date('1970-01-01'),
        mb_email_certify: new Date('1970-01-01'),
        mb_open_date: new Date('1970-01-01'),
        mb_signature: '',
        mb_memo: '',
        mb_lost_certify: 'N',
        mb_profile: ''
      },
      select: {
        mb_no: true,
        mb_id: true,
        mb_name: true,
        mb_nick: true,
        mb_email: true,
        mb_level: true,
        mb_datetime: true
      }
    })

    return NextResponse.json({
      success: true,
      message: '회원이 성공적으로 추가되었습니다.',
      member: newMember
    }, { status: 201 })

  } catch (error) {
    console.error('회원 추가 에러:', error)
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
} 