import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/components/providers/SessionProvider'
import ThemeLoader from '@/components/theme-loader'
import { loadSiteSettings, fallbackUrlFromHeaders, mapToOgLocale } from '@/lib/site-settings'
import { getTranslations } from 'next-intl/server'
import { getMeasurementId } from '@/components/GoogleAnalytics'
import { ConsentProvider } from '@/components/consent/ConsentProvider'
import { GatedAnalytics } from '@/components/consent/GatedAnalytics'
import { UngatedAnalytics } from '@/components/consent/UngatedAnalytics'
import { readConsentContext } from '@/lib/consent/server'
import { decideAnalyticsMode, toClientState } from '@/lib/consent/state'
import './globals.css'
import './custom.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

// Metadata and JSON-LD read from the DB settings table on each request,
// so every page must render dynamically (no static prerender).
export const dynamic = 'force-dynamic'

async function resolveBaseUrl(settingsUrl: string): Promise<URL> {
  const raw = settingsUrl || (await fallbackUrlFromHeaders())
  try {
    return new URL(raw)
  } catch {
    return new URL(await fallbackUrlFromHeaders())
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await loadSiteSettings()
  const base = await resolveBaseUrl(s.site_url)
  const baseStr = base.toString().replace(/\/$/, '')
  const ogLocale = mapToOgLocale(s.site_locale)

  return {
    metadataBase: base,
    title: {
      default: s.site_description ? `${s.site_name} - ${s.site_description}` : s.site_name,
      template: `%s | ${s.site_name}`,
    },
    ...(s.site_description && { description: s.site_description }),
    ...(s.keywords_array.length > 0 && { keywords: s.keywords_array }),
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: baseStr,
      siteName: s.site_name,
      title: s.site_name,
      ...(s.site_description && { description: s.site_description }),
    },
    twitter: {
      card: 'summary_large_image',
      title: s.site_name,
      ...(s.site_description && { description: s.site_description }),
    },
    alternates: { canonical: baseStr },
    ...(() => {
      const other: Record<string, string> = {}
      if (s.naver_site_verification) other['naver-site-verification'] = s.naver_site_verification
      if (s.bing_site_verification) other['msvalidate.01'] = s.bing_site_verification
      const hasAny = s.google_site_verification || Object.keys(other).length > 0
      if (!hasAny) return {}
      return {
        verification: {
          ...(s.google_site_verification && { google: s.google_site_verification }),
          ...(Object.keys(other).length > 0 && { other }),
        },
      }
    })(),
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const s = await loadSiteSettings()
  const base = await resolveBaseUrl(s.site_url)
  const baseStr = base.toString().replace(/\/$/, '')

  const consent = await readConsentContext()
  // 'gated' = 동의 게이팅, 'ungated' = 이전과 동일한 무조건 로드,
  // 'none' = 설정을 읽지 못했다(둘 다 렌더하지 않는다). state.ts의 순수 함수다.
  const analyticsMode = decideAnalyticsMode(consent)
  // consentId는 클라이언트로 내리지 않는다. 클라이언트 컴포넌트의 props는 SSR
  // HTML 안 flight 페이로드로 직렬화되므로, 넣는 순간 HttpOnly 쿠키에 감춰 둔
  // 익명 UUID가 페이지 소스에서 읽힌다. 클라이언트는 쓸 일이 없고, 서버는
  // 쿠키에서 직접 읽는다.
  const consentClientState = toClientState(consent.state)
  const measurementId = await getMeasurementId()
  const t = await getTranslations('consent')

  const consentStrings = {
    title: t('title'),
    description: t('description'),
    statusAccepted: t('statusAccepted'),
    statusRejected: t('statusRejected'),
    acceptAll: t('acceptAll'),
    rejectAll: t('rejectAll'),
    settings: t('settings'),
    save: t('save'),
    close: t('close'),
    privacyLink: t('privacyLink'),
    reopen: t('reopen'),
    error: t('error'),
    necessaryTitle: t('necessaryTitle'),
    necessaryDescription: t('necessaryDescription'),
    analyticsTitle: t('analyticsTitle'),
    analyticsDescription: t('analyticsDescription'),
    alwaysOn: t('alwaysOn'),
  }

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: s.site_name,
    url: baseStr,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseStr}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
  if (s.site_description) ld.description = s.site_description

  return (
    <html lang={s.site_locale} suppressHydrationWarning>
      <head>
        <ThemeLoader />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {analyticsMode === 'gated' ? (
              <ConsentProvider
                initialState={consentClientState}
                strings={consentStrings}
                privacyHref={`/policies/${encodeURIComponent(consent.policySlug)}`}
              >
                {children}
                <GatedAnalytics measurementId={measurementId} />
              </ConsentProvider>
            ) : (
              <>
                {children}
                {analyticsMode === 'ungated' && <UngatedAnalytics measurementId={measurementId} />}
              </>
            )}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
