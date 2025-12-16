"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Github, Twitter, MessageCircle } from "lucide-react"

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
    <footer className="border-t bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* 메인 푸터 콘텐츠 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* 사이트 정보 */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">
                  {settings.site_name[0]}
                </span>
              </div>
              <span className="font-bold text-foreground">{settings.site_name}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              함께 성장하는 커뮤니티
            </p>
            {/* 소셜 링크 */}
            <div className="flex items-center gap-3">
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Discord"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* 커뮤니티 */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">커뮤니티</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  홈
                </Link>
              </li>
              <li>
                <Link href="/popular" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  인기 게시글
                </Link>
              </li>
              <li>
                <Link href="/boards" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  전체 게시판
                </Link>
              </li>
            </ul>
          </div>

          {/* 정보 */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">정보</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/content/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  회사소개
                </Link>
              </li>
              <li>
                <Link href="/content/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  자주 묻는 질문
                </Link>
              </li>
              <li>
                <Link href="/content/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  문의하기
                </Link>
              </li>
            </ul>
          </div>

          {/* 정책 */}
          <div>
            <h4 className="font-semibold text-foreground mb-3 text-sm">정책</h4>
            <ul className="space-y-2">
              {settings.footer_links.length > 0 ? (
                settings.footer_links.map((link, index) => (
                  <li key={index}>
                    <Link
                      href={link.url}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))
              ) : (
                <>
                  <li>
                    <Link href="/policy/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      이용약관
                    </Link>
                  </li>
                  <li>
                    <Link href="/policy/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      개인정보처리방침
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* 하단 Copyright */}
        <div className="border-t pt-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name}. All rights reserved.`}
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Made with ❤️</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
