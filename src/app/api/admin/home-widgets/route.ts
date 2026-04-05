import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Widget registry keys — must match src/lib/widgets/registry.ts
const REGISTRY_KEYS = [
  'welcome-banner',
  'site-stats',
  'latest-posts',
  'popular-boards',
  'shop-shortcut',
  'auction-live',
  'community-guide',
  'board-cards',
]

// GET /api/admin/home-widgets — all widgets + unregistered widget keys
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const widgets = await prisma.homeWidget.findMany({
      orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
    })

    const existingKeys = new Set(widgets.map(w => w.widgetKey))
    const unregistered = REGISTRY_KEYS.filter(key => !existingKeys.has(key))

    return NextResponse.json({ widgets, unregistered })
  } catch (error) {
    console.error('관리자 위젯 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
