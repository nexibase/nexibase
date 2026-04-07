"use client"

import { usePathname } from "next/navigation"
import { getLayoutComponent } from "@/lib/layout-loader"
import { useState, useEffect } from "react"

const NO_SHELL_PATHS = ['/admin', '/login', '/signup', '/email-certify', '/verify-email']

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [layoutFolder, setLayoutFolder] = useState('default')

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.settings?.layout_folder) {
          setLayoutFolder(data.settings.layout_folder)
        }
      })
      .catch(() => {})
  }, [])

  const shouldShowShell = !NO_SHELL_PATHS.some(p => pathname?.startsWith(p))

  if (!shouldShowShell) {
    return <>{children}</>
  }

  const HeaderComponent = getLayoutComponent(layoutFolder, 'Header')
  const FooterComponent = getLayoutComponent(layoutFolder, 'Footer')

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <HeaderComponent />
      <div className="flex-1">
        {children}
      </div>
      <FooterComponent />
    </div>
  )
}
