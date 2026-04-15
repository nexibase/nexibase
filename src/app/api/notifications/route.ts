import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Fetch notification list
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    const where = {
      userId: session.id,
      deletedAt: null,  // Soft delete된 알림 제외
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, totalCount, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: session.id, isRead: false, deletedAt: null },
      }),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      }
    });
  } catch (error) {
    console.error('failed to fetch notifications:', error);
    return NextResponse.json({ error: '알림 조회 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// Mark notification as read
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { notificationId, markAllRead } = body;

    if (markAllRead) {
      // Mark all notifications as read
      await prisma.notification.updateMany({
        where: { userId: session.id, isRead: false, deletedAt: null },
        data: { isRead: true },
      });
      return NextResponse.json({ message: '모든 알림을 읽음 처리했습니다.' });
    }

    if (notificationId) {
      // Mark a specific notification as read
      await prisma.notification.updateMany({
        where: { id: notificationId, userId: session.id },
        data: { isRead: true },
      });
      return NextResponse.json({ message: '알림을 읽음 처리했습니다.' });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('failed to mark notifications as read:', error);
    return NextResponse.json({ error: '알림 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

// Delete notifications (soft delete)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');
    const deleteAll = searchParams.get('deleteAll') === 'true';

    if (deleteAll) {
      // Soft delete all notifications
      await prisma.notification.updateMany({
        where: { userId: session.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ message: '모든 알림을 삭제했습니다.' });
    }

    if (notificationId) {
      // Soft delete a specific notification
      await prisma.notification.updateMany({
        where: { id: parseInt(notificationId), userId: session.id, deletedAt: null },
        data: { deletedAt: new Date() },
      });
      return NextResponse.json({ message: '알림을 삭제했습니다.' });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('failed to delete notifications:', error);
    return NextResponse.json({ error: '알림 삭제 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
