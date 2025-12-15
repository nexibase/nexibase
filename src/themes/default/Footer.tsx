"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface FooterLink {
  label: string
  url: string
}

interface FooterSettings {
  site_name: string
  footer_copyright: string
  footer_links: FooterLink[]
}

export default function Footer() {
  const [settings, setSettings] = useState<FooterSettings>({
    site_name: 'NexiBase',
    footer_copyright: '',
    footer_links: []
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings')
        if (response.ok) {
          const data = await response.json()
          const footerLinks = data.settings.footer_links
            ? JSON.parse(data.settings.footer_links)
            : []

          setSettings({
            site_name: data.settings.site_name || 'NexiBase',
            footer_copyright: data.settings.footer_copyright || '',
            footer_links: Array.isArray(footerLinks) ? footerLinks : []
          })
        }
      } catch (error) {
        console.error('푸터 설정 조회 에러:', error)
      }
    }

    fetchSettings()
  }, [])

  return (
    <footer className="border-t bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* 사이트명 */}
          <div className="text-lg font-semibold text-foreground">
            {settings.site_name}
          </div>

          {/* 푸터 링크 */}
          {settings.footer_links.length > 0 && (
            <nav className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
              {settings.footer_links.map((link, index) => (
                <Link
                  key={index}
                  href={link.url}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          )}

          {/* Copyright */}
          <div className="text-sm text-muted-foreground">
            {settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name}. All rights reserved.`}
          </div>
        </div>
      </div>
    </footer>
  )
}
