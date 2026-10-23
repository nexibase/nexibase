const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { checkHome, checkDemo } = require('./browser-check.cjs');
const { sourceGuard } = require('./verify-demo.cjs');
const temporary = path.resolve(__dirname, '../../tmp/browser-check-tests');
fs.mkdirSync(temporary, { recursive: true });
const root = fs.mkdtempSync(path.join(temporary, 'run-'));
let server, browser, base, scenario;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2cAAAAASUVORK5CYII=', 'base64');
function html(url) {
  const demo = scenario.startsWith('demo');
  const extra = scenario === 'demo-hidden-menu-leak';
  const shortcut = scenario === 'home-missing-shortcut' ? '' : '<a class="shortcut" href="/boards/showcase">쇼케이스</a>';
  const head = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}header{height:56px;display:flex;align-items:center;gap:10px}img{width:40px;height:40px}button{height:44px}nav{display:none}@media(min-width:768px){.shortcut,button{display:none}nav{display:block!important}}</style>`;
  const menu = `<header>${demo ? '' : shortcut}<button aria-expanded="false" onclick="const n=this.nextElementSibling; const on=this.getAttribute('aria-expanded')==='true'; this.setAttribute('aria-expanded',String(!on)); n.style.display=on?'none':'block'">${demo ? 'More' : '더보기'}</button><nav>${demo ? '<a href="/boards/gallery">Gallery</a>' : '<a href="/boards/showcase">쇼케이스</a>'}${extra ? '<a href="/boards/showcase">Leaked showcase</a>' : ''}</nav></header>`;
  if (demo) return head + menu + '<h1>Demo</h1>' + (scenario === 'demo-widget-leak' ? '<h2 id="showcase-sites-title">Leaked widget</h2>' : '');
  const card = '<a href="/boards/showcase/22"><img src="/image.png" alt="YEOK screenshot">쇼핑은 역시</a>';
  if (url === '/boards/showcase/22') return head + menu + `<h1>쇼핑은 역시 (yeok.si) — 최저가 검색</h1><img src="/uploads/profiles/nexibase-admin-logo-20261023.webp" alt="">`;
  if (url === '/boards/showcase') return head + menu + '<h1>쇼케이스</h1>' + card;
  return head + menu + `<section aria-labelledby="showcase-sites-title"><h2 id="showcase-sites-title">넥시베이스로 만든 사이트</h2>${card}</section>`;
}
before(async () => {
  server = http.createServer((request, response) => {
    if (request.url === '/image.png' || request.url.startsWith('/uploads/profiles/')) {
      if (scenario === 'home-broken-logo' && request.url.startsWith('/uploads/profiles/')) { response.writeHead(404); return response.end(); }
      response.writeHead(200, { 'Content-Type': 'image/png' }); return response.end(png);
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html(request.url));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server.close(resolve)); fs.rmSync(root, { recursive: true }); });
function report(name) { const dir = path.join(root, name); fs.mkdirSync(dir); return dir; }
test('actual browser follows the mobile shortcut and decodes the administrator logo', async () => {
  scenario = 'home';
  const result = await checkHome(browser, base, report(scenario), 2000);
  assert.equal(result.administratorLogoDecoded, true);
  assert.equal(result.galleryNavigation, true);
});
test('a missing mobile shortcut is rejected although the desktop showcase still works', async () => {
  scenario = 'home-missing-shortcut';
  await assert.rejects(checkHome(browser, base, report(scenario), 1000));
});
test('HTTP 404/broken logo is rejected instead of accepting its fallback text', async () => {
  scenario = 'home-broken-logo';
  await assert.rejects(checkHome(browser, base, report(scenario), 1000));
});
test('demo with loaded desktop/mobile navigation and no showcase passes', async () => {
  scenario = 'demo';
  assert.equal((await checkDemo(browser, base, report(scenario), 2000)).showcaseLinks, 0);
});
test('a showcase entry hidden inside the demo mobile menu is rejected', async () => {
  scenario = 'demo-hidden-menu-leak';
  await assert.rejects(checkDemo(browser, base, report(scenario), 2000), /showcase link/);
});
test('a leaked demo home widget is rejected', async () => {
  scenario = 'demo-widget-leak';
  await assert.rejects(checkDemo(browser, base, report(scenario), 2000), /showcase widget/);
});
test('site-only source in a demo checkout is rejected before any DB access', () => {
  const fixture = path.join(root, 'source-fixture');
  fs.mkdirSync(path.join(fixture, 'src/app/api/showcase'), { recursive: true });
  fs.writeFileSync(path.join(fixture, 'src/app/api/showcase/route.ts'), 'leaked route');
  assert.throws(() => sourceGuard(fixture), /site-only source/);
});
