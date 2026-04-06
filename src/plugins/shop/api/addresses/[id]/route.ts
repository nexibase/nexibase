import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

// 주소 수정
export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id } = await context.params;
    const addressId = parseInt(id);

    // 주소 소유권 확인
    const existingAddress = await prisma.userAddress.findFirst({
      where: { id: addressId, userId: session.id },
    });

    if (!existingAddress) {
      return NextResponse.json({ error: '주소를 찾을 수 없습니다.' }, { status: 404 });
    }

    const body = await request.json();
    const { name, recipientName, recipientPhone, zipCode, address, addressDetail, isDefault } = body;

    // 유효성 검사
    if (!name || !recipientName || !recipientPhone || !zipCode || !address) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 });
    }

    // 기본 배송지로 설정하는 경우 기존 기본 배송지 해제
    if (isDefault && !existingAddress.isDefault) {
      await prisma.userAddress.updateMany({
        where: { userId: session.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updatedAddress = await prisma.userAddress.update({
      where: { id: addressId },
      data: {
        name,
        recipientName,
        recipientPhone,
        zipCode,
        address,
        addressDetail: addressDetail || null,
        isDefault: isDefault ?? existingAddress.isDefault,
      },
    });

    return NextResponse.json({ address: updatedAddress, message: '주소가 수정되었습니다.' });
  } catch (error) {
    console.error('주소 수정 에러:', error);
    return NextResponse.json({ error: '주소 수정 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// 주소 삭제
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { id } = await context.params;
    const addressId = parseInt(id);

    // 주소 소유권 확인
    const existingAddress = await prisma.userAddress.findFirst({
      where: { id: addressId, userId: session.id },
    });

    if (!existingAddress) {
      return NextResponse.json({ error: '주소를 찾을 수 없습니다.' }, { status: 404 });
    }

    await prisma.userAddress.delete({
      where: { id: addressId },
    });

    // 삭제된 주소가 기본 배송지였다면 다른 주소를 기본으로 설정
    if (existingAddress.isDefault) {
      const firstAddress = await prisma.userAddress.findFirst({
        where: { userId: session.id },
        orderBy: { createdAt: 'asc' },
      });

      if (firstAddress) {
        await prisma.userAddress.update({
          where: { id: firstAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ message: '주소가 삭제되었습니다.' });
  } catch (error) {
    console.error('주소 삭제 에러:', error);
    return NextResponse.json({ error: '주소 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
