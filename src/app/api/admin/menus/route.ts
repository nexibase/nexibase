import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { pluginManifest } from '@/plugins/_generated'
import { isPluginEnabled } from '@/lib/plugins'

// Menu URL → plugin folder 매핑
function getMenuPlugin(url: string): string | null {
  for (const [folder, meta] of Object.entries(pluginManifest)) {
    const slug = meta.slug
    // Check if URL starts with plugin slug
    if (url === `/${slug}` || url.startsWith(`/${slug}/`)) {
      return folder
    }
  }
  return null
}

// GET /api/admin/menus — full menu tree for admin
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const menus = await prisma.menu.findMany({
      where: { parentId: null },
      include: {
        children: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ position: 'asc' }, { sortOrder: 'asc' }],
    })

    // 각 메뉴에 플러그인 활성 상태 추가
    const menusWithPluginStatus = await Promise.all(
      menus.map(async (m) => {
        const pluginFolder = getMenuPlugin(m.url)
        let pluginEnabled = true
        let pluginName: string | null = null

        if (pluginFolder) {
          pluginEnabled = await isPluginEnabled(pluginFolder)
          pluginName = pluginManifest[pluginFolder]?.name || pluginFolder
        }

        const children = await Promise.all(
          (m.children || []).map(async (child) => {
            const childPluginFolder = getMenuPlugin(child.url)
            let childPluginEnabled = true
            let childPluginName: string | null = null

            if (childPluginFolder) {
              childPluginEnabled = await isPluginEnabled(childPluginFolder)
              childPluginName = pluginManifest[childPluginFolder]?.name || childPluginFolder
            }

            return { ...child, pluginFolder: childPluginFolder, pluginEnabled: childPluginEnabled, pluginName: childPluginName }
          })
        )

        return { ...m, children, pluginFolder, pluginEnabled, pluginName }
      })
    )

    const header = menusWithPluginStatus.filter(m => m.position === 'header')
    const footer = menusWithPluginStatus.filter(m => m.position === 'footer')

    return NextResponse.json({ header, footer })
  } catch (error) {
    console.error('관리자 메뉴 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// POST /api/admin/menus — create menu item
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { parentId, position, groupName, label, url, icon, target, visibility, isActive, sortOrder } = body

    if (!label || !url || !position) {
      return NextResponse.json({ error: '필수 필드가 누락되었습니다.' }, { status: 400 })
    }

    const menu = await prisma.menu.create({
      data: {
        parentId: parentId || null,
        position,
        groupName: groupName || null,
        label,
        url,
        icon: icon || null,
        target: target || '_self',
        visibility: visibility || 'all',
        isActive: isActive !== undefined ? isActive : true,
        sortOrder: sortOrder || 0,
      },
    })

    return NextResponse.json({ menu })
  } catch (error) {
    console.error('메뉴 생성 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
