const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const { before, after, test } = require('node:test')

const root = path.resolve(__dirname, '..')
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'nexibase-core-test-'))
const features = require('../src/lib/core-features.json')
const routeFiles = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else routeFiles.push(path.relative(root, file))
  }
}
function scan() {
  return spawnSync(process.execPath, ['scripts/scan-plugins.js'], { cwd: fixture, encoding: 'utf8' })
}
before(() => {
  for (const dir of ['scripts', 'prisma', 'src']) {
    fs.cpSync(path.join(root, dir), path.join(fixture, dir), {
      recursive: true, filter: file => path.basename(file) !== '.git',
    })
  }
  for (const feature of features) {
    for (const prefix of ['src/app/[locale]', 'src/app/[locale]/admin', 'src/app/api', 'src/app/api/admin']) {
      const featurePath = feature === 'notifications' && prefix === 'src/app/[locale]' ? 'mypage/notifications' : feature
      walk(path.join(root, prefix, featurePath))
    }
  }
  routeFiles.push('src/app/api/faq/route.ts', 'src/app/api/admin/faq/route.ts', 'src/app/api/faq-accordion/route.ts', 'src/app/api/admin/faq-accordion/route.ts')
})
after(() => {
  assert.ok(fixture.startsWith(path.join(os.tmpdir(), 'nexibase-core-test-')))
  fs.rmSync(fixture, { recursive: true, force: true })
})

test('repeated plugin scans leave every core page and API unchanged', () => {
  assert.ok(routeFiles.length >= 25)
  for (let pass = 0; pass < 2; pass++) {
    const result = scan()
    assert.equal(result.status, 0, result.stderr)
    for (const file of routeFiles) {
      assert.equal(fs.readFileSync(path.join(fixture, file), 'utf8'), fs.readFileSync(path.join(root, file), 'utf8'), file)
    }
  }
})

test('core publishing is absent from plugin metadata while optional plugins remain', () => {
  const manifest = fs.readFileSync(path.join(fixture, 'src/plugins/_generated.ts'), 'utf8')
  for (const feature of features) assert.ok(!manifest.includes(`'${feature}': {`), feature)
  assert.ok(!manifest.includes("'faq-accordion': {"))
  for (const plugin of ['shop', 'polls', 'weather-widget']) assert.ok(manifest.includes(`'${plugin}': {`), plugin)
  const core = fs.readFileSync(path.join(fixture, 'prisma/schema.base.prisma'), 'utf8')
  const generated = fs.readFileSync(path.join(fixture, 'prisma/schema.prisma'), 'utf8')
  for (const model of ['Board', 'Post', 'PostAttachment', 'Comment', 'Reaction', 'Content', 'Policy', 'FaqCategory', 'Faq', 'Notification', 'NotificationEvent', 'NotificationDelivery']) {
    assert.match(core, new RegExp(`model ${model} \\{`))
    assert.equal((generated.match(new RegExp(`model ${model} \\{`, 'g')) || []).length, 1)
  }
})

test('saved widget keys, translations, and withdrawal retention remain available', () => {
  const registry = fs.readFileSync(path.join(fixture, 'src/lib/widgets/_generated-registry.ts'), 'utf8')
  for (const key of ['latest-posts', 'board-cards', 'popular-boards', 'faq-widget']) assert.ok(registry.includes(`'${key}': {`))
  assert.ok(!registry.includes('@/plugins/boards/'))
  for (const locale of ['ko', 'en']) {
    const messages = JSON.parse(fs.readFileSync(path.join(fixture, `src/messages/${locale}.json`), 'utf8'))
    for (const feature of features) assert.ok(messages[feature])
  }
  const policySource = fs.readFileSync(path.join(fixture, 'src/lib/withdrawal/_generated-policies.ts'), 'utf8')
  const policies = JSON.parse(policySource.slice(policySource.indexOf('= ') + 2))
  for (const model of ['Post', 'Comment', 'Reaction']) {
    assert.equal(policies.core.find(entry => entry.model === model)?.policy, 'retain')
  }
  assert.ok(!policies.boards)
  assert.ok(!policies['faq-accordion'])
  assert.ok(!registry.includes('@/plugins/faq-accordion/'))
})

test('core notifications remain available when Shop is not installed', () => {
  const shop = path.join(fixture, 'src/plugins/shop')
  const snapshot = path.join(fixture, 'optional-shop-snapshot')
  assert.ok(path.resolve(shop).startsWith(path.resolve(fixture) + path.sep))
  fs.renameSync(shop, snapshot)
  try {
    const result = scan()
    assert.equal(result.status, 0, result.stderr)
    const schema = fs.readFileSync(path.join(fixture, 'prisma/schema.prisma'), 'utf8')
    assert.ok(schema.includes('model NotificationDelivery {'))
    for (const file of ['notification.ts', 'email.ts', ...fs.readdirSync(path.join(root, 'src/lib/notifications')).filter(f => f.endsWith('.ts')).map(f => `notifications/${f}`)]) {
      const source = fs.readFileSync(path.join(root, 'src/lib', file), 'utf8')
      assert.ok(!source.includes('@/plugins/shop') && !source.includes('prisma.shopSetting'), file)
    }
  } finally { fs.renameSync(snapshot, shop); assert.equal(scan().status, 0) }
})

test('plugins cannot overwrite reserved core route slugs', () => {
  const plugin = path.join(fixture, 'src/plugins/core-collision-test')
  fs.mkdirSync(plugin)
  for (const slug of [...features, ...Object.keys(require('../src/lib/core-route-aliases.json'))]) {
    fs.writeFileSync(path.join(plugin, 'plugin.ts'), `export default { name: 'Collision', slug: '${slug}' }`)
    const result = scan()
    assert.equal(result.status, 1)
    assert.match(result.stderr, /reserved core feature/)
  }
})
