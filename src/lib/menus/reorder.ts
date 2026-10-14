import type { MenuOrder } from './tree'

export interface MenuRecord extends MenuOrder { position: string }
export interface MenuOrderRequest {
  items: MenuOrder[]
  position?: 'header' | 'footer'
  expected?: MenuOrder[]
}
export class MenuOrderError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
const validId = (value: unknown): value is number => Number.isInteger(value) && Number(value) > 0 && Number(value) <= 2147483647
function parseItems(value: unknown, allowEmpty = false): MenuOrder[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new MenuOrderError('Invalid menu order.')
  const ids = new Set<number>()
  for (const item of value) {
    if (!item || !validId(item.id) || ids.has(item.id) ||
      !(item.parentId === null || validId(item.parentId)) ||
      !Number.isInteger(item.sortOrder) || item.sortOrder < 0 || item.sortOrder > 2147483647) {
      throw new MenuOrderError('Invalid menu order.')
    }
    ids.add(item.id)
  }
  return value.map(item => ({ id: item.id, parentId: item.parentId, sortOrder: item.sortOrder }))
}
export function parseMenuOrderRequest(value: unknown): MenuOrderRequest {
  if (!value || typeof value !== 'object') throw new MenuOrderError('Invalid request.')
  const body = value as Record<string, unknown>
  const result: MenuOrderRequest = { items: parseItems(body.items) }
  if (body.position !== undefined) {
    if (body.position !== 'header' && body.position !== 'footer') throw new MenuOrderError('Invalid menu position.')
    result.position = body.position
  }
  if (body.expected !== undefined) {
    if (!result.position) throw new MenuOrderError('Menu position is required.')
    result.expected = parseItems(body.expected, true)
  }
  return result
}

export function validateMenuOrder(records: MenuRecord[], request: MenuOrderRequest): void {
  const existing = new Map(records.map(menu => [menu.id, menu]))
  if (request.expected) {
    const current = records.filter(menu => menu.position === request.position)
    if (current.length !== request.expected.length || request.expected.some(item => {
      const menu = existing.get(item.id)
      return !menu || menu.position !== request.position || menu.parentId !== item.parentId || menu.sortOrder !== item.sortOrder
    })) throw new MenuOrderError('Menu order changed. Reload and try again.', 409)
  }
  const next = new Map(records.map(menu => [menu.id, { ...menu }]))
  const affected = new Set<string>()
  for (const item of request.items) {
    const menu = next.get(item.id)
    if (!menu) throw new MenuOrderError('Menu not found.', 404)
    if (request.position && menu.position !== request.position) throw new MenuOrderError('Menu position mismatch.')
    affected.add(menu.position)
    next.set(item.id, { ...menu, parentId: item.parentId, sortOrder: item.sortOrder })
  }
  for (const menu of next.values()) {
    if (!affected.has(menu.position) || menu.parentId === null) continue
    const parent = next.get(menu.parentId)
    if (!parent || parent.id === menu.id || parent.position !== menu.position || parent.parentId !== null) {
      throw new MenuOrderError('Menus support two levels within the same position.')
    }
  }
}
