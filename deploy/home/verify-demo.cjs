// Read-only demo source/DB/public API exclusion checks. No reset or seed writes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function sourceGuard(release) {
  for (const name of ['src/app/api/showcase/route.ts', 'src/lib/showcase.ts', 'src/lib/showcase-preview.ts',
    'src/widgets/ShowcaseSites.tsx', 'src/widgets/ShowcaseSites.meta.ts', 'src/features/boards/components/ShowcaseCard.tsx']) {
    assert(!fs.existsSync(path.join(release, name)), 'Demo contains site-only source: ' + name);
  }
  assert(!fs.readFileSync(path.join(release, 'src/layouts/default/Header.tsx'), 'utf8').includes('mobileShowcaseMenu'), 'Demo contains site-only mobile shortcut');
  assert(!fs.readFileSync(path.join(release, 'src/lib/widgets/_generated-registry.ts'), 'utf8').includes('showcase-sites'), 'Demo registers the site-only widget');
}
async function main() {
  const [release, output, baseUrl] = process.argv.slice(2);
  sourceGuard(release);
  require(release + '/node_modules/@next/env').loadEnvConfig(release);
  const { PrismaClient } = require(release + '/node_modules/@prisma/client');
  const prisma = new PrismaClient();
  async function get(route, status = 200) {
    const response = await fetch(baseUrl + route, { redirect: 'manual', signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, status, 'Demo runtime check failed: ' + route);
    return response;
  }
  try {
    const counts = {
      boards: await prisma.board.count({ where: { slug: 'showcase' } }),
      widgets: await prisma.pageWidget.count({ where: { widgetKey: 'showcase-sites' } }),
      menus: await prisma.menu.count({ where: { url: { startsWith: '/boards/showcase' } } }),
    };
    assert(Object.values(counts).every(n => n === 0), 'Demo contains site-only board/widget/menu data');
    await get('/api/showcase', 404);
    // Unknown client-rendered board pages may return a 200 shell; inspect the API instead.
    await get('/api/boards/showcase', 404);
    assert(!(await (await get('/')).text()).includes('showcase-sites-title'), 'Demo renders site-only widget');
    const navigation = await (await get('/api/menus?position=header')).json();
    assert(!navigation.menus.some(m => m.url.startsWith('/boards/showcase')), 'Demo exposes showcase header menu');
    const result = { site: 'demo', checks: 'passed', siteOnlySourcesAbsent: true, counts,
      showcaseApiStatus: 404, showcaseBoardApiStatus: 404,
      version: JSON.parse(fs.readFileSync(release + '/package.json')).version };
    fs.writeFileSync(output, JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
  } finally { await prisma.$disconnect(); }
}
if (require.main === module) main().catch(error => { console.error(error.name.startsWith('Prisma') ? 'Demo database verification failed (private details suppressed)' : error.message); process.exitCode = 1; });
module.exports = { sourceGuard };
