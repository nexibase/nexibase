import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminUser } from '@/lib/auth'
import {
  translateSettingOnSave,
  invalidateSettingTranslations,
  isTranslatableSettingKey,
  TRANSLATABLE_SETTING_KEYS,
} from '@/lib/translation/settings'
import {
  TRANSLATION_SETTING_KEYS,
  MASKED_CREDENTIALS_VALUE,
  isMaskedCredentialsValue,
  resetTranslateClientCache,
} from '@/lib/translation/google-client'

const CREDENTIALS_KEY = 'google_translate_credentials_json'

// 설정 조회
export async function GET() {
  try {
    const admin = await getAdminUser()
    if (!admin) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
    }

    const settings = await prisma.setting.findMany()

    // key-value 객체로 변환 (민감 키는 마스킹)
    const settingsMap: Record<string, string> = {}
    settings.forEach(s => {
      if (s.key === CREDENTIALS_KEY && s.value) {
        settingsMap[s.key] = MASKED_CREDENTIALS_VALUE
      } else {
        settingsMap[s.key] = s.value
      }
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
    let translationSettingTouched = false
    for (const [key, value] of Object.entries(settings)) {
      const stringValue = String(value)

      // credentials 마스킹 값이면 기존 값 유지 (덮어쓰지 않음)
      if (key === CREDENTIALS_KEY && isMaskedCredentialsValue(stringValue)) {
        continue
      }

      await prisma.setting.upsert({
        where: { key },
        update: { value: stringValue },
        create: { key, value: stringValue },
      })

      if ((TRANSLATION_SETTING_KEYS as readonly string[]).includes(key)) {
        translationSettingTouched = true
      }

      if (isTranslatableSettingKey(key)) {
        try {
          await invalidateSettingTranslations(key)
          await translateSettingOnSave(key, stringValue)
        } catch (err) {
          console.error('[translateSettingOnSave]', key, err)
        }
      }
    }

    // Google Translate 설정이 바뀌면 클라이언트 캐시 무효화
    if (translationSettingTouched) {
      resetTranslateClientCache()
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
