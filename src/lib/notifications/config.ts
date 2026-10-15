import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { encrypt, decrypt, encryptionReady } from './crypto'
import { isNotificationDevelopment } from './policy'

export interface NotificationSettings {
  emailEnabled: boolean; smsEnabled: boolean; alimtalkEnabled: boolean
  liveEnabled: boolean; testRecipients: string[]
  smtpHost: string; smtpPort: number; smtpSecure: boolean; smtpUser: string; smtpFrom: string
  aligoUserId: string; sender: string
}
export interface Secrets { smtpPass?: string; aligoKey?: string; senderKey?: string }
export const DEFAULT_SETTINGS: NotificationSettings = {
  emailEnabled: true, smsEnabled: false, alimtalkEnabled: false,
  liveEnabled: !isNotificationDevelopment(), testRecipients: [],
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com', smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: process.env.SMTP_PORT === '465', smtpUser: process.env.SMTP_USER || '',
  smtpFrom: process.env.SMTP_FROM || process.env.SMTP_USER || '', aligoUserId: '', sender: '',
}
export async function getNotificationConfig(db: Prisma.TransactionClient = prisma) {
  const row = await db.notificationConfig.findUnique({ where: { id: 'default' } })
  const settings = { ...DEFAULT_SETTINGS, ...(row?.settings as Partial<NotificationSettings> | null) }
  const secrets: Secrets = row?.secretsEncrypted ? decrypt<Secrets>(row.secretsEncrypted) : {}
  if (!secrets.smtpPass) secrets.smtpPass = process.env.SMTP_PASS || ''
  return { settings, secrets, updatedAt: row?.updatedAt }
}
export function configReadiness(settings: NotificationSettings, secrets: Secrets) {
  return {
    email: [!settings.smtpHost && 'SMTP 호스트', !settings.smtpFrom && '발신 이메일', settings.smtpUser && !secrets.smtpPass && 'SMTP 비밀번호'].filter(Boolean),
    sms: [!settings.aligoUserId && '알리고 아이디', !secrets.aligoKey && '알리고 API 키', !settings.sender && '등록된 발신번호'].filter(Boolean),
    alimtalk: [!settings.aligoUserId && '알리고 아이디', !secrets.aligoKey && '알리고 API 키', !settings.sender && '등록된 발신번호', !secrets.senderKey && '카카오 발신프로필 키'].filter(Boolean),
  }
}
export async function publicNotificationConfig() {
  const { settings, secrets, updatedAt } = await getNotificationConfig()
  return { settings, updatedAt, encryptionReady: encryptionReady(), environment: isNotificationDevelopment() ? 'development' : 'production',
    configuredSecrets: { smtpPass: !!secrets.smtpPass, aligoKey: !!secrets.aligoKey, senderKey: !!secrets.senderKey },
    missing: configReadiness(settings, secrets) }
}
export async function saveNotificationConfig(settings: NotificationSettings, secretPatch: Secrets, db: Prisma.TransactionClient = prisma) {
  const current = await getNotificationConfig(db)
  const secrets = { ...current.secrets }
  for (const key of ['smtpPass', 'aligoKey', 'senderKey'] as const) {
    if (secretPatch[key]) secrets[key] = secretPatch[key]
  }
  return db.notificationConfig.upsert({ where: { id: 'default' },
    create: { id: 'default', settings: JSON.parse(JSON.stringify(settings)), secretsEncrypted: encrypt(secrets) },
    update: { settings: JSON.parse(JSON.stringify(settings)), secretsEncrypted: encrypt(secrets) } })
}
