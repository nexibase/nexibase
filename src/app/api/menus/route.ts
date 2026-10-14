import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getDisabledSlugs } from '@/lib/plugins'

/** 쿠키 동의 기능이 켜져 있는지. 읽기 실패는 꺼짐으로 본다(readConsentContext와 동일). */
async function isConsentEnabled(): Promise<boolean> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: 'consent_enabled' } })
    return row?.value?.trim().toLowerCase() === 'true'
  } catch {
    return false
  }
}

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
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })

    // Filter out menus belonging to disabled plugins
    const disabledSlugs = await getDisabledSlugs()
    let menus = allMenus.filter(menu => {
      // Check if menu URL starts with a disabled plugin's slug
      return !disabledSlugs.some(slug => menu.url === `/${slug}` || menu.url.startsWith(`/${slug}/`))
    })

    // 쿠키 동의 기능이 꺼져 있으면 쿠키 정책 링크도 감춘다.
    // 그 상태에서는 배너도 동의 절차도 없으므로, "동의하기 전까지 사용되지
    // 않습니다" 나 "설정에서 바꾸실 수 있습니다" 같은 정책 문구가 사실과
    // 어긋난다. 없는 절차를 설명하는 문서를 띄우는 것보다 감추는 편이 낫다.
    // 페이지 자체는 직접 주소로 접근하면 여전히 열린다.
    if (!(await isConsentEnabled())) {
      menus = menus.filter(menu => menu.url !== '/policies/cookie')
    }

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
