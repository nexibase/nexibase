import assert from 'node:assert/strict'
import { test } from 'node:test'
import { MenuOrderError, parseMenuOrderRequest, validateMenuOrder, type MenuRecord } from './reorder'

const records: MenuRecord[] = [
  { id: 1, parentId: null, sortOrder: 0, position: 'header' },
  { id: 2, parentId: 1, sortOrder: 0, position: 'header' },
  { id: 3, parentId: null, sortOrder: 10, position: 'header' },
  { id: 4, parentId: null, sortOrder: 0, position: 'footer' },
]
const update = (id: number, parentId: number | null) => ({ id, parentId, sortOrder: 0 })

test('malformed and duplicate order IDs are rejected before database writes', () => {
  for (const items of [null, [], [update(0, null)], [update(1, null), update(1, null)],
    [{ ...update(1, null), sortOrder: -1 }], [{ ...update(1, null), sortOrder: 1.5 }],
    [{ id: 1, sortOrder: 0 }], [update(1, 1.5)]]) {
    assert.throws(() => parseMenuOrderRequest({ items }), MenuOrderError)
  }
})

test('self, cyclic, missing-parent, deeper and cross-position trees are rejected', () => {
  for (const items of [[update(1, 1)], [update(1, 2)], [update(2, 999)],
    [update(3, 2)], [update(2, 4)], [update(1, 3), update(3, 1)]]) {
    assert.throws(() => validateMenuOrder(records, { items }), MenuOrderError)
  }
  assert.equal(records[0].parentId, null)
})

test('valid reparenting and lifting validate the final tree as one operation', () => {
  validateMenuOrder(records, { items: [update(2, 3)] })
  validateMenuOrder(records, { items: [update(2, null), update(1, 2)] })
  assert.throws(() => validateMenuOrder(records, { position: 'header', items: [update(4, null)] }), MenuOrderError)
  assert.throws(() => validateMenuOrder(records, { items: [update(999, null)] }), (error: unknown) => error instanceof MenuOrderError && error.status === 404)
})

test('stale order snapshots are rejected instead of overwriting another administrator', () => {
  const expected = records.filter(menu => menu.position === 'header').map(({ id, parentId, sortOrder }) => ({ id, parentId, sortOrder }))
  validateMenuOrder(records, { position: 'header', expected, items: [update(3, null)] })
  for (const snapshot of [expected.slice(1), expected.map(item => item.id === 3 ? { ...item, sortOrder: 11 } : item)]) {
    assert.throws(() => validateMenuOrder(records, { position: 'header', expected: snapshot, items: [update(3, null)] }),
      (error: unknown) => error instanceof MenuOrderError && error.status === 409)
  }
})
