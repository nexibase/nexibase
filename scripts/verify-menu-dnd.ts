import assert from 'node:assert/strict'
import { loadEnvConfig } from '@next/env'
import { encode } from 'next-auth/jwt'
import { readFile, writeFile, unlink, access } from 'node:fs/promises'
import { prisma } from '../src/lib/prisma'

loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
const [base, mode = 'verify', statePath = '/tmp/nexibase-menu-dnd-fixture.json'] = process.argv.slice(2)
assert.ok(base && process.env.NEXTAUTH_SECRET)
assert.ok(['verify', 'prepare', 'check', 'cleanup'].includes(mode))
type SnapshotRow = { id: number; parentId: number | null; sortOrder: number; position: string; updatedAt: string; [key: string]: unknown }
type State = { marker: string; ids: number[]; before: SnapshotRow[] }
async function main() {
  const admin = await prisma.user.findFirstOrThrow({ where: { role: 'admin', status: 'active', deletedAt: null } })
  async function cookie(user: { id: number; email: string }) {
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET!, token: { id: String(user.id), sub: String(user.id), email: user.email }, maxAge: 600 })
    return `next-auth.session-token=${token}; __Secure-next-auth.session-token=${token}`
  }
  const adminCookie = await cookie(admin)
  let requests = 0
  async function request(path: string, expected = 200, method = 'GET', body?: unknown, actor = adminCookie) {
    requests++
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Cookie: actor }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    assert.equal(response.status, expected, `${method} ${path}`)
    return response.json()
  }
  async function snapshot() {
    return JSON.parse(JSON.stringify(await prisma.menu.findMany({ orderBy: { id: 'asc' } })))
  }
  async function unchanged(state: State) {
    assert.deepEqual((await snapshot()).filter((row: { id: number }) => !state.ids.includes(row.id)), state.before)
  }
  async function restoreOriginalSlots(state: State) {
    // A root drag normalizes old duplicate slots. Restore only the test's
    // numeric slot changes after proving original content and logical order match.
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM menus ORDER BY id FOR UPDATE`
      const rows: SnapshotRow[] = JSON.parse(JSON.stringify(await tx.menu.findMany({ orderBy: { id: 'asc' } })))
      const originalRows = rows.filter(menu => !state.ids.includes(menu.id))
      const fields = (menus: SnapshotRow[]) => menus.map(({ sortOrder, updatedAt, ...menu }) => menu)
      assert.deepEqual(fields(originalRows), fields(state.before), 'Original menu content changed; refusing restoration.')
      const order = (menus: SnapshotRow[]) => [...menus].sort((a, b) =>
        a.position.localeCompare(b.position) || (a.parentId || 0) - (b.parentId || 0) || a.sortOrder - b.sortOrder || a.id - b.id
      ).map(menu => menu.id)
      assert.deepEqual(order(originalRows), order(state.before), 'Original logical order changed; refusing restoration.')
      for (const before of state.before) {
        const current = originalRows.find(menu => menu.id === before.id)!
        if (current.sortOrder !== before.sortOrder) {
          await tx.menu.update({ where: { id: before.id }, data: { sortOrder: before.sortOrder, updatedAt: new Date(before.updatedAt) } })
        }
      }
    })
  }
  async function cleanup(state: State) {
    await restoreOriginalSlots(state)
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM menus ORDER BY id FOR UPDATE`
      const current = await tx.menu.findMany()
      assert.ok(!current.some(menu => menu.parentId !== null && state.ids.includes(menu.parentId) && !state.ids.includes(menu.id)), 'An unrelated menu was moved under a fixture; refusing cascade deletion.')
      const owned = current.filter(menu => state.ids.includes(menu.id))
      assert.ok(owned.every(menu => menu.url.startsWith('/' + state.marker)))
      await tx.menu.deleteMany({ where: { id: { in: state.ids }, url: { startsWith: '/' + state.marker } } })
    })
    await unchanged(state)
  }
  if (mode === 'check' || mode === 'cleanup') {
    const state: State = JSON.parse(await readFile(statePath, 'utf8'))
    if (mode === 'cleanup') {
      await cleanup(state); await unlink(statePath)
      console.log(JSON.stringify({ temporaryMenusRemoved: true, existingMenusUnchanged: true })); return
    }
    const [a, b, c, footer, first, second] = state.ids
    const data = await request('/api/admin/menus')
    const header = data.header.filter((menu: { id: number }) => state.ids.includes(menu.id))
    assert.deepEqual(header.map((menu: { id: number }) => menu.id), [a, c])
    assert.deepEqual(header[0].children.map((menu: { id: number }) => menu.id), [b])
    assert.deepEqual(data.footer.find((menu: { id: number }) => menu.id === footer).children.map((menu: { id: number }) => menu.id), [second, first])
    await restoreOriginalSlots(state)
    await unchanged(state)
    console.log(JSON.stringify({ browserHeaderOrderAndHierarchyPersisted: true, browserFooterOrderPersisted: true, existingMenusUnchanged: true })); return
  }
  if (mode === 'prepare') {
    const exists = await access(statePath).then(() => true, () => false)
    assert.ok(!exists, 'A browser fixture already exists.')
  }
  const state: State = { marker: `menu-dnd-check-${Date.now()}`, ids: [], before: await snapshot() }
  let keep = false
  try {
    const create = async (label: string, position: string, sortOrder: number, parentId: number | null = null) => {
      const data = await request('/api/admin/menus', 200, 'POST', { label, position, sortOrder, parentId, url: `/${state.marker}/${state.ids.length}`, isActive: mode === 'verify', groupName: '드래그 검증', target: '_blank', visibility: 'all', icon: '🧪' })
      assert.ok(data.menu?.id);state.ids.push(data.menu.id);return data.menu.id
    }
    const slot = 1000000
    const a = await create('드래그검증 A', 'header', slot)
    const b = await create('드래그검증 B', 'header', slot + 1)
    const c = await create('드래그검증 C', 'header', slot + 2)
    const footer = await create('푸터검증', 'footer', slot)
    const first = await create('푸터검증 1', 'footer', 0, footer)
    const second = await create('푸터검증 2', 'footer', 1, footer)
    if (mode === 'prepare') {
      await writeFile(statePath, JSON.stringify(state), { flag: 'wx', mode: 0o600 });keep = true
      console.log(JSON.stringify({ fixtureIds: state.ids, inactiveBrowserFixturesReady: true, existingMenusUnchanged: true }));return
    }
    const order = (id: number, sortOrder: number, parentId: number | null = null) => ({ id, parentId, sortOrder })
    const reorder = (items: unknown[], expected = 200, extra = {}) => request('/api/admin/menus/reorder', expected, 'PUT', { items, ...extra })
    await reorder([order(c, slot), order(a, slot + 1), order(b, slot + 2)])
    const publicHeader = (await request('/api/menus?position=header')).menus.filter((menu: { id: number }) => state.ids.includes(menu.id))
    assert.deepEqual(publicHeader.map((menu: { id: number }) => menu.id), [c, a, b])
    await reorder([order(b, 0, a)])
    let data = await request('/api/admin/menus')
    assert.deepEqual(data.header.find((menu: { id: number }) => menu.id === a).children.map((menu: { id: number }) => menu.id), [b])
    await reorder([order(second, 0, footer), order(first, 1, footer)])
    data = await request('/api/admin/menus')
    assert.deepEqual(data.footer.find((menu: { id: number }) => menu.id === footer).children.map((menu: { id: number }) => menu.id), [second, first])
    const regular = await prisma.user.findFirstOrThrow({ where: { role: 'user', status: 'active', deletedAt: null } })
    for (const actor of ['', await cookie(regular)]) await request('/api/admin/menus/reorder', 401, 'PUT', { items: [order(a, slot)] }, actor)
    const beforeInvalid = await snapshot()
    for (const items of [[], [order(a, 0, a)], [order(a, 0, b)], [order(c, 0, b)], [order(b, 0, footer)],
      [order(b, -1)], [order(a, 0), order(a, 1)], [order(a, 0, 2147483647)]]) await reorder(items, 400)
    await reorder([order(a, 123), order(2147483647, 0)], 404)
    assert.deepEqual(await snapshot(), beforeInvalid, 'Invalid batches must be atomic.')
    const expected = (await prisma.menu.findMany({ where: { position: 'header' } })).map(({ id, parentId, sortOrder }) => ({ id, parentId, sortOrder }))
    await reorder([order(c, slot + 3)], 200, { position: 'header', expected })
    const afterFirst = await snapshot()
    await reorder([order(a, slot + 4)], 409, { position: 'header', expected })
    assert.deepEqual(await snapshot(), afterFirst)
    await reorder([order(a, slot), order(b, slot + 1), order(c, slot + 2)])
    const concurrent = await Promise.all([
      fetch(base + '/api/admin/menus/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ items: [order(a, 0, c)] }) }),
      fetch(base + '/api/admin/menus/reorder', { method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: adminCookie }, body: JSON.stringify({ items: [order(c, 0, a)] }) }),
    ])
    requests += 2
    assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 400])
    await Promise.all(concurrent.map(response => response.text()))
    await unchanged(state)
    console.log(JSON.stringify({ base, requestsPassed: requests, headerAndFooterOrderPersisted: true, hierarchyPersisted: true, invalidBatchesAtomic: true, staleEditsRejected: true, concurrentCyclePrevented: true, adminOnly: true, existingMenusUnchanged: true }))
  } finally {
    if (!keep) await cleanup(state)
  }
}
main().catch(error => { console.error(error.message);process.exitCode = 1 }).finally(() => prisma.$disconnect())
