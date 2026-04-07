"use client"

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

interface UserInfo {
  id: string
  email: string
  nickname: string
  image: string | null
  role: string
}

interface SiteSettings {
  site_name: string
  site_logo: string
  signup_enabled: string
}

interface Board {
  id: number
  slug: string
  name: string
}

interface MenuItem {
  id: number
  label: string
  url: string
  icon: string | null
  target: string
  visibility: string
  isActive: boolean
  sortOrder: number
  children: MenuItem[]
}

interface WidgetData {
  id: number
  widgetKey: string
  zone: string
  title: string
  settings: string | null
  colSpan: number
  rowSpan: number
  isActive: boolean
  sortOrder: number
}

interface SiteContextValue {
  user: UserInfo | null
  settings: SiteSettings
  boards: Board[]
  headerMenus: MenuItem[]
  sidebarWidgets: WidgetData[]
  isLoading: boolean
  setUser: (user: UserInfo | null) => void
  refreshUser: () => Promise<void>
}

const defaultSettings: SiteSettings = {
  site_name: 'NexiBase',
  site_logo: '',
  signup_enabled: 'true',
}

const SiteContext = createContext<SiteContextValue>({
  user: null,
  settings: defaultSettings,
  boards: [],
  headerMenus: [],
  sidebarWidgets: [],
  isLoading: true,
  setUser: () => {},
  refreshUser: async () => {},
})

export function useSite() {
  return useContext(SiteContext)
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings)
  const [boards, setBoards] = useState<Board[]>([])
  const [headerMenus, setHeaderMenus] = useState<MenuItem[]>([])
  const [sidebarWidgets, setSidebarWidgets] = useState<WidgetData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [userRes, settingsRes, boardsRes, menusRes, widgetsRes] = await Promise.all([
          fetch('/api/me'),
          fetch('/api/settings'),
          fetch('/api/boards?limit=10'),
          fetch('/api/menus?position=header'),
          fetch('/api/home-widgets'),
        ])

        if (userRes.ok) {
          const data = await userRes.json()
          setUser(data.user)
        }

        if (settingsRes.ok) {
          const data = await settingsRes.json()
          setSettings({
            site_name: data.settings.site_name || 'NexiBase',
            site_logo: data.settings.site_logo || '',
            signup_enabled: data.settings.signup_enabled ?? 'true',
          })
        }

        if (boardsRes.ok) {
          const data = await boardsRes.json()
          setBoards(data.boards || [])
        }

        if (menusRes.ok) {
          const data = await menusRes.json()
          setHeaderMenus(data.menus || [])
        }

        if (widgetsRes.ok) {
          const data = await widgetsRes.json()
          const all: WidgetData[] = []
          for (const zone of Object.keys(data.widgets || {})) {
            for (const w of data.widgets[zone]) {
              all.push(w)
            }
          }
          setSidebarWidgets(all.filter(w => w.zone === 'left' || w.zone === 'right' || w.zone === 'sidebar'))
        }
      } catch (error) {
        console.error('SiteContext 데이터 조회 에러:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAll()
  }, [])

  return (
    <SiteContext.Provider value={{ user, settings, boards, headerMenus, sidebarWidgets, isLoading, setUser, refreshUser }}>
      {children}
    </SiteContext.Provider>
  )
}
