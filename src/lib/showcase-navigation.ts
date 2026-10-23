interface ShowcaseMenu {
  url: string
  isActive: boolean
  visibility?: string
}

// Use the saved menu object so labels, targets, and access settings survive updates.
export function getMobileShowcaseMenu<T extends ShowcaseMenu>(menus: T[], user: { role: string } | null): T | undefined {
  return menus.find(menu => menu.url === '/boards/showcase' && menu.isActive &&
    (menu.visibility !== 'member' || !!user) &&
    (menu.visibility !== 'admin' || user?.role === 'admin'))
}
