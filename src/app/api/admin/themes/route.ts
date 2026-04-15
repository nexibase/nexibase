import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { themeManifest } from '@/themes/_generated'

// GET /api/admin/themes — list available themes
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const themes = Object.entries(themeManifest).map(([folder, meta]) => ({
      folder,
      ...meta,
    }))

    return NextResponse.json({ themes })
  } catch (error) {
    console.error('failed to fetch themes:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
