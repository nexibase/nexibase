import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { translateText } from '@/lib/translation/translate'
import { routing } from '@/i18n/routing'

export async function POST() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '관리자 권한이 필요합니다.' }, { status: 401 })
  }

  const targetLocale = routing.locales.find(l => l !== routing.defaultLocale) ?? 'ko'

  try {
    const sample = await translateText('Hello, world!', targetLocale)
    if (sample == null) {
      return NextResponse.json({
        ok: false,
        error: '번역 API가 null을 반환했습니다. Project ID/JSON 키를 확인하세요.',
      }, { status: 500 })
    }
    return NextResponse.json({ ok: true, sample, targetLocale })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
