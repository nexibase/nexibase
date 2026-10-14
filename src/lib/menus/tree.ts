export interface MenuOrder {
  id: number
  parentId: number | null
  sortOrder: number
}

export interface MenuItem extends MenuOrder {
  position: string
  groupName: string | null
  label: string
  url: string
  icon: string | null
  target: string
  visibility: string
  isActive: boolean
  children?: MenuItem[]
  pluginFolder: string | null
  pluginEnabled: boolean
  pluginName: string | null
}

export interface MenuRow { menu: MenuItem; depth: number }
export interface MenuProjection { depth: number; parentId: number | null }
export const MENU_INDENT = 28

export function flattenMenus(menus: MenuItem[], depth = 0): MenuRow[] {
  return menus.flatMap(menu => [{ menu, depth }, ...flattenMenus(menu.children || [], depth + 1)])
}

// Collapse groups while moving a whole parent so its children travel together.
export function menuDragRows(menus: MenuItem[], activeId: number | null): MenuRow[] {
  const rows = flattenMenus(menus)
  return rows.find(row => row.menu.id === activeId)?.menu.children?.length
    ? rows.filter(row => row.depth === 0)
    : rows
}

function moveRow(rows: MenuRow[], activeId: number, overId: number): MenuRow[] | null {
  const from = rows.findIndex(row => row.menu.id === activeId)
  const to = rows.findIndex(row => row.menu.id === overId)
  if (from < 0 || to < 0) return null
  const next = [...rows]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export function projectMenuMove(rows: MenuRow[], activeId: number, overId: number, offsetX: number): MenuProjection | null {
  const reordered = moveRow(rows, activeId, overId)
  if (!reordered) return null
  const index = reordered.findIndex(row => row.menu.id === activeId)
  const active = reordered[index]
  if (active.menu.children?.length) return { depth: 0, parentId: null }
  const previous = reordered[index - 1]
  const next = reordered[index + 1]
  const maximum = previous ? Math.min(previous.depth + 1, 1) : 0
  const minimum = next?.depth ?? 0
  const depth = Math.max(minimum, Math.min(maximum, active.depth + Math.round(offsetX / MENU_INDENT)))
  if (depth > 1) return null
  const parentId = depth === 0 ? null : previous?.depth === 0 ? previous.menu.id : previous?.menu.parentId
  if (parentId === undefined || parentId === activeId) return null
  const parent = rows.find(row => row.menu.id === parentId)?.menu
  if (parent?.pluginFolder && !parent.pluginEnabled) return null
  return { depth, parentId }
}

export function moveMenuTree(menus: MenuItem[], activeId: number, overId: number, offsetX: number): MenuItem[] | null {
  const rows = menuDragRows(menus, activeId)
  const projection = projectMenuMove(rows, activeId, overId, offsetX)
  const reordered = moveRow(rows, activeId, overId)
  if (!projection || !reordered) return null
  const active = rows.find(row => row.menu.id === activeId)!
  if (activeId === overId && active.menu.parentId === projection.parentId) return menus
  const collapsed = !!active.menu.children?.length
  const nodes = new Map(reordered.map(row => [row.menu.id, {
    ...row.menu,
    parentId: row.menu.id === activeId ? projection.parentId : row.menu.parentId,
    children: collapsed ? [...(row.menu.children || [])] : [] as MenuItem[],
  }]))
  const roots: MenuItem[] = []
  for (const row of reordered) {
    const node = nodes.get(row.menu.id)!
    if (node.parentId === null) roots.push(node)
    else {
      const parent = nodes.get(node.parentId)
      if (!parent || parent.parentId !== null) return null
      parent.children.push(node)
    }
  }
  const originals = new Map(flattenMenus(menus).map(row => [row.menu.id, row.menu]))
  function assignOrder(next: MenuItem[], before: MenuItem[], parentId: number | null): MenuItem[] {
    // Reuse existing order slots. Sparse orders need not renumber unrelated menus.
    const slots = before.map(menu => menu.sortOrder).sort((a, b) => a - b)
    let last = -1
    const sameSiblings = next.length === before.length && next.every((menu, index) => menu.id === before[index].id)
    return next.map((menu, index) => {
      const sortOrder = sameSiblings ? before[index].sortOrder : Math.max(last + 1, slots[index] ?? last + 1)
      last = sortOrder
      return { ...menu, parentId, sortOrder,
        children: assignOrder(menu.children || [], originals.get(menu.id)?.children || [], menu.id) }
    })
  }
  return assignOrder(roots, menus, null)
}

export function menuOrder(menus: MenuItem[]): MenuOrder[] {
  return flattenMenus(menus).map(({ menu }) => ({ id: menu.id, parentId: menu.parentId, sortOrder: menu.sortOrder }))
}

export function changedMenuOrder(before: MenuItem[], after: MenuItem[]): MenuOrder[] {
  const previous = new Map(menuOrder(before).map(item => [item.id, item]))
  return menuOrder(after).filter(item => {
    const old = previous.get(item.id)
    return !old || old.parentId !== item.parentId || old.sortOrder !== item.sortOrder
  })
}
