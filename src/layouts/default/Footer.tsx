"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ConsentSettingsLink } from "@/components/consent/ConsentSettingsLink"

interface FooterSettings {
  site_name: string
  footer_copyright: string
}

interface FooterMenuItem {
  id: number
  label: string
  url: string
  target: string
}

export default function Footer() {
  const [settings, setSettings] = useState<FooterSettings>({
    site_name: 'NexiBase',
    footer_copyright: '',
  })
  const [menuGroups, setMenuGroups] = useState<Record<string, FooterMenuItem[]>>({})

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [settingsRes, menusRes] = await Promise.all([
          fetch('/api/settings'),
          fetch('/api/menus?position=footer'),
        ])

        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setSettings({
            site_name: data.settings.site_name || 'NexiBase',
            footer_copyright: data.settings.footer_copyright || '',
          })
        }

        if (menusRes.ok) {
          const data = await menusRes.json()
          setMenuGroups(data.menus || {})
        }
      } catch (error) {
        console.error('failed to fetch footer data:', error)
      }
    }

    fetchData()
  }, [])

  const groupNames = Object.keys(menuGroups)

  return (
    <footer className="border-t bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Main footer content */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Site info */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">
                  {settings.site_name[0]}
                </span>
              </div>
              <span className="font-bold text-foreground">{settings.site_name}</span>
            </div>
          </div>

          {/* DB-driven menu groups */}
          {groupNames.length > 0 ? (
            groupNames.map((groupName) => (
              <div key={groupName}>
                <h4 className="font-semibold text-foreground mb-3 text-sm">{groupName}</h4>
                <ul className="space-y-2">
                  {menuGroups[groupName].map((menu) => (
                    <li key={menu.id}>
                      <Link
                        href={menu.url}
                        target={menu.target}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {menu.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : null /* Empty state until DB menus load (no hardcoded Korean fallback) */}
        </div>

        {/* Copyright strip */}
        <div className="border-t pt-6">
          <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-4">
            <p className="text-sm text-muted-foreground">
              {settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name}. All rights reserved.`}
            </p>
            {/* 쿠키 동의 철회 진입점. 아직 결정 전이거나 기능이 꺼져 있으면 스스로
                아무것도 렌더하지 않는다. 이 컴포넌트를 빼면 Provider가 페이지 맨
                아래에 예비 줄을 대신 내보낸다 — 철회 경로는 어떤 테마에서도
                사라지면 안 되기 때문이다(GDPR 7(3)). */}
            <ConsentSettingsLink />
          </div>
        </div>
      </div>
    </footer>
  )
}
