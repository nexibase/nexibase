import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { layoutManifest } from '@/layouts/_generated'

// GET /api/admin/layouts — list available layout folders
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const layouts = Object.entries(layoutManifest).map(([key, value]) => ({
      folder: key,
      name: value.name,
      files: value.files,
    }))

    return NextResponse.json({ layouts })
  } catch (error) {
    console.error('failed to fetch layouts:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
