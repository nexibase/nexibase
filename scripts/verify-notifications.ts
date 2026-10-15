import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
loadEnvConfig(process.cwd(), false, { info() {}, error() {} })

async function main() {
  const { prisma } = await import('../src/lib/prisma')
  const { emitNotification } = await import('../src/lib/notifications/service')
  const { runNotificationWorkerOnce } = await import('../src/lib/notifications/worker')
  const { getNotificationConfig } = await import('../src/lib/notifications/config')
  const { encrypt, decrypt } = await import('../src/lib/notifications/crypto')
  const { sendMessageTo } = await import('../src/lib/messaging')
  const marker = Date.now()
  const eventType = `verify_notification_${marker}`
  const users: number[] = []
  let requests = 0, cases = 0
  const base = process.argv[2]
  try {
    assert.equal(process.env.NOTIFICATION_ENVIRONMENT, 'development', 'Verification must run against development only')
    const config = await getNotificationConfig()
    assert.equal(config.settings.liveEnabled, false, 'Verification requires dev live delivery to remain disabled')
    assert.equal(config.settings.smsEnabled, false, 'Paid channels must not be enabled during verification')
    assert.equal(config.settings.alimtalkEnabled, false)
    const member = await prisma.user.create({ data: { email: `notification-check-${marker}@example.invalid`, nickname: `알림검증${marker}`, role: 'user', status: 'active', phone: '01000000000' } })
    users.push(member.id)
    const sender = await prisma.user.create({ data: { email: `notification-sender-${marker}@example.invalid`, nickname: `알림발신${marker}`, role: 'user', status: 'active' } })
    users.push(sender.id)
    await prisma.notificationPreference.create({ data: { userId: member.id, postComment: false, commentReply: false, mention: false, orderStatus: false,
      emailDirectMessage: true, mobilePreferences: { direct_message: { sms: true, alimtalk: true } } } })
    const input = { userId: member.id, type: 'direct_message', title: '검증 알림', message: '중복·읽음 상태 보존 확인', link: '/mypage/notifications', eventKey: `dedupe:${marker}` }
    const duplicates = await Promise.all(Array.from({ length: 4 }, () => emitNotification(input)))
    assert.ok(duplicates[0]); assert.equal(new Set(duplicates.map(n => n?.id)).size, 1)
    assert.equal(await prisma.notification.count({ where: { userId: member.id } }), 1)
    await prisma.notification.update({ where: { id: duplicates[0]!.id }, data: { isRead: true } })
    assert.equal((await emitNotification(input))!.isRead, true)
    const emailJob = await prisma.notificationDelivery.findUniqueOrThrow({ where: { eventId_channel: { eventId: duplicates[0]!.eventId!, channel: 'email' } } })
    assert.equal(emailJob.status, 'pending'); assert.ok(emailJob.payloadEncrypted)
    assert.ok(!emailJob.payloadEncrypted.includes(member.email) && !emailJob.payloadEncrypted.includes(member.phone!))
    assert.equal(decrypt<{ to: string }>(emailJob.payloadEncrypted).to, member.email)
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { eventId_channel: { eventId: duplicates[0]!.eventId!, channel: 'sms' } } })).status, 'skipped')
    cases += 4
    const before = await prisma.notification.count({ where: { userId: member.id } })
    await assert.rejects(prisma.$transaction(async tx => {
      await emitNotification({ ...input, eventKey: `rollback:${marker}` }, tx)
      throw new Error('intentional rollback')
    }), /intentional rollback/)
    assert.equal(await prisma.notification.count({ where: { userId: member.id } }), before)
    cases++
    const sent = await sendMessageTo({ fromUserId: sender.id, toUserId: member.id, content: '쪽지와 알림을 하나의 트랜잭션으로 기록', fromUserName: sender.nickname, senderIsAdmin: false, recipientEmail: member.email })
    assert.ok(await prisma.notification.findFirst({ where: { userId: member.id, link: `/mypage/messages/${sent.conversation.uuid}` } }))
    cases++
    const child = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/notification-worker.ts', '--once', '--event', duplicates[0]!.eventId!], { cwd: process.cwd(), encoding: 'utf8', timeout: 30000 })
    assert.equal(child.status, 0, 'A separate worker process must read the persisted queue')
    assert.equal((await prisma.notificationDelivery.findUniqueOrThrow({ where: { id: emailJob.id } })).status, 'tested')
    cases++

    await prisma.notificationRule.create({ data: { eventType, label: '통합 알림 자동 검증', preferenceType: 'direct_message', owner: 'core', emailEnabled: true, smsEnabled: true, alimtalkEnabled: true, smsTemplate: '#{message}', alimtalkCode: 'TEST_ONLY', alimtalkTemplate: '#{message}' } })
    const fakeConfig = { settings: { ...config.settings, emailEnabled: true, smsEnabled: true, alimtalkEnabled: true, liveEnabled: false, sender: '0212345678', aligoUserId: 'mock' }, secrets: { aligoKey: 'mock-private-key', senderKey: 'mock-profile-key' }, updatedAt: undefined }
    async function fixture(name: string, channel: 'sms' | 'alimtalk' = 'alimtalk') {
      const n = await emitNotification({ ...input, type: eventType, eventKey: name, definition: { eventType, label: '통합 알림 자동 검증', preferenceType: 'direct_message' } })
      assert.ok(n?.eventId)
      await prisma.notificationDelivery.updateMany({ where: { eventId: n.eventId }, data: { status: 'skipped' } })
      for (const c of channel === 'alimtalk' ? ['sms', 'alimtalk'] : ['sms']) {
        await prisma.notificationDelivery.update({ where: { eventId_channel: { eventId: n.eventId, channel: c } }, data: {
          status: c === 'sms' && channel === 'alimtalk' ? 'waiting' : 'pending',
          payloadEncrypted: encrypt({ to: member.phone, text: '테스트', subject: '테스트', templateCode: 'TEST_ONLY', test: true }),
        } })
      }
      return n.eventId
    }
    const state = async (id: string, channel: string) => (await prisma.notificationDelivery.findUniqueOrThrow({ where: { eventId_channel: { eventId: id, channel } } })).status
    for (const outcome of ['delivered', 'failed', 'unknown', 'accepted'] as const) {
      const eventId = await fixture(outcome)
      const calls: string[] = []
      const dependencies = { eventIds: [eventId], getConfig: async () => fakeConfig,
        send: async (channel: 'email' | 'sms' | 'alimtalk') => { calls.push(channel); return { status: outcome === 'unknown' ? 'unknown' as const : 'accepted' as const, providerId: `mock-${channel}` } },
        query: async (channel: 'sms' | 'alimtalk') => channel === 'sms' ? { status: 'delivered' as const } : outcome === 'accepted' || outcome === 'unknown' ? null : { status: outcome },
      }
      await runNotificationWorkerOnce(dependencies); await runNotificationWorkerOnce(dependencies); await runNotificationWorkerOnce(dependencies)
      assert.equal(calls.filter(c => c === 'alimtalk').length, 1)
      assert.equal(calls.filter(c => c === 'sms').length, outcome === 'failed' ? 1 : 0)
      assert.equal(await state(eventId, 'sms'), outcome === 'failed' ? 'delivered' : outcome === 'delivered' ? 'skipped' : 'waiting')
      cases++
    }
    {
      const eventId = await fixture('bounded-retry', 'sms'); let calls = 0
      const options = { eventIds: [eventId], getConfig: async () => fakeConfig, send: async () => { calls++; return { status: 'retry' as const } } }
      for (let i = 0; i < 4; i++) {
        await prisma.notificationDelivery.updateMany({ where: { eventId }, data: { nextAttemptAt: new Date(0) } })
        await runNotificationWorkerOnce(options)
      }
      assert.equal(calls, 3); assert.equal(await state(eventId, 'sms'), 'failed'); cases++
    }
    {
      const eventId = await fixture('concurrent-workers', 'sms'); let calls = 0
      const options = { eventIds: [eventId], getConfig: async () => fakeConfig, send: async () => { calls++; await new Promise(r => setTimeout(r, 20)); return { status: 'tested' as const } } }
      await Promise.all([runNotificationWorkerOnce(options), runNotificationWorkerOnce(options)])
      assert.equal(calls, 1); cases++
    }
    for (const condition of ['opt-out', 'disabled', 'missing-contact', 'interrupted'] as const) {
      const eventId = await fixture(condition, 'sms'); let calls = 0
      if (condition === 'opt-out') await prisma.notificationPreference.update({ where: { userId: member.id }, data: { mobilePreferences: { direct_message: { sms: false, alimtalk: true } } } })
      if (condition === 'missing-contact') await prisma.user.update({ where: { id: member.id }, data: { phone: null } })
      if (condition === 'interrupted') await prisma.notificationDelivery.updateMany({ where: { eventId, channel: 'sms' }, data: { status: 'processing', lockedAt: new Date(Date.now() - 600000), lockToken: randomUUID(), attempts: 1 } })
      await runNotificationWorkerOnce({ eventIds: [eventId], getConfig: async () => condition === 'disabled' ? { ...fakeConfig, settings: { ...fakeConfig.settings, smsEnabled: false } } : fakeConfig,
        send: async () => { calls++; return { status: 'tested' } } })
      assert.equal(calls, 0); assert.equal(await state(eventId, 'sms'), condition === 'interrupted' ? 'unknown' : 'skipped')
      await prisma.notificationPreference.update({ where: { userId: member.id }, data: { mobilePreferences: { direct_message: { sms: true, alimtalk: true } } } })
      await prisma.user.update({ where: { id: member.id }, data: { phone: '01000000000' } }); cases++
    }
    if (base) {
      const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin', status: 'active', deletedAt: null } })
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
      for (const actor of ['', memberCookie]) {
        await request('/api/admin/notifications/settings', 401, 'GET', undefined, actor)
        await request('/api/admin/notifications', 401, 'GET', undefined, actor)
        await request('/api/admin/notifications/test', 401, 'POST', {}, actor)
      }
      const settings = await request('/api/admin/notifications/settings')
      assert.equal(settings.environment, 'development', 'HTTP server must enforce development safety before testing any write endpoint')
      assert.ok(!('secrets' in settings) && !('secretsEncrypted' in settings))
      for (const value of Object.values(config.secrets)) if (value) assert.ok(!JSON.stringify(settings).includes(value))
      await request('/api/admin/notifications/settings', 403, 'PUT', {}, adminCookie, 'https://outside.example.invalid')
      await request('/api/admin/notifications/settings', 200, 'PUT', { settings: settings.settings, rules: settings.rules, secrets: {} })
      assert.deepEqual((await getNotificationConfig()).secrets, config.secrets)
      await request('/api/admin/notifications/settings', 400, 'PUT', { settings: { ...settings.settings, liveEnabled: true, testRecipients: [] }, rules: settings.rules })
      await request('/api/admin/notifications/test', 400, 'POST', { channel: 'email', userId: member.id, mode: 'live' })
      const test = await request('/api/admin/notifications/test', 200, 'POST', { channel: 'email', userId: member.id, mode: 'test' })
      await runNotificationWorkerOnce({ eventIds: [test.eventId] })
      assert.equal(await state(test.eventId, 'email'), 'tested')
      const list = await request(`/api/admin/notifications?search=${encodeURIComponent(member.nickname)}&channel=email`)
      assert.ok(list.total > 0 && list.deliveries.every((d: { channel: string }) => d.channel === 'email'))
      assert.ok(!JSON.stringify(list).includes(member.email) && !JSON.stringify(list).includes(member.phone!))
      const pref = await request('/api/notifications/preferences', 200, 'PUT', { postComment: false, emailDirectMessage: false, mobilePreferences: { direct_message: { sms: true, alimtalk: false } } }, memberCookie)
      assert.equal(pref.preference.postComment, true); assert.equal(pref.preference.emailDirectMessage, false)
      const saved = await request('/api/notifications/preferences', 200, 'GET', undefined, memberCookie)
      assert.equal(saved.preference.mobilePreferences.direct_message.sms, true)
      assert.equal(saved.preference.mobilePreferences.direct_message.alimtalk, false)
      cases += 6
    }
    console.log(JSON.stringify({ casesPassed: cases, apiRequestsPassed: requests, duplicateAndReadState: true, atomicRollback: true, independentWorkerProcess: true, singleFallback: true, uncertainNoResend: true, concurrentWorkerClaim: true, actualExternalSends: 0 }))
  } finally {
    if (users.length) {
      const conversations = await prisma.conversation.findMany({ where: { OR: [{ user1Id: { in: users } }, { user2Id: { in: users } }] }, select: { id: true } })
      await prisma.message.deleteMany({ where: { conversationId: { in: conversations.map(c => c.id) } } })
      await prisma.conversation.deleteMany({ where: { id: { in: conversations.map(c => c.id) } } })
      await prisma.user.deleteMany({ where: { id: { in: users }, email: { endsWith: '@example.invalid' } } })
    }
    await prisma.notificationRule.deleteMany({ where: { eventType: { in: [eventType, 'notification_test'] } } })
    await prisma.$disconnect()
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
