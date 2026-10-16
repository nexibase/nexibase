import { NextRequest, NextResponse } from 'next/server'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { getNotificationConfig, type Secrets } from '@/lib/notifications/config'

const headers = { 'Cache-Control': 'no-store, private', Pragma: 'no-cache' }
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers })
const keys: (keyof Secrets)[] = ['smtpPass', 'aligoKey', 'senderKey']

export async function POST(request: NextRequest) {
  if (!await notificationAdmin()) return reply({ error: '관리자 권한이 필요합니다.' }, 401)
  if (!sameOrigin(request)) return reply({ error: '허용되지 않은 요청입니다.' }, 403)
  let key: unknown
  try { key = (await request.json())?.key }
  catch { return reply({ error: '조회할 항목을 확인하세요.' }, 400) }
  if (typeof key !== 'string' || !keys.includes(key as keyof Secrets)) return reply({ error: '조회할 항목을 확인하세요.' }, 400)
  try {
    const { secrets } = await getNotificationConfig()
    const value = secrets[key as keyof Secrets]
    if (!value) return reply({ error: '저장된 값이 없습니다.' }, 404)
    return reply({ value })
  } catch {
    return reply({ error: '저장된 값을 불러오지 못했습니다.' }, 500)
  }
}
