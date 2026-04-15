import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// POST /api/admin/home-widgets/reset — delete every widget and reapply the default layout
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    // Delete all widgets
    await prisma.homeWidget.deleteMany()

    // Default widget layout
    const defaults = [
      { widgetKey: 'welcome-banner', zone: 'top', title: '환영 배너', colSpan: 12, rowSpan: 1, sortOrder: 0 },
      { widgetKey: 'site-stats', zone: 'top', title: '사이트 통계', colSpan: 12, rowSpan: 1, sortOrder: 1 },
      { widgetKey: 'latest-posts', zone: 'center', title: '최근 게시글', colSpan: 6, rowSpan: 2, sortOrder: 0, settings: JSON.stringify({ limit: 6 }) },
      { widgetKey: 'popular-boards', zone: 'center', title: '인기 게시판', colSpan: 6, rowSpan: 2, sortOrder: 1, settings: JSON.stringify({ limit: 5 }) },
      { widgetKey: 'community-guide', zone: 'center', title: '커뮤니티 가이드', colSpan: 6, rowSpan: 1, sortOrder: 2 },
      { widgetKey: 'board-cards', zone: 'bottom', title: '게시판 카드', colSpan: 12, rowSpan: 1, sortOrder: 0, settings: JSON.stringify({ limit: 4 }) },
    ]

    for (const w of defaults) {
      await prisma.homeWidget.create({ data: w })
    }

    return NextResponse.json({ success: true, message: '초기화 완료', count: defaults.length })
  } catch (error) {
    console.error('failed to reset widgets:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
