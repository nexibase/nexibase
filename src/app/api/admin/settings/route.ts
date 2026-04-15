import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'

// Fetch settings
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const settings = await prisma.setting.findMany()

    // Convert to a key-value object
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      settingsMap[s.key] = s.value
    })

    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('failed to fetch settings:', error)
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// Save settings (upsert)
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { settings } = body as { settings: Record<string, string> }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: '잘못된 요청입니다.' },
        { status: 400 }
      )
    }

    // Upsert each setting
    const promises = Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    )

    await Promise.all(promises)

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다.'
    })
  } catch (error) {
    console.error('failed to save settings:', error)
    return NextResponse.json(
      { error: '설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
