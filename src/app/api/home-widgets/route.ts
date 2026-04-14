import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'
import { isPluginEnabled } from '@/lib/plugins'
import { getLocaleFromRequest, flattenTranslations } from '@/lib/translation/resolver'

// GET /api/home-widgets — active widgets by zone, sorted
export async function GET(request: NextRequest) {
  const locale = getLocaleFromRequest(request)
  try {
    const allWidgets = await prisma.homeWidget.findMany({
      where: { isActive: true },
      orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      include: { translations: { where: { locale } } },
    })

    // Build set of disabled plugin folder names
    const disabledFolders = new Set<string>()
    for (const [folder] of Object.entries(pluginManifest)) {
      const enabled = await isPluginEnabled(folder)
      if (!enabled) {
        disabledFolders.add(folder)
      }
    }

    // Filter out widgets belonging to disabled plugins
    const widgets = allWidgets.filter(widget => {
      return !Array.from(disabledFolders).some(folder =>
        widget.widgetKey.startsWith(`${folder}-`)
      )
    })

    // Flatten translations into each widget
    const flatWidgets = flattenTranslations(
      widgets as (typeof widgets[number] & { translations?: { locale: string; title: string }[] })[],
      locale,
      ['title']
    )

    // Group by zone
    const grouped: Record<string, typeof flatWidgets> = {}
    for (const widget of flatWidgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push({
        ...widget,
        settings: widget.settings ? widget.settings : null,
      })
    }

    return NextResponse.json({ widgets: grouped })
  } catch (error) {
    console.error('위젯 조회 에러:', error)
    return NextResponse.json({ widgets: {} })
  }
}
