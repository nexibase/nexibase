import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 공개 설정 조회 (인증 불필요)
export async function GET() {
  try {
    const settings = await prisma.setting.findMany()

    // key-value 객체로 변환
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      settingsMap[s.key] = s.value
    })

    return NextResponse.json({ settings: settingsMap })
  } catch (error) {
    console.error('설정 조회 에러:', error)
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
