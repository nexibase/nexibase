// Operator-only public UI checks. No login, posts, settings changes or seed writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const shortcut = 'header a[href="/boards/showcase"]:visible';
const logo = 'img[src*="/uploads/profiles/nexibase-admin-logo-20261023.webp"]';

async function loadedImage(page, selector, timeout) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
  await page.waitForFunction(selector => {
    const image = document.querySelector(selector);
    return image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  }, selector, { timeout });
}

async function checkHome(browser, url, directory, timeout = 20000) {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  try {
    const page = await desktop.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.locator('#showcase-sites-title').waitFor({ state: 'visible', timeout });
    await loadedImage(page, 'section[aria-labelledby="showcase-sites-title"] a[href="/boards/showcase/22"] img', timeout);
    await page.screenshot({ path: path.join(directory, 'home-desktop.png') });

    const phone = await mobile.newPage();
    await phone.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await phone.locator(shortcut).waitFor({ state: 'visible', timeout });
    const box = await phone.locator(shortcut).boundingBox();
    assert(box && box.y >= 0 && box.y < 80 && box.x + box.width <= 390, 'Mobile shortcut must be visible at the top without opening the menu');
    assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile horizontal overflow');
    const more = phone.getByRole('button', { name: /^(더보기|More)$/ });
    await more.click();
    assert.equal(await more.getAttribute('aria-expanded'), 'true', 'Mobile menu does not open');
    assert(await phone.locator(shortcut).count() >= 2, 'Expanded mobile menu lost showcase');
    await more.click();
    await phone.locator(shortcut).click();
    await phone.waitForURL(new URL('/boards/showcase', url).href, { timeout });
    await phone.getByRole('heading', { name: '쇼케이스', exact: true }).first().waitFor({ state: 'visible', timeout });
    await loadedImage(phone, 'a[href="/boards/showcase/22"] img', timeout);
    await phone.screenshot({ path: path.join(directory, 'home-mobile-gallery.png') });
    await phone.locator('a[href="/boards/showcase/22"]').first().click();
    await phone.waitForURL(new URL('/boards/showcase/22', url).href, { timeout });
    await phone.getByRole('heading', { name: /쇼핑은 역시.*최저가/ }).waitFor({ state: 'visible', timeout });
    await loadedImage(phone, logo, timeout);
    assert.equal(await phone.locator(logo).count(), 1, 'Administrator logo not uniquely rendered');
    await phone.screenshot({ path: path.join(directory, 'home-mobile-logo.png') });
    return { desktopWidget: true, mobileWidth: 390, mobileShortcut: true, mobileMenu: true,
      galleryNavigation: true, yeokThumbnail: true, administratorLogoDecoded: true };
  } finally { await desktop.close(); await mobile.close(); }
}

async function checkDemo(browser, url, directory, timeout = 20000) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    const more = page.getByRole('button', { name: /^(더보기|More)$/ });
    await more.waitFor({ state: 'visible', timeout });
    await more.click();
    await page.getByRole('link', { name: 'Gallery', exact: true }).first().waitFor({ state: 'visible', timeout });
    assert.equal(await page.locator('a[href*="/boards/showcase"]').count(), 0, 'Demo contains a showcase link, including expanded mobile menu');
    assert.equal(await page.locator('#showcase-sites-title').count(), 0, 'Demo contains the site-only showcase widget');
    await page.screenshot({ path: path.join(directory, 'demo-mobile-menu.png') });
    await more.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole('link', { name: 'Gallery', exact: true }).first().waitFor({ state: 'visible', timeout });
    assert.equal(await page.locator('a[href*="/boards/showcase"]').count(), 0, 'Demo desktop contains a showcase link');
    assert.equal(await page.locator('#showcase-sites-title').count(), 0, 'Demo desktop contains the site-only widget');
    await page.screenshot({ path: path.join(directory, 'demo-desktop.png') });
    return { mobileWidth: 390, mobileMenuLoaded: true, showcaseLinks: 0, showcaseWidget: false, desktopChecked: true };
  } finally { await context.close(); }
}

async function main() {
  const [site, url, directory] = process.argv.slice(2);
  assert(['home', 'demo'].includes(site) && url && directory, 'Usage: browser-check.cjs home|demo URL REPORT_DIRECTORY');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const browser = await chromium.launch({ headless: true });
  try {
    const details = await (site === 'home' ? checkHome : checkDemo)(browser, url, directory);
    const result = { site, checks: 'passed', details, checkedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(directory, 'browser.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(result));
  } finally { await browser.close(); }
}
if (require.main === module) main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
module.exports = { checkHome, checkDemo };
