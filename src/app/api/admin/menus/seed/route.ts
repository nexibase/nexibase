import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { seedHomeWidgets } from '@/lib/widgets/seed-home'
import { localeRegistry } from '@/lib/install/_generated-registry'

// POST /api/admin/menus/seed — seed initial menu data
export async function POST() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    return await prisma.$transaction(async tx => {
      // Check if menus already exist
      const existingCount = await tx.menu.count()
      if (existingCount > 0) {
        return NextResponse.json({ message: '이미 메뉴 데이터가 존재합니다.', count: existingCount })
      }

      // Header menus
      const headerMenus = [
        { position: 'header', label: '홈', url: '/', sortOrder: 0 },
        { position: 'header', label: '인기', url: '/posts/popular', icon: '🔥', sortOrder: 1 },
        { position: 'header', label: '쇼핑', url: '/shop', icon: '🛒', sortOrder: 2 },
      ]

      // Read boards from DB and add as header menu items
      const boards = await tx.board.findMany({
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
        { position: 'footer', groupName: '정보', label: '자주 묻는 질문', url: '/faqs', sortOrder: 1 },
        { position: 'footer', groupName: '정보', label: '문의하기', url: '/contents/contact', sortOrder: 2 },
        { position: 'footer', groupName: '정책', label: '이용약관', url: '/policies/terms', sortOrder: 0 },
        { position: 'footer', groupName: '정책', label: '개인정보처리방침', url: '/policies/privacy', sortOrder: 1 },
        { position: 'footer', groupName: '정책', label: '취소/반품 정책', url: '/shop/policy', sortOrder: 2 },
      ]

      // Create all menus
      const allMenus: Prisma.MenuCreateManyInput[] = [
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

      await tx.menu.createMany({ data: allMenus })

      // Reuse the installation defaults and the current WidgetPage/PageWidget model.
      const locale = await tx.setting.findUnique({ where: { key: 'site_locale' } })
      const seed = (localeRegistry[locale?.value ?? 'en'] ?? localeRegistry.en).seed
      await seedHomeWidgets(tx, seed.widgets, true)

      return NextResponse.json({
        success: true,
        menuCount: allMenus.length,
        message: '메뉴와 위젯 시드 데이터가 생성되었습니다.',
      })
    })
  } catch (error) {
    console.error('failed to seed menus:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
