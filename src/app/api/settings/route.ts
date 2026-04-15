import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'

// Public settings (no auth required)
export async function GET() {
  try {
    const settings = await prisma.setting.findMany()

    // Convert to a key-value object
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      settingsMap[s.key] = s.value
    })

    // List of enabled plugins
    const enabledPlugins: string[] = []
    for (const [folder, meta] of Object.entries(pluginManifest)) {
      const setting = settingsMap[`plugin_${folder}_enabled`]
      const enabled = setting ? setting === 'true' : meta.defaultEnabled
      if (enabled) {
        enabledPlugins.push(folder)
      }
    }

    return NextResponse.json({ settings: settingsMap, enabledPlugins })
  } catch (error) {
    console.error('failed to fetch settings:', error)
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
