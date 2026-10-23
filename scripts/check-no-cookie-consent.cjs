const fs = require('node:fs');
const path = require('node:path');

const retiredDirectories = ['src/components/consent/', 'src/lib/consent/', 'src/app/api/consent/', 'app/api/consent/'];
const retiredTokens = /\b(?:ConsentBanner|ConsentToast|ConsentProvider|ConsentPreferences|ConsentSettingsLink|GatedAnalytics|UngatedAnalytics|readConsentContext|decideAnalyticsMode|ConsentLog|consent_enabled|consent_banner_version|consent_policy_slug|consentEnabled|nb_consent)\b|["']consent["']\s*:|\/api\/consent\b/;

function checkNoCookieConsent(root) {
  const failures = [];
  function inspect(relative) {
    const full = path.join(root, relative);
    if (!fs.existsSync(full)) return;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(full)) inspect(`${relative}/${name}`);
      return;
    }
    if (/\.test\.[cm]?[jt]sx?$/.test(relative)) return;
    if (!/\.(?:[cm]?[jt]sx?|json|prisma)$/.test(relative)) return;
    if (retiredDirectories.some(directory => relative.startsWith(directory)) || retiredTokens.test(fs.readFileSync(full, 'utf8'))) {
      failures.push(relative);
    }
  }
  inspect('src');
  inspect('app');
  inspect('prisma/schema.base.prisma');
  inspect('prisma/schema.prisma');
  return failures;
}

if (require.main === module) {
  const failures = checkNoCookieConsent(path.resolve(__dirname, '..'));
  if (failures.length) {
    console.error('Removed cookie consent feature was reintroduced:\n' + failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Removed cookie consent feature: absent');
}

module.exports = { checkNoCookieConsent };
