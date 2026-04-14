import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import { pluginManifest } from '@/plugins/_generated'
import { isPluginEnabled } from '@/lib/plugins'
import { widgetMetadata, widgetKeys } from '@/lib/widgets/_generated-metadata'

// widgetKey → plugin folder 매핑
function getWidgetPlugin(widgetKey: string): string | null {
  for (const [folder, meta] of Object.entries(pluginManifest)) {
    if (meta.hasWidgets) {
      const widgetMetas = // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (meta as any).widgetMetas as Array<{ widgetKey: string }> | undefined
      if (widgetMetas?.some(w => w.widgetKey === widgetKey)) {
        return folder
      }
    }
  }
  // widgetKey가 플러그인 폴더명으로 시작하면 해당 플러그인 소속
  for (const folder of Object.keys(pluginManifest)) {
    if (widgetKey.startsWith(`${folder}-`)) {
      return folder
    }
  }
  return null
}

// GET /api/admin/home-widgets — all widgets + unregistered widget keys + plugin status
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const widgets = await prisma.homeWidget.findMany({
      orderBy: [{ zone: 'asc' }, { sortOrder: 'asc' }],
      include: { translations: true },
    })

    // 각 위젯에 플러그인 활성 상태 추가
    const widgetsWithPluginStatus = await Promise.all(
      widgets.map(async (w) => {
        const pluginFolder = getWidgetPlugin(w.widgetKey)
        let pluginEnabled = true
        let pluginName: string | null = null

        if (pluginFolder) {
          pluginEnabled = await isPluginEnabled(pluginFolder)
          pluginName = pluginManifest[pluginFolder]?.name || pluginFolder
        }

        return { ...w, pluginFolder, pluginEnabled, pluginName }
      })
    )

    const existingKeys = new Set(widgets.map(w => w.widgetKey))
    const unregistered = widgetKeys.filter(key => !existingKeys.has(key))

    return NextResponse.json({
      widgets: widgetsWithPluginStatus,
      unregistered,
      metadata: widgetMetadata,
    })
  } catch (error) {
    console.error('관리자 위젯 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
