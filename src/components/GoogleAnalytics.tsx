import { prisma } from '@/lib/prisma'

/**
 * 설정된 GA measurement id를 반환한다. 렌더링은 하지 않는다.
 *
 * 실제 스크립트 주입은 동의 이후에만 일어나며 GatedAnalytics가 담당한다.
 * 이 파일이 직접 <Script>를 렌더하면 동의 전에 gtag가 붙어 ePrivacy 5(3)
 * 위반이 된다 — 렌더링 책임을 여기 되돌리지 말 것.
 */
export async function getMeasurementId(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: 'google_analytics_id' },
    })
    const value = row?.value?.trim()
    if (!value || !/^G-[A-Z0-9]+$/i.test(value)) return null
    return value
  } catch {
    return null
  }
}
