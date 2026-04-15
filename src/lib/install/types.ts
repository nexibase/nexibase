export interface SeedBoard {
  slug: string
  name: string
  description: string | null
  category?: string | null
  isActive?: boolean
  useComment?: boolean
  useReaction?: boolean
}

export interface SeedMenu {
  position: 'header' | 'footer'
  groupName?: string | null
  label: string
  url: string
  sortOrder: number
}

export interface SeedWidget {
  widgetKey: string
  zone: string
  title: string
  colSpan: number
  rowSpan: number
  sortOrder: number
}

export interface SeedContent {
  slug: string
  title: string
  content: string
  isPublic: boolean
}

export interface SeedPolicy {
  slug: string
  version: string
  title: string
  content: string
  isActive: boolean
}

export interface SeedData {
  boards: SeedBoard[]
  menus: SeedMenu[]
  widgets: SeedWidget[]
  contents: SeedContent[]
  policies: SeedPolicy[]
}
