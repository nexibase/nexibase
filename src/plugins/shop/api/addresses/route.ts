import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// 주소록 목록 조회
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const addresses = await prisma.userAddress.findMany({
      where: { userId: session.id },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error('주소록 조회 에러:', error);
    return NextResponse.json({ error: '주소록 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 주소 추가
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { name, recipientName, recipientPhone, zipCode, address, addressDetail, isDefault, skipDuplicate } = body;

    // 유효성 검사 (자동 저장 시에는 name이 자동 생성됨)
    if (!recipientName || !recipientPhone || !zipCode || !address) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    // 중복 체크: 동일한 주소가 이미 있는지 확인
    const existingAddress = await prisma.userAddress.findFirst({
      where: {
        userId: session.id,
        zipCode,
        address,
        addressDetail: addressDetail || null,
      },
    });

    // 중복된 주소가 있으면 기존 주소 반환 (skipDuplicate 옵션 시)
    if (existingAddress) {
      if (skipDuplicate) {
        return NextResponse.json({ address: existingAddress, message: '이미 등록된 주소입니다.', duplicate: true });
      }
      return NextResponse.json({ error: '이미 등록된 주소입니다.' }, { status: 409 });
    }

    // 첫 번째 주소는 자동으로 기본 배송지로 설정
    const existingCount = await prisma.userAddress.count({
      where: { userId: session.id },
    });

    // 배송지명 자동 생성 (name이 없는 경우)
    const addressName = name || `배송지 ${existingCount + 1}`;

    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    const shouldBeDefault = isDefault || existingCount === 0;
    if (shouldBeDefault) {
      await prisma.userAddress.updateMany({
        where: { userId: session.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const newAddress = await prisma.userAddress.create({
      data: {
        userId: session.id,
        name: addressName,
        recipientName,
        recipientPhone,
        zipCode,
        address,
        addressDetail: addressDetail || null,
        isDefault: shouldBeDefault,
      },
    });

    return NextResponse.json({ address: newAddress, message: '주소가 추가되었습니다.' });
  } catch (error) {
    console.error('주소 추가 에러:', error);
    return NextResponse.json({ error: '주소 추가 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
