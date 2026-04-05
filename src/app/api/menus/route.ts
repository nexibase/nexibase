import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/menus?position=header|footer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position') || 'header'

    const menus = await prisma.menu.findMany({
      where: {
        position,
        isActive: true,
        parentId: null,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    if (position === 'footer') {
      // Group by groupName for footer
      const grouped: Record<string, typeof menus> = {}
      for (const menu of menus) {
        const group = menu.groupName || '기타'
        if (!grouped[group]) grouped[group] = []
        grouped[group].push(menu)
      }
      return NextResponse.json({ menus: grouped })
    }

    return NextResponse.json({ menus })
  } catch (error) {
    console.error('메뉴 조회 에러:', error)
    return NextResponse.json({ menus: [] })
  }
}
