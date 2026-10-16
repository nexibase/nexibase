import { NextRequest, NextResponse } from 'next/server'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { getNotificationConfig } from '@/lib/notifications/config'
import { checkAligoConnection } from '@/lib/notifications/aligo-connection'

const headers = { 'Cache-Control': 'no-store, private' }
export async function POST(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401, headers })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403, headers })
  try {
    const { settings, secrets } = await getNotificationConfig()
    if (!settings.aligoUserId || !secrets.aligoKey) return NextResponse.json({ error: '알리고 아이디와 API 키를 먼저 저장하세요.' }, { status: 400, headers })
    const checks = await checkAligoConnection(settings, secrets)
    return NextResponse.json({ success: checks.every(check => check.status === 'ok'), checks }, { headers })
  } catch { return NextResponse.json({ error: '알리고 연결 확인을 완료하지 못했습니다. 저장된 인증 정보를 확인하세요.' }, { status: 500, headers }) }
}
