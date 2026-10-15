import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { loadSiteSettings } from '@/lib/site-settings'
import { configReadiness, getNotificationConfig } from './config'
import { encrypt } from './crypto'
import { isNotificationDevelopment, maskRecipient, normalizeSmtpTestEmail } from './policy'
import type { DeliveryPayload } from './providers'
import { smtpTestTemplate } from './smtp-test-template'

export async function enqueueSmtpTest(adminId: number, recipient: unknown, requestId: string) {
  const email = normalizeSmtpTestEmail(recipient)
  if (!/^[a-f0-9-]{36}$/i.test(requestId)) throw new Error('테스트 요청 ID를 확인하세요.')
  const { settings, secrets } = await getNotificationConfig()
  const missing = configReadiness(settings, secrets).email
  if (missing.length) throw new Error(`SMTP 설정 필요: ${missing.join(', ')}`)
  const site = await loadSiteSettings()
  const template = smtpTestTemplate({ name: site.site_name, url: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || site.site_url, development: isNotificationDevelopment() })
  const payload: DeliveryPayload = { to: email, ...template, smtpTest: true, test: false }
  const encrypted = encrypt(payload)
  const dedupeKey = createHash('sha256').update(`smtp-test:${adminId}:${requestId}`).digest('hex')
  try {
    return await prisma.$transaction(async db => {
      const admin = await db.user.findFirst({ where: { id: adminId, role: 'admin', status: 'active', deletedAt: null }, select: { id: true } })
      if (!admin) throw new Error('관리자 권한이 필요합니다.')
      const id = randomUUID()
      const event = await db.notificationEvent.upsert({ where: { dedupeKey }, update: {}, create: { id, dedupeKey, userId: adminId, type: 'smtp_test' } })
      if (event.id !== id) return db.notification.findUniqueOrThrow({ where: { eventId: event.id } })
      const notification = await db.notification.create({ data: { userId: adminId, eventId: id, type: 'smtp_test',
        title: 'SMTP 테스트 메일', message: `${maskRecipient(email, 'email')} 주소로 테스트 메일을 요청했습니다.`, link: '/admin/notifications' } })
      await db.notificationDelivery.create({ data: { eventId: id, channel: 'email', status: 'pending',
        recipientMasked: maskRecipient(email, 'email'), payloadEncrypted: encrypted } })
      return notification
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const event = await prisma.notificationEvent.findUnique({ where: { dedupeKey } })
      if (event) return prisma.notification.findUniqueOrThrow({ where: { eventId: event.id } })
    }
    throw error
  }
}
