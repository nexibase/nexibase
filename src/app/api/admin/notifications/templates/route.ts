import { NextRequest, NextResponse } from 'next/server'
import { notificationAdmin } from '@/lib/notifications/admin'
import { getNotificationConfig } from '@/lib/notifications/config'
import { aligoRequest } from '@/lib/notifications/providers'

export async function GET(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  try {
    const { settings, secrets } = await getNotificationConfig()
    if (!secrets.aligoKey || !secrets.senderKey || !settings.aligoUserId) return NextResponse.json({ error: '알리고 인증 정보와 발신프로필을 먼저 저장하세요.' }, { status: 400 })
    const code = request.nextUrl.searchParams.get('code') || ''
    if (!/^[a-z0-9_-]{1,100}$/i.test(code)) return NextResponse.json({ error: '템플릿 코드를 확인하세요.' }, { status: 400 })
    const result = await aligoRequest('alimtalk', 'akv10/template/list', settings, secrets, { senderkey: secrets.senderKey, tpl_code: code })
    if (Number(result.code) !== 0) throw new Error('조회 실패')
    // Explicit projection prevents sender profile credentials in provider responses from leaking.
    return NextResponse.json({ templates: (result.list || []).map(row => ({ code: row.templtCode, name: row.templtName, content: row.templtContent, status: row.status, approval: row.inspStatus })) })
  } catch { return NextResponse.json({ error: '알리고 템플릿 조회에 실패했습니다. 계정·프로필·서버 IP 허용 설정을 확인하세요.' }, { status: 502 }) }
}
