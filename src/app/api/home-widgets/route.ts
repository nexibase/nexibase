import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'
import { isPluginEnabled } from '@/lib/plugins'

// GET /api/home-widgets — active widgets by zone, sorted
export async function GET() {
  try {
    const allWidgets = await prisma.homeWidget.findMany({
      where: { isActive: true },
      orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
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

    // Group by zone
    const grouped: Record<string, typeof widgets> = {}
    for (const widget of widgets) {
      if (!grouped[widget.zone]) grouped[widget.zone] = []
      grouped[widget.zone].push({
        ...widget,
        settings: widget.settings ? widget.settings : null,
      })
    }

    return NextResponse.json({ widgets: grouped })
  } catch (error) {
    console.error('failed to fetch widgets:', error)
    return NextResponse.json({ widgets: {} })
  }
}
