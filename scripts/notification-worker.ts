import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd(), process.env.NODE_ENV === 'development', { info() {}, error() {} })

async function main() {
  const { runNotificationWorkerOnce } = await import('../src/lib/notifications/worker')
  const { prisma } = await import('../src/lib/prisma')
  let stopping = false
  process.on('SIGTERM', () => { stopping = true })
  process.on('SIGINT', () => { stopping = true })
  try {
    do {
      try {
        const eventIndex = process.argv.indexOf('--event')
        const eventId = eventIndex >= 0 ? process.argv[eventIndex + 1] : undefined
        if (eventIndex >= 0 && !/^[a-f0-9-]{36}$/i.test(eventId || '')) throw new Error('Invalid event ID')
        const result = await runNotificationWorkerOnce(eventId ? { eventIds: [eventId] } : {})
        if (result.processed || result.checked || result.uncertainAfterRestart) console.log('[notification-worker]', JSON.stringify(result))
      } catch { console.error('[notification-worker] 처리 실패. 설정 및 DB 연결을 확인하세요.') }
      if (process.argv.includes('--once') || stopping) break
      await new Promise(resolve => setTimeout(resolve, 3000))
    } while (!stopping)
  } finally { await prisma.$disconnect() }
}
main().catch(() => { console.error('[notification-worker] 시작 실패'); process.exitCode = 1 })
