import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'

export async function GET(request: NextRequest) {
  const middlewareCheck = request.headers.get('x-middleware-check')
  if (middlewareCheck !== 'true') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const folder = request.nextUrl.searchParams.get('folder')
  if (!folder || !pluginManifest[folder]) {
    return NextResponse.json({ enabled: true })
  }

  try {
    const setting = await prisma.setting.findUnique({
      where: { key: `plugin_${folder}_enabled` }
    })

    if (setting) {
      return NextResponse.json({ enabled: setting.value === 'true' })
    }

    return NextResponse.json({ enabled: pluginManifest[folder].defaultEnabled })
  } catch {
    return NextResponse.json({ enabled: true })
  }
}
