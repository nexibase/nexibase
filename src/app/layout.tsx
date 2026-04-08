import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import ThemeLoader from "@/components/theme-loader";
import { SiteProvider } from "@/lib/SiteContext";
import { SiteShell } from "@/components/layout/SiteShell";
import { prisma } from "@/lib/prisma";
import "./globals.css";
import "./custom.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexiBase",
  description: "NexiBase - Community Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Google Analytics ID를 설정에서 읽기
  let gaId: string | null = null
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: 'google_analytics_id' }
    })
    if (setting?.value) gaId = setting.value
  } catch {
    // DB 연결 실패 시 무시
  }

  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <ThemeLoader />
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <SiteProvider>
              <SiteShell>
                {children}
              </SiteShell>
            </SiteProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
