import { NextRequest, NextResponse } from 'next/server'
import { notificationAdmin } from '@/lib/notifications/admin'
import { getNotificationConfig } from '@/lib/notifications/config'
import { aligoRequest } from '@/lib/notifications/providers'
import { projectAligoTemplates } from '@/lib/notifications/template-options'

const headers = { 'Cache-Control': 'no-store, private' }
export async function GET(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401, headers })
  try {
    const { settings, secrets } = await getNotificationConfig()
    if (!secrets.aligoKey || !secrets.senderKey || !settings.aligoUserId) return NextResponse.json({ error: '알리고 아이디와 기존 API Key·Senderkey를 먼저 저장하세요.' }, { status: 400, headers })
    const code = request.nextUrl.searchParams.get('code') || ''
    if (code && !/^[a-z0-9_-]{1,100}$/i.test(code)) return NextResponse.json({ error: '템플릿 코드를 확인하세요.' }, { status: 400, headers })
    const result = await aligoRequest('alimtalk', 'akv10/template/list', settings, secrets, { senderkey: secrets.senderKey, ...(code ? { tpl_code: code } : {}) })
    if (result.code === undefined || result.code === null || result.code === '' || Number(result.code) !== 0 || !Array.isArray(result.list)) throw new Error('조회 실패')
    return NextResponse.json({ templates: projectAligoTemplates(result.list) }, { headers })
  } catch { return NextResponse.json({ error: '알리고 템플릿 조회에 실패했습니다. 계정·Senderkey·서버 IP 허용 설정을 확인하세요.' }, { status: 502, headers }) }
}
