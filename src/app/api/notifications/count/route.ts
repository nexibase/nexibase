import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Count unread notifications only (lightweight API for the header)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ count: 0 });
    }

    const count = await prisma.notification.count({
      where: { userId: session.id, isRead: false, deletedAt: null },
    });

    return NextResponse.json({ count });
  } catch (error) {
    console.error('failed to fetch notification count:', error);
    return NextResponse.json({ count: 0 });
  }
}
