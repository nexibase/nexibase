import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notificationAdmin, sameOrigin } from '@/lib/notifications/admin'
import { getNotificationConfig, publicNotificationConfig, saveNotificationConfig, type Secrets } from '@/lib/notifications/config'
import { validPhone } from '@/lib/notifications/policy'

async function publicAligoConfig() {
  const { settings, configuredSecrets, encryptionReady } = await publicNotificationConfig()
  return {
    settings: { aligoUserId: settings.aligoUserId, sender: settings.sender },
    configuredSecrets: { aligoKey: configuredSecrets.aligoKey, senderKey: configuredSecrets.senderKey },
    encryptionReady,
  }
}
export async function GET() {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  return NextResponse.json(await publicAligoConfig())
}
export async function PUT(request: NextRequest) {
  if (!await notificationAdmin()) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 401 })
  if (!sameOrigin(request)) return NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 })
  try {
    const body = await request.json()
    if (!body.settings || typeof body.settings !== 'object' || Array.isArray(body.settings)) throw new Error('알리고 설정 형식을 확인하세요.')
    const settings = { aligoUserId: '', sender: '' }
    for (const key of ['aligoUserId', 'sender'] as const) {
      const value = body.settings[key]
      if (typeof value !== 'string' || value.length > 255 || /[\r\n]/.test(value)) throw new Error('알리고 설정 값을 확인하세요.')
      settings[key] = value.trim()
    }
    if (settings.sender && !validPhone(settings.sender)) throw new Error('발신번호를 확인하세요.')
    if (body.secrets !== undefined && (!body.secrets || typeof body.secrets !== 'object' || Array.isArray(body.secrets))) throw new Error('인증 정보 형식을 확인하세요.')
    const secrets: Secrets = {}
    for (const key of ['aligoKey', 'senderKey'] as const) {
      if (body.secrets?.[key] !== undefined && (typeof body.secrets[key] !== 'string' || body.secrets[key].length > 2048)) throw new Error('인증 정보 형식을 확인하세요.')
      if (body.secrets?.[key]) secrets[key] = body.secrets[key]
    }
    await prisma.$transaction(async tx => {
      const current = await getNotificationConfig(tx)
      await saveNotificationConfig({ ...current.settings, ...settings }, secrets, tx)
    })
    return NextResponse.json({ success: true, ...await publicAligoConfig() })
  } catch (error) {
    const message = error instanceof Error && !('code' in error) ? error.message : '알리고 설정을 저장하지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
