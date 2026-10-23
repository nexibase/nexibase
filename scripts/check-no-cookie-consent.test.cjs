const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { checkNoCookieConsent } = require('./check-no-cookie-consent.cjs');
const root = path.resolve(__dirname, '..');

test('the deployable source and generated schema contain no cookie consent feature', () => {
  assert.deepEqual(checkNoCookieConsent(root), []);
});

test('a later merge cannot restore the route, admin toggle, or schema unnoticed', () => {
  fs.mkdirSync(path.join(root, 'tmp'), { recursive: true });
  const fixture = fs.mkdtempSync(path.join(root, 'tmp', 'removed-feature-check-'));
  try {
    const files = {
      'src/app/api/consent/route.ts': 'export function POST() {}',
      'app/api/consent/route.js': 'export function POST() {}',
      'src/app/admin/settings.tsx': 'const settings = { consent_enabled: true }',
      'src/components/legacy-banner.jsx': 'export function ConsentBanner() {}',
      'src/lib/install/seed.ts': 'const settings = [{ key: "consent_banner_version", value: "1" }]',
      'prisma/schema.base.prisma': 'model ConsentLog {}',
    };
    for (const [relative, content] of Object.entries(files)) {
      const full = path.join(fixture, relative);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content);
    }
    assert.deepEqual(checkNoCookieConsent(fixture).sort(), Object.keys(files).sort());
  } finally {
    assert.equal(path.dirname(fixture), path.join(root, 'tmp'));
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});
