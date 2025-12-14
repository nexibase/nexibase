"use client"

import Link from "next/link"
import { Github, Twitter } from "lucide-react"

const footerLinks = {
  product: [
    { label: "기능", href: "#features" },
    { label: "기술 스택", href: "#tech-stack" },
    { label: "시작하기", href: "#getting-started" },
  ],
  resources: [
    { label: "문서", href: "https://github.com/gnuboard/nexibase#readme", external: true },
    { label: "GitHub", href: "https://github.com/gnuboard/nexibase", external: true },
    { label: "이슈", href: "https://github.com/gnuboard/nexibase/issues", external: true },
  ],
  community: [
    { label: "그누보드", href: "https://sir.kr", external: true },
    { label: "토론", href: "https://github.com/gnuboard/nexibase/discussions", external: true },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Main Footer */}
        <div className="py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <span className="text-xl font-bold tracking-tight">
                Nexi<span className="text-primary">Base</span>
              </span>
            </Link>
            <p className="text-sm text-muted-foreground mb-4">
              모던 웹 앱을 위한 기반. Next.js, React, Prisma로 구축되었습니다.
            </p>
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/gnuboard/nexibase"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold mb-4">제품</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold mb-4">리소스</h3>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="font-semibold mb-4">커뮤니티</h3>
            <ul className="space-y-3">
              {footerLinks.community.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} NexiBase. MIT 라이선스.
          </p>
          <p className="text-sm text-muted-foreground">
            Next.js + I + Base
          </p>
        </div>
      </div>
    </footer>
  )
}
