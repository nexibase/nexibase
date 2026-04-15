import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { pluginManifest } from '@/plugins/_generated'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const { folder } = await params

    if (!pluginManifest[folder]) {
      return NextResponse.json({ error: '존재하지 않는 플러그인입니다.' }, { status: 404 })
    }

    const body = await request.json()
    const { enabled, slug } = body

    if (enabled !== undefined) {
      await prisma.setting.upsert({
        where: { key: `plugin_${folder}_enabled` },
        update: { value: String(enabled) },
        create: { key: `plugin_${folder}_enabled`, value: String(enabled) },
      })
    }

    if (slug !== undefined) {
      for (const [otherFolder, meta] of Object.entries(pluginManifest)) {
        if (otherFolder !== folder && meta.slug === slug) {
          return NextResponse.json(
            { error: `slug '${slug}'는 이미 '${meta.name}' 플러그인에서 사용중입니다.` },
            { status: 400 }
          )
        }
      }

      const existingSlugs = await prisma.setting.findMany({
        where: {
          key: { startsWith: 'plugin_', endsWith: '_slug' },
          NOT: { key: `plugin_${folder}_slug` },
        }
      })
      for (const s of existingSlugs) {
        if (s.value === slug) {
          return NextResponse.json(
            { error: `slug '${slug}'는 이미 다른 플러그인에서 사용중입니다.` },
            { status: 400 }
          )
        }
      }

      await prisma.setting.upsert({
        where: { key: `plugin_${folder}_slug` },
        update: { value: slug },
        create: { key: `plugin_${folder}_slug`, value: slug },
      })
    }

    return NextResponse.json({ success: true, message: '플러그인 설정이 저장되었습니다.' })
  } catch (error) {
    console.error('failed to save plugin settings:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
