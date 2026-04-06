import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'

// POST /api/admin/plugins/[folder]/activate
// Called when plugin is enabled — seeds menus and widgets into DB
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { folder } = await params
    const plugin = pluginManifest[folder]
    if (!plugin) {
      return NextResponse.json({ error: '존재하지 않는 플러그인' }, { status: 404 })
    }

    const menus = plugin.headerMenus || []
    const widgets = plugin.widgetMetas || []
    const slug = plugin.slug

    let menuCount = 0
    let widgetCount = 0

    // Seed header menus
    for (const menu of menus) {
      const existing = await prisma.menu.findFirst({
        where: { url: `/${slug}`, position: 'header' }
      })
      if (!existing) {
        await prisma.menu.create({
          data: {
            position: 'header',
            label: menu.label,
            url: `/${slug}`,
            icon: menu.icon || null,
            sortOrder: menu.sortOrder || 0,
          }
        })
        menuCount++
      }
    }

    // Seed widgets
    for (const widget of widgets) {
      const existing = await prisma.homeWidget.findFirst({
        where: { widgetKey: widget.widgetKey }
      })
      if (!existing) {
        await prisma.homeWidget.create({
          data: {
            widgetKey: widget.widgetKey,
            zone: widget.defaultZone,
            title: widget.title,
            colSpan: widget.defaultColSpan || 1,
            rowSpan: widget.defaultRowSpan || 1,
            settings: widget.settingsSchema ? JSON.stringify(widget.settingsSchema) : null,
            isActive: true,
            sortOrder: 0,
          }
        })
        widgetCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `메뉴 ${menuCount}개, 위젯 ${widgetCount}개 등록됨`,
    })
  } catch (error) {
    console.error('플러그인 활성화 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
