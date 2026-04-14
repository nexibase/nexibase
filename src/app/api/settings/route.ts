import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'
import { getLocaleFromRequest } from '@/lib/translation/resolver'
import { getLocalizedSettings } from '@/lib/translation/settings'

// 공개 설정 조회 (인증 불필요)
export async function GET(req: NextRequest) {
  try {
    const locale = getLocaleFromRequest(req)
    const settingsMap = await getLocalizedSettings(locale)

    // 활성 플러그인 목록
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
    console.error('설정 조회 에러:', error)
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
