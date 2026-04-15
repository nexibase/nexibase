import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionProvider } from '@/components/providers/SessionProvider'
import ThemeLoader from '@/components/theme-loader'
import { prisma } from '@/lib/prisma'
import './globals.css'
import './custom.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://nexibase.com'),
  title: {
    default: 'NexiBase - 커뮤니티 플랫폼',
    template: '%s | NexiBase',
  },
  description: 'NexiBase - 오픈소스 커뮤니티 플랫폼. 게시판, 콘텐츠 관리, 사용자 관리를 하나로.',
  keywords: ['NexiBase', '커뮤니티', '게시판', '오픈소스', 'Next.js', '커뮤니티 플랫폼'],
  authors: [{ name: 'NexiBase' }],
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://nexibase.com',
    siteName: 'NexiBase',
    title: 'NexiBase - 커뮤니티 플랫폼',
    description: 'NexiBase - 오픈소스 커뮤니티 플랫폼. 게시판, 콘텐츠 관리, 사용자 관리를 하나로.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexiBase - 커뮤니티 플랫폼',
    description: 'NexiBase - 오픈소스 커뮤니티 플랫폼. 게시판, 콘텐츠 관리, 사용자 관리를 하나로.',
  },
  alternates: {
    canonical: 'https://nexibase.com',
  },
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let gaId: string | null = null
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'google_analytics_id' },
    })
    if (setting?.value) gaId = setting.value
  } catch {
    // Ignore DB errors during build or when DB is unavailable
  }

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ThemeLoader />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'NexiBase',
              url: 'https://nexibase.com',
              description: 'NexiBase - 오픈소스 커뮤니티 플랫폼',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://nexibase.com/search?q={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gaId}');`}
            </Script>
          </>
        )}
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
