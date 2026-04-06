import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getAllPlugins } from '@/lib/plugins'

export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 })
    }

    const plugins = await getAllPlugins()

    return NextResponse.json({ plugins })
  } catch (error) {
    console.error('플러그인 목록 조회 에러:', error)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
