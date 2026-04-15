import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDisabledSlugs } from '@/lib/plugins'

// GET /api/menus?position=header|footer
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position') || 'header'

    const allMenus = await prisma.menu.findMany({
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

    // Filter out menus belonging to disabled plugins
    const disabledSlugs = await getDisabledSlugs()
    const menus = allMenus.filter(menu => {
      // Check if menu URL starts with a disabled plugin's slug
      return !disabledSlugs.some(slug => menu.url === `/${slug}` || menu.url.startsWith(`/${slug}/`))
    })

    if (position === 'footer') {
      // Group by groupName for footer
      const grouped: Record<string, typeof menus> = {}
      for (const menu of menus) {
        const group = menu.groupName || 'Other'
        if (!grouped[group]) grouped[group] = []
        grouped[group].push(menu)
      }
      return NextResponse.json({ menus: grouped })
    }

    return NextResponse.json({ menus })
  } catch (error) {
    console.error('failed to fetch menus:', error)
    return NextResponse.json({ menus: [] })
  }
}
