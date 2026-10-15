import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
loadEnvConfig(process.cwd(), false, { info() {}, error() {} })

async function main() {
  const { prisma } = await import('../src/lib/prisma')
  const { getNotificationConfig } = await import('../src/lib/notifications/config')
  const { runNotificationWorkerOnce } = await import('../src/lib/notifications/worker')
  const { emitNotification } = await import('../src/lib/notifications/service')
  const { encrypt, decrypt } = await import('../src/lib/notifications/crypto')
  const users: number[] = []
  let requests = 0, cases = 0
  try {
    assert.equal(process.env.NOTIFICATION_ENVIRONMENT, 'development')
    assert.equal(process.env.NOTIFICATION_VERIFICATION_WORKER_PAUSED, '1', 'Pause the background worker before creating live test fixtures')
    const base = process.argv[2]
    assert.ok(base)
    const config = await getNotificationConfig()
    const marker = Date.now()
    const admin = await prisma.user.create({ data: { email: `smtp-admin-${marker}@example.invalid`, nickname: `SMTP admin ${marker}`, role: 'admin', status: 'active', phone: '01000000000' } })
    users.push(admin.id)
    const member = await prisma.user.create({ data: { email: `smtp-member-${marker}@example.invalid`, nickname: `SMTP member ${marker}`, role: 'user', status: 'active', phone: '01000000000' } })
    users.push(member.id)
    await prisma.notificationPreference.create({ data: { userId: admin.id, emailDirectMessage: true } })
    async function cookie(user: { id: number; email: string }) {
      const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(user.id), sub: String(user.id), email: user.email }, maxAge: 600 })
      return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
    }
    const adminCookie = await cookie(admin), memberCookie = await cookie(member)
    async function request(path: string, expected = 200, method = 'GET', body?: unknown, actor = adminCookie, origin?: string) {
      requests++
      const response = await fetch(base + path, { method, headers: { Cookie: actor, 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
      assert.equal(response.status, expected, `${method} ${path}`)
      return response.json()
    }
    const original = await request('/api/admin/notifications/settings')
    assert.equal(original.environment, 'development')
    const recipient = `outside-${marker}@example.invalid`
    assert.equal(await prisma.user.count({ where: { email: recipient } }), 0)
    assert.ok(!config.settings.testRecipients.includes(recipient))
    const body = { action: 'smtp_send', recipientEmail: recipient, requestId: randomUUID() }
    for (const actor of ['', memberCookie]) {
      await request('/api/admin/notifications/test', 401, 'POST', body, actor)
      await request('/api/admin/notifications/test?checkRecipient=1', 401, 'GET', undefined, actor)
    }
    await request('/api/admin/notifications/test', 403, 'POST', body, adminCookie, 'https://outside.example.invalid')
    for (const recipientEmail of ['bad-email', 'a@example.invalid,b@example.invalid', 'a@example.invalid\r\nBcc: b@example.invalid', ['a@example.invalid']]) {
      await request('/api/admin/notifications/test', 400, 'POST', { ...body, recipientEmail })
    }
    for (const channel of ['sms', 'alimtalk']) await request('/api/admin/notifications/test', 400, 'POST', { ...body, channel })
    await request('/api/admin/notifications/test', 400, 'POST', { ...body, userId: member.id })
    await request('/api/admin/notifications/test', 400, 'POST', { ...body, requestId: 'bad-id' })
    assert.equal(await prisma.notificationEvent.count({ where: { userId: admin.id } }), 0)
    cases++
    const ready = await request(`/api/admin/notifications/test?checkRecipient=1&recipientEmail=${encodeURIComponent(recipient)}`)
    assert.equal(ready.ready, true)
    assert.ok(!JSON.stringify(ready).includes(recipient))
    const queued = await request('/api/admin/notifications/test', 200, 'POST', body)
    const repeated = await request('/api/admin/notifications/test', 200, 'POST', body)
    assert.equal(queued.eventId, repeated.eventId)
    assert.equal(await prisma.notificationDelivery.count({ where: { eventId: queued.eventId } }), 1)
    assert.equal(await prisma.notification.count({ where: { eventId: queued.eventId } }), 1)
    const job = await prisma.notificationDelivery.findUniqueOrThrow({ where: { eventId_channel: { eventId: queued.eventId, channel: 'email' } } })
    assert.equal(job.status, 'pending')
    assert.ok(job.payloadEncrypted && !job.payloadEncrypted.includes(recipient))
    const payload = decrypt<{ to: string; smtpTest: boolean; text: string; html: string }>(job.payloadEncrypted!)
    assert.equal(payload.to, recipient); assert.equal(payload.smtpTest, true)
    assert.ok(payload.text.includes(new URL(base).origin) && payload.text.includes('개발(dev)'))
    assert.ok(payload.html.includes('보낸 사이트'))
    cases += 3
    const disabled = { ...config, settings: { ...config.settings, emailEnabled: false, smsEnabled: false, alimtalkEnabled: false, liveEnabled: false, testRecipients: [] } }
    let manualSends = 0
    const manualOptions = { eventIds: [queued.eventId], getConfig: async () => disabled,
      send: async (channel: string, data: { to: string }, _settings: unknown, _secrets: unknown, live: boolean) => {
        assert.equal(channel, 'email'); assert.equal(data.to, recipient); assert.equal(live, true); manualSends++
        return { status: 'accepted' as const, providerId: 'local-verification-only' }
      } }
    await runNotificationWorkerOnce(manualOptions); await runNotificationWorkerOnce(manualOptions)
    assert.equal(manualSends, 1)
    const status = await request(`/api/admin/notifications/test?eventId=${queued.eventId}`)
    assert.equal(status.delivery.status, 'accepted')
    assert.ok(!JSON.stringify(status).includes(recipient))
    cases++
    const automatic = await emitNotification({ userId: admin.id, type: 'direct_message', eventKey: randomUUID(), title: 'SMTP automatic restriction verification', message: 'Local verification only' })
    assert.ok(automatic?.eventId)
    const forgedPayload = encrypt({ to: admin.email, subject: 'Local verification', text: 'Local verification', test: false, smtpTest: true })
    await prisma.notificationDelivery.update({ where: { eventId_channel: { eventId: automatic.eventId, channel: 'email' } }, data: { status: 'pending', payloadEncrypted: forgedPayload } })
    let automaticSends = 0
    await runNotificationWorkerOnce({ eventIds: [automatic.eventId], getConfig: async () => disabled, send: async () => { automaticSends++; return { status: 'tested' } } })
    assert.equal(automaticSends, 0)
    await prisma.notificationDelivery.update({ where: { eventId_channel: { eventId: automatic.eventId, channel: 'email' } }, data: { status: 'pending', attempts: 0, nextAttemptAt: new Date(0) } })
    await runNotificationWorkerOnce({ eventIds: [automatic.eventId], getConfig: async () => ({ ...disabled, settings: { ...disabled.settings, emailEnabled: true, liveEnabled: true } }),
      send: async (_channel, _payload, _settings, _secrets, live) => { assert.equal(live, false); automaticSends++; return { status: 'tested' } } })
    assert.equal(automaticSends, 1)
    cases += 2
    for (const channel of ['sms', 'alimtalk'] as const) {
      await request('/api/admin/notifications/test', 400, 'POST', { channel, userId: member.id, mode: 'live' })
      const notification = await emitNotification({ userId: admin.id, type: 'notification_test', eventKey: randomUUID(), title: 'Paid channel restriction verification', message: 'Local verification only', test: { channel, live: true } })
      assert.ok(notification?.eventId)
      await prisma.notificationDelivery.update({ where: { eventId_channel: { eventId: notification.eventId, channel } }, data: { status: 'pending', payloadEncrypted: encrypt({ to: admin.phone, subject: 'Local verification', text: 'Local verification', test: false, smtpTest: true }) } })
      let calls = 0
      await runNotificationWorkerOnce({ eventIds: [notification.eventId], getConfig: async () => ({ ...disabled,
        settings: { ...disabled.settings, aligoUserId: 'local-mock', sender: '0212345678', liveEnabled: true }, secrets: { ...disabled.secrets, aligoKey: 'mock', senderKey: 'mock' } }),
        send: async (actual, _payload, _settings, _secrets, live) => { assert.equal(actual, channel); assert.equal(live, false); calls++; return { status: 'tested' } } })
      assert.equal(calls, 1)
      cases++
    }
    assert.deepEqual((await request('/api/admin/notifications/settings')).settings, original.settings)
    console.log(JSON.stringify({ casesPassed: cases, apiRequestsPassed: requests, nonMemberOutsideAllowlist: true, manualSendWithAutomaticSwitchOff: true, idempotentQueue: true, encryptedAndMasked: true, automaticAndPaidRestrictionsPreserved: true, settingsUnchanged: true, actualExternalSends: 0 }))
  } finally {
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users }, email: { endsWith: '@example.invalid' } } })
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
