import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import {
  translateSettingOnSave,
  invalidateSettingTranslations,
  isTranslatableSettingKey,
  TRANSLATABLE_SETTING_KEYS,
} from '@/lib/translation/settings'

// 설정 조회
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const settings = await prisma.setting.findMany()

    // key-value 객체로 변환
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      settingsMap[s.key] = s.value
    })

    // 번역 가능한 3개 키의 기존 번역 목록 반환
    const translations = await prisma.settingTranslation.findMany({
      where: { key: { in: TRANSLATABLE_SETTING_KEYS as string[] } },
    })

    return NextResponse.json({ settings: settingsMap, translations })
  } catch (error) {
    console.error('설정 조회 에러:', error)
    return NextResponse.json(
      { error: '설정을 불러오는데 실패했습니다.' },
      { status: 500 }
    )
  }
}

// 설정 저장 (upsert)
export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const { settings, translations } = body as {
      settings: Record<string, string>
      translations?: Record<string, Record<string, string>>
    }

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: '잘못된 요청입니다.' },
        { status: 400 }
      )
    }

    // 각 설정을 upsert하고, 번역 대상이면 자동 번역도 수행
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })

      if (isTranslatableSettingKey(key)) {
        try {
          await invalidateSettingTranslations(key)
          await translateSettingOnSave(key, String(value))
        } catch (err) {
          console.error('[translateSettingOnSave]', key, err)
        }
      }
    }

    // 수동 번역 오버라이드 처리
    if (translations) {
      for (const [key, byLocale] of Object.entries(translations as Record<string, Record<string, string>>)) {
        if (!isTranslatableSettingKey(key)) continue
        for (const [locale, value] of Object.entries(byLocale)) {
          if (!value) continue
          await prisma.settingTranslation.upsert({
            where: { key_locale: { key, locale } },
            create: { key, locale, value, source: 'manual' },
            update: { value, source: 'manual' },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: '설정이 저장되었습니다.',
    })
  } catch (error) {
    console.error('설정 저장 에러:', error)
    return NextResponse.json(
      { error: '설정 저장에 실패했습니다.' },
      { status: 500 }
    )
  }
}
