import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/components/providers/SessionProvider'
import ThemeLoader from '@/components/theme-loader'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { loadSiteSettings, fallbackUrlFromHeaders, mapToOgLocale } from '@/lib/site-settings'
import './globals.css'
import './custom.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

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
        <GoogleAnalytics />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
