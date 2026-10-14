# Single public FAQ page

The public FAQ is served at `/faqs`. Categories filter locally inside that page and do not change the URL. Former category URLs, including `/faq/{slug}` and `/faq-accordion/{slug}`, redirect to the collection page. The sitemap lists the collection rather than category pages.

The visible admin name and heading are `FAQ`. The admin heading area contains a public `/faqs` link labeled `FAQ`. A header menu entry labeled `FAQ` is created or reused on the authorized development site; existing unrelated menu entries are preserved. Categories remain editable, but no category-specific public link or URL slug input is exposed.

Opening a question adds one view per signed-in account or signed guest-browser identity, recorded in the `faq_views` database ledger. Its unique `(faqId, viewerKey)` constraint and a transaction protect repeated opens, reloads, new tabs, page/widget opens and simultaneous requests. Old per-question session cookies and sessionStorage receipts no longer decide whether a view counts. The page and widget share guest initialization with feedback; old API aliases enforce the same database rule. Existing totals are preserved; historical views without identity records cannot be attributed retroactively. Guest identity uses the same signed one-year cookie as feedback. Clearing that cookie or switching browsers creates a different anonymous identity.

## Validation

- Production build and 61 automated tests, including rendered admin labels/link and local category tabs.
- `npx tsx scripts/verify-faq-single-page.ts http://localhost:PORT` checks legacy redirects, the single collection page, sitemap, repeated view requests through all API aliases, and unchanged data.
- Append `crud` on an authorized development environment to validate temporary records and a first view and nine repeats that leave the count at one, then clean up those records.
- Append `menu` to require the public FAQ header link after deployment.
- `npx tsx scripts/ensure-public-faq-menu.ts https://dev.nexibase.com` idempotently applies the explicitly requested public FAQ menu through the authenticated admin API.

The branch is `fix/faq-single-page`, based on `747612c`. Environment, media, FAQ data, and schema are preserved. Backups, original service units, SQL snapshot, row fingerprints, and validation logs are stored in `/var/backups/nexibase-faq-single-20261015`.

Rollback restores the saved development service units and restarts them. The new FAQ header link remains valid on the previous release; its creation is recorded separately from the code release.

## 검증 기록

FAQ를 `/faqs` 한 페이지로 통합하고 분류는 페이지 안에서만 선택합니다. 기존 조회수는 유지하며 질문은 같은 브라우저 세션에서 처음 열 때만 1회 증가합니다. 반복 토글과 새로고침에는 추가로 증가하지 않습니다. 관리자 표시명과 사용자 링크는 FAQ로 통일합니다. 빌드, 자동 테스트 61개, 임시 데이터 포함 단일 페이지/조회 검증 53건, 기존 FAQ/코어 검증 79건이 통과했습니다.


## Feedback identity and duplicate protection

Feedback totals and individual evaluations are stored in MySQL. The additive `faq_feedback` table has a unique `(faqId, voterKey)` constraint. Creating an evaluation and incrementing its chosen total occur in one transaction; simultaneous requests, opposite choices and legacy API aliases cannot increment again. Existing totals are preserved; earlier evaluations did not store voter identities and cannot be retroactively attributed.

Signed-in users are identified by their account, independent of cookies or browser. Guests use a server-signed, HTTP-only browser ID cookie lasting one year. The cookie identifies the browser; the evaluation remains in the database. Clearing that cookie or using a different browser creates a different anonymous identity. `GET /api/faqs?type=feedback` reloads the evaluation state on refresh. Existing localStorage receipts are retained only for anonymous legacy evaluations.


## Durable view validation

`scripts/verify-faq-view-ledger.ts` creates temporary questions, preserves an existing baseline count, verifies same-account requests without browser cookies, signed-guest reloads, legacy aliases and concurrent first views, then removes its test records. Existing FAQ data and ledgers are checked before and after. View rows follow the existing anonymized-user retention policy.
