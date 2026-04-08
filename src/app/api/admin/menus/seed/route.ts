import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// POST /api/admin/menus/seed — seed initial menu data
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    // Check if menus already exist
    const existingCount = await prisma.menu.count()
    if (existingCount > 0) {
      return NextResponse.json({ message: '이미 메뉴 데이터가 존재합니다.', count: existingCount })
    }

    // Header menus
    const headerMenus = [
      { position: 'header', label: '홈', url: '/', sortOrder: 0 },
      { position: 'header', label: '인기', url: '/posts/popular', icon: '🔥', sortOrder: 1 },
      { position: 'header', label: '쇼핑', url: '/shop', icon: '🛒', sortOrder: 2 },
      { position: 'header', label: '경매', url: '/auction', icon: '🔨', sortOrder: 3 },
    ]

    // Read boards from DB and add as header menu items
    const boards = await prisma.board.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })

    boards.forEach((board, index) => {
      headerMenus.push({
        position: 'header',
        label: board.name,
        url: `/boards/${board.slug}`,
        icon: '',
        sortOrder: 10 + index,
      })
    })

    // Footer menus
    const footerMenus = [
      { position: 'footer', groupName: '커뮤니티', label: '홈', url: '/', sortOrder: 0 },
      { position: 'footer', groupName: '커뮤니티', label: '인기글', url: '/posts/popular', sortOrder: 1 },
      { position: 'footer', groupName: '커뮤니티', label: '전체게시판', url: '/boards', sortOrder: 2 },
      { position: 'footer', groupName: '정보', label: '회사소개', url: '/contents/about', sortOrder: 0 },
      { position: 'footer', groupName: '정보', label: '자주 묻는 질문', url: '/contents/faq', sortOrder: 1 },
      { position: 'footer', groupName: '정보', label: '문의하기', url: '/contents/contact', sortOrder: 2 },
      { position: 'footer', groupName: '정책', label: '이용약관', url: '/policies/terms', sortOrder: 0 },
      { position: 'footer', groupName: '정책', label: '개인정보처리방침', url: '/policies/privacy', sortOrder: 1 },
      { position: 'footer', groupName: '정책', label: '취소/반품 정책', url: '/shop/policy', sortOrder: 2 },
    ]

    // Create all menus
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allMenus: any[] = [
      ...headerMenus.map(m => ({
        position: m.position,
        label: m.label,
        url: m.url,
        icon: m.icon || null,
        sortOrder: m.sortOrder,
      })),
      ...footerMenus.map(m => ({
        position: m.position,
        groupName: m.groupName,
        label: m.label,
        url: m.url,
        sortOrder: m.sortOrder,
      })),
    ]

    for (const menuData of allMenus) {
      await prisma.menu.create({ data: menuData })
    }

    // Seed home widgets
    const existingWidgets = await prisma.homeWidget.count()
    if (existingWidgets === 0) {
      const widgets = [
        { widgetKey: 'welcome-banner', zone: 'hero', title: '환영 배너', colSpan: 2, rowSpan: 2, sortOrder: 0 },
        { widgetKey: 'site-stats', zone: 'hero', title: '사이트 통계', colSpan: 2, rowSpan: 1, sortOrder: 1 },
        { widgetKey: 'latest-posts', zone: 'main', title: '최근 게시글', colSpan: 2, rowSpan: 2, sortOrder: 0, settings: JSON.stringify({ limit: 6 }) },
        { widgetKey: 'auction-live', zone: 'main', title: '진행중 경매', colSpan: 2, rowSpan: 1, sortOrder: 1, settings: JSON.stringify({ limit: 4 }) },
        { widgetKey: 'shop-shortcut', zone: 'main', title: '쇼핑몰 바로가기', colSpan: 1, rowSpan: 1, sortOrder: 2 },
        { widgetKey: 'popular-boards', zone: 'sidebar', title: '인기 게시판', colSpan: 1, rowSpan: 2, sortOrder: 0, settings: JSON.stringify({ limit: 5 }) },
        { widgetKey: 'community-guide', zone: 'sidebar', title: '커뮤니티 가이드', colSpan: 1, rowSpan: 1, sortOrder: 1 },
        { widgetKey: 'board-cards', zone: 'bottom', title: '게시판 카드', colSpan: 4, rowSpan: 1, sortOrder: 0, settings: JSON.stringify({ limit: 4 }) },
      ]

      for (const widget of widgets) {
        await prisma.homeWidget.create({ data: widget })
      }
    }

    return NextResponse.json({
      success: true,
      menuCount: allMenus.length,
      message: '메뉴와 위젯 시드 데이터가 생성되었습니다.',
    })
  } catch (error) {
    console.error('메뉴 시드 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
