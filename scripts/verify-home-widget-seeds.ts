import assert from 'node:assert/strict'
import { PrismaClient, type Prisma } from '@prisma/client'
import { seedHomeWidgets, type HomeWidgetSeed } from '../src/lib/widgets/seed-home'

// Use a fresh, disposable database. Never run this against an application database.
const url = process.env.TEST_DATABASE_URL
assert.ok(url, 'TEST_DATABASE_URL is required.')
assert.match(new URL(url).pathname, /^\/nexibase_seed_verify_[a-zA-Z0-9_]+$/,
  'The database name must begin with nexibase_seed_verify_.')
const prisma = new PrismaClient({ datasources: { db: { url } } })
const widget: HomeWidgetSeed = { widgetKey: 'welcome-banner', zone: 'top', title: 'Welcome', colSpan: 12 }
const rollback = new Error('Verification transaction rollback')
async function scenario(check: (tx: Prisma.TransactionClient) => Promise<void>) {
  try {
    await prisma.$transaction(async tx => { await check(tx); throw rollback })
  } catch (error) { if (error !== rollback) throw error }
}
async function main() {
  assert.equal(await prisma.widgetPage.count(), 0, 'Use an empty test database.')
  assert.equal(await prisma.pageWidget.count(), 0, 'Use an empty test database.')
  await scenario(async tx => {
    assert.equal(await seedHomeWidgets(tx, []), 0)
    assert.equal(await tx.widgetPage.count(), 0)
  })
  await scenario(async tx => {
    assert.equal(await seedHomeWidgets(tx, [widget, widget]), 1)
    assert.equal(await seedHomeWidgets(tx, [widget]), 0)
    const page = await tx.widgetPage.findUniqueOrThrow({ where: { slug: '' }, include: { widgets: true } })
    assert.equal(page.widgets.length, 1)
    assert.equal(page.widgets[0].widgetType, 'registry')
    assert.equal(page.widgets[0].zone, 'top')
    assert.equal(page.widgets[0].colSpan, 12)
  })
  await scenario(async tx => {
    const about = await tx.widgetPage.create({ data: { title: 'About', slug: 'about', widgets: { create: { ...widget } } } })
    assert.equal(await seedHomeWidgets(tx, [widget]), 1)
    assert.equal(await tx.pageWidget.count({ where: { pageId: about.id } }), 1)
    assert.equal(await tx.pageWidget.count(), 2)
  })
  await scenario(async tx => {
    const home = await tx.widgetPage.create({ data: { title: 'Custom home', slug: '', layoutTemplate: 'full-width', isActive: false } })
    const custom = await tx.pageWidget.create({ data: { ...widget, pageId: home.id, title: 'Customized', isActive: false, sortOrder: 42 } })
    assert.equal(await seedHomeWidgets(tx, [{ ...widget, widgetKey: 'latest-posts' }], true), 0)
    assert.deepEqual(await tx.pageWidget.findUnique({ where: { id: custom.id } }), custom)
    assert.deepEqual(await tx.widgetPage.findUnique({ where: { id: home.id } }), home)
    assert.equal(await seedHomeWidgets(tx, [widget, { ...widget, widgetKey: 'latest-posts' }]), 1)
    assert.deepEqual(await tx.pageWidget.findUnique({ where: { id: custom.id } }), custom)
  })
  await assert.rejects(prisma.$transaction(tx => seedHomeWidgets(tx, [widget, {
    ...widget, widgetKey: 'invalid-widget', title: 'x'.repeat(200),
  }])))
  assert.equal(await prisma.widgetPage.count(), 0)
  assert.equal(await prisma.pageWidget.count(), 0, 'Failed seeds must not leave partial widgets.')
  console.log(JSON.stringify({ passed: 5, homePageScoped: true, repeatedCallsIdempotent: true,
    customLayoutsPreserved: true, onlyIfEmptyPreservesWidgets: true, failedSeedsRolledBack: true }))
}
main().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => prisma.$disconnect())
