import { prisma } from '@/lib/prisma'
import Script from 'next/script'

/** Read and validate the configured Google Analytics measurement ID. */
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

export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  if (!measurementId) return null
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${measurementId}');`}
      </Script>
    </>
  )
}
