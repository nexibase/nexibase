"use client"

import { useState, useEffect } from "react"
import { UserLayout } from "@/components/layout/UserLayout"
import { getLayoutComponent } from "@/lib/layout-loader"

export default function Page() {
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

  const HomePageComponent = getLayoutComponent(layoutFolder, 'HomePage')

  return (
    <UserLayout>
      <HomePageComponent />
    </UserLayout>
  )
}
