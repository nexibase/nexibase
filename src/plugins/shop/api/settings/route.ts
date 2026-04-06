import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 쇼핑몰 설정 조회 (공개)
export async function GET() {
  try {
    const settings = await prisma.shopSetting.findMany()

    // key-value 형태로 변환
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      settingsMap[s.key] = s.value
    })

    // 공개 가능한 설정만 반환
    const publicSettings = {
      shop_name: settingsMap.shop_name || '쇼핑몰',
      shop_tel: settingsMap.shop_tel || '',
      bank_info: settingsMap.bank_info || '',
      delivery_notice: settingsMap.delivery_notice || '',
      refund_policy: settingsMap.refund_policy || '',
    }

    return NextResponse.json({ settings: publicSettings })
  } catch (error) {
    console.error('쇼핑몰 설정 조회 에러:', error)
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}
