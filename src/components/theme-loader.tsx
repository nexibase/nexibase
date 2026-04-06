"use client"

import { useState, useEffect } from 'react'

export default function ThemeLoader() {
  const [themeFolder, setThemeFolder] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        const folder = data?.settings?.theme_folder
        if (folder && folder !== 'default') {
          setThemeFolder(folder)
        }
      })
      .catch(() => {})
  }, [])

  if (!themeFolder) return null

  return (
    <link
      rel="stylesheet"
      href={`/themes/${themeFolder}.css`}
      data-theme={themeFolder}
    />
  )
}
