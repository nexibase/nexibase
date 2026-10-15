import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd(), false, { info() {}, error() {} })

async function main() {
  const { prisma } = await import('../src/lib/prisma')
  const { getNotificationConfig, saveNotificationConfig } = await import('../src/lib/notifications/config')
  const { ensureCoreRules } = await import('../src/lib/notifications/service')
  try {
    const existing = await prisma.notificationConfig.findUnique({ where: { id: 'default' } })
    if (!existing) {
      const { settings, secrets } = await getNotificationConfig()
      await saveNotificationConfig(settings, secrets)
    }
    await ensureCoreRules()
    console.log('Notification settings initialized; existing settings preserved. New paid channels are disabled.')
  } finally { await prisma.$disconnect() }
}
main().catch(() => { console.error('알림 초기화 실패. DB 마이그레이션과 암호화 키 설정을 확인하세요.'); process.exitCode = 1 })
