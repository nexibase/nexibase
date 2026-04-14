import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDisabledSlugs } from '@/lib/plugins'
import { getLocaleFromRequest, flattenTranslation, flattenTranslations } from '@/lib/translation/resolver'

// GET /api/menus?position=header|footer&locale=en|ko
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const position = searchParams.get('position') || 'header'
    const locale = getLocaleFromRequest(request)

    const allMenus = await prisma.menu.findMany({
      where: {
        position,
        isActive: true,
        parentId: null,
      },
      include: {
        translations: { where: { locale } },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            translations: { where: { locale } },
          },
        },
      },
      orderBy: { sortOrder: 'asc' },
    })

    // Filter out menus belonging to disabled plugins
    const disabledSlugs = await getDisabledSlugs()
    const filtered = allMenus.filter(menu => {
      // Check if menu URL starts with a disabled plugin's slug
      return !disabledSlugs.some(slug => menu.url === `/${slug}` || menu.url.startsWith(`/${slug}/`))
    })

    // Flatten translations for each menu (and its children) using the requested locale
    const menus = filtered.map(menu => {
      const flatChildren = flattenTranslations(
        menu.children as (typeof menu.children[number] & { translations?: { locale: string; label: string }[] })[],
        locale,
        ['label']
      )
      const flat = flattenTranslation(menu, locale, ['label'])
      return { ...flat, children: flatChildren }
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
