import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

// 쇼핑몰 설정 조회 (관리자)
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const settings = await prisma.shopSetting.findMany()

    // key-value 형태로 변환
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

// 쇼핑몰 설정 저장 (관리자)
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: '설정 데이터가 필요합니다.' },
        { status: 400 }
      )
    }

    // 각 설정 upsert
    for (const [key, value] of Object.entries(settings)) {
      await prisma.shopSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('설정 저장 에러:', error)
    return NextResponse.json(
      { error: '설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
