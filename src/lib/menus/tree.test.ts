import assert from 'node:assert/strict'
import { test } from 'node:test'
import { changedMenuOrder, flattenMenus, menuDragRows, moveMenuTree, projectMenuMove, type MenuItem } from './tree'

function item(id: number, sortOrder = id * 10, children: MenuItem[] = []): MenuItem {
  return { id, parentId: null, sortOrder, children: children.map(child => ({ ...child, parentId: id })),
    position: 'header', label: `Menu ${id}`, url: `/menu-${id}`, groupName: 'Group', icon: 'icon',
    target: '_blank', visibility: 'member', isActive: false, pluginFolder: null, pluginEnabled: true, pluginName: null }
}

test('sorting preserves sparse slots and does not rewrite unrelated menus', () => {
  const before = [item(1, 0), item(2, 10), item(3, 100), item(4, 101)]
  const after = moveMenuTree(before, 4, 3, 0)!
  assert.deepEqual(after.map(menu => menu.id), [1, 2, 4, 3])
  assert.deepEqual(changedMenuOrder(before, after).map(menu => menu.id), [4, 3])
  assert.deepEqual(before.map(menu => menu.id), [1, 2, 3, 4])
  assert.equal(after[2].url, '/menu-4')
  assert.deepEqual([after[2].groupName, after[2].icon, after[2].target, after[2].visibility, after[2].isActive], ['Group', 'icon', '_blank', 'member', false])
})

test('equal old sort orders become unique so moving actually persists', () => {
  const after = moveMenuTree([item(1, 0), item(2, 0), item(3, 0)], 3, 1, 0)!
  assert.deepEqual(after.map(menu => [menu.id, menu.sortOrder]), [[3, 0], [1, 1], [2, 2]])
})

test('horizontal movement nests a leaf and moves a last child back to the root', () => {
  const before = [item(1, 0), item(2, 10), item(3, 20)]
  const nested = moveMenuTree(before, 3, 3, 28)!
  assert.deepEqual(nested.map(menu => menu.id), [1, 2])
  assert.deepEqual(nested[1].children?.map(menu => [menu.id, menu.parentId]), [[3, 2]])
  const lifted = moveMenuTree(nested, 3, 3, -28)!
  assert.deepEqual(lifted.map(menu => [menu.id, menu.parentId]), [[1, null], [2, null], [3, null]])
})

test('a child can change parents without losing its siblings', () => {
  const before = [item(1, 0, [item(11, 0), item(12, 1)]), item(2, 10), item(3, 20)]
  const after = moveMenuTree(before, 11, 2, 0)!
  assert.deepEqual(after[0].children?.map(menu => menu.id), [12])
  assert.deepEqual(after[1].children?.map(menu => [menu.id, menu.parentId]), [[11, 2]])
  assert.deepEqual(flattenMenus(after).map(row => row.menu.id), [1, 12, 2, 11, 3])
})

test('moving a parent carries the entire group and prevents a third level', () => {
  const before = [item(1, 0, [item(11, 0), item(12, 1)]), item(2, 10, [item(21, 0)]), item(3, 20)]
  assert.deepEqual(menuDragRows(before, 1).map(row => row.menu.id), [1, 2, 3])
  const after = moveMenuTree(before, 1, 2, 280)!
  assert.deepEqual(after.map(menu => menu.id), [2, 1, 3])
  assert.deepEqual(after[1].children?.map(menu => [menu.id, menu.parentId]), [[11, 1], [12, 1]])
  assert.deepEqual(after[0].children?.map(menu => menu.id), [21])
  assert.equal(after[1].parentId, null)
})

test('no-op and missing targets never produce order writes', () => {
  const before = [item(1), item(2)]
  assert.equal(moveMenuTree(before, 2, 2, 0), before)
  assert.deepEqual(changedMenuOrder(before, before), [])
  assert.equal(moveMenuTree(before, 2, 999, 0), null)
})

test('a disabled plugin cannot become the new parent', () => {
  const disabled = { ...item(1), pluginFolder: 'shop', pluginEnabled: false }
  assert.equal(projectMenuMove(menuDragRows([disabled, item(2)], 2), 2, 2, 28), null)
})

test('reordering children does not renumber unrelated root groups with equal order values', () => {
  const before = [item(1, 0, [item(11, 0), item(12, 1)]), item(2, 0)]
  const after = moveMenuTree(before, 12, 11, 0)!
  assert.deepEqual(after.map(menu => menu.sortOrder), [0, 0])
  assert.deepEqual(changedMenuOrder(before, after).map(menu => menu.id), [12, 11])
})
