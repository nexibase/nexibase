// Private read-only DB/media snapshot and runtime preservation checks.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const [release, output, uploads, baseUrl, baseline] = process.argv.slice(2);
require(release + '/node_modules/@next/env').loadEnvConfig(release);
const { PrismaClient } = require(release + '/node_modules/@prisma/client');
const prisma = new PrismaClient();
const assert = (value, message) => { if (!value) throw new Error(message); };
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
async function request(route, status = 200, options = {}) {
  const response = await fetch(baseUrl + route, { ...options, redirect: 'manual', signal: AbortSignal.timeout(30000) });
  assert(response.status === status, `Runtime check failed: ${route} (${response.status})`);
  return response;
}
function mediaFiles(root, relative = '') {
  const records = {};
  for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const name = path.posix.join(relative, item.name);
    assert(!item.isSymbolicLink(), 'Unreviewed upload symlink');
    if (item.isDirectory()) Object.assign(records, mediaFiles(root, name));
    else records[name] = hash(fs.readFileSync(path.join(root, name)));
  }
  return records;
}
(async () => {
  const records = {
    boards: await prisma.board.findMany({ orderBy: { id: 'asc' } }),
    menus: await prisma.menu.findMany({ orderBy: { id: 'asc' } }),
    widgets: await prisma.pageWidget.findMany({ orderBy: { id: 'asc' } }),
    posts: await prisma.post.findMany({ orderBy: { id: 'asc' }, select: { id: true, boardId: true, authorId: true, title: true, content: true, isSecret: true } }),
    users: await prisma.user.findMany({ orderBy: { id: 'asc' }, select: { id: true, nickname: true, image: true, role: true, status: true } }),
    settings: await prisma.setting.findMany({ orderBy: { key: 'asc' } }),
  };
  assert(!records.settings.some(s => s.key.startsWith('consent_')), 'Removed consent settings returned');
  assert(records.boards.some(b => b.slug === 'showcase' && b.displayType === 'gallery'), 'Showcase gallery setting missing');
  assert(records.menus.some(m => m.url === '/boards/showcase' && m.isActive), 'Showcase navigation missing');
  assert(records.widgets.some(w => w.widgetKey === 'showcase-sites'), 'Showcase home widget missing');
  const yeok = records.posts.find(p => p.id === 22);
  assert(yeok && yeok.title.includes('최저가') && yeok.content.includes('yeok.si'), 'YEOK showcase content missing');
  const logo = records.users.find(u => u.id === 1)?.image;
  assert(logo === '/uploads/profiles/nexibase-admin-logo-20261023.webp', 'Administrator logo changed');
  assert(fs.statSync(path.join(uploads, logo.slice('/uploads/'.length))).isFile(), 'Administrator logo file missing');
  const snapshot = {
    database: new URL(process.env.DATABASE_URL).pathname.slice(1),
    dataDigest: hash(JSON.stringify(records)),
    media: mediaFiles(uploads),
    version: JSON.parse(fs.readFileSync(release + '/package.json')).version,
  };
  if (baseline && baseline !== '-') {
    const before = JSON.parse(fs.readFileSync(baseline));
    assert(before.database === snapshot.database && before.dataDigest === snapshot.dataDigest, 'Site data/settings changed; prepare again');
    for (const [name, digest] of Object.entries(before.media)) {
      assert(snapshot.media[name] === digest, 'Existing upload changed or missing: ' + name);
    }
  }
  if (baseUrl) {
    const { encode } = require(release + '/node_modules/next-auth/jwt');
    const admin = await prisma.user.findFirst({ where: { role: 'admin', status: 'active', deletedAt: null }, select: { id: true, email: true, nickname: true } });
    assert(admin, 'Active administrator missing');
    const token = await encode({ secret: process.env.NEXTAUTH_SECRET, maxAge: 60,
      token: { id: String(admin.id), sub: String(admin.id), email: admin.email, name: admin.nickname } });
    const version = await (await request('/api/admin/version', 200, { headers: { Cookie: 'next-auth.session-token=' + token } })).json();
    assert(version.currentVersion === snapshot.version, 'Runtime version mismatch');
    await request('/api/auth/providers');
    await request('/api/consent', 404, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    await request('/api/policies/cookie', 404);
    const home = await (await request('/', 200, { headers: { Cookie: 'nb_consent=denied' } })).text();
    assert(home.includes('showcase-sites-title'), 'Home showcase widget not rendered');
    // Header menus are fetched after hydration; the initial HTML contains no header links.
    // source_guard checks the mobile rendering branch; verify its actual public data here.
    const navigation = await (await request('/api/menus?position=header')).json();
    assert(navigation.menus.some(m => m.url === '/boards/showcase' && m.isActive &&
      m.visibility !== 'member' && m.visibility !== 'admin'), 'Public showcase header navigation missing');
    assert(home.includes('ga-init') && !home.includes('ga-consent-init') && !home.includes('쿠키 사용 동의'), 'Analytics/banner regression');
    const posts = await (await request('/api/showcase')).json();
    assert(posts.posts.some(p => p.id === 22 && p.excerpt.includes('최저가') && p.siteUrl === 'https://yeok.si/'), 'Public showcase regression');
    await request('/boards/showcase');
    await request('/boards/showcase/22');
    await request(logo);
  }
  fs.writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ checks: 'passed', version: snapshot.version, uploads: Object.keys(snapshot.media).length, runtime: !!baseUrl }));
})().catch(error => {
  // Never print raw Prisma errors, environment variables, settings or session credentials.
  console.error(error.name === 'PrismaClientInitializationError' ? 'Database initialization failed (private details suppressed)' : error.message);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
