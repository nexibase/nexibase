# Single public FAQ page

The public FAQ is served at `/faqs`. Categories filter locally inside that page and do not change the URL. Former category URLs, including `/faq/{slug}` and `/faq-accordion/{slug}`, redirect to the collection page. The sitemap lists the collection rather than category pages.

The visible admin name and heading are `FAQ`. The admin heading area contains a public `/faqs` link labeled `FAQ`. A header menu entry labeled `FAQ` is created or reused on the authorized development site; existing unrelated menu entries are preserved. Categories remain editable, but no category-specific public link or URL slug input is exposed.

Opening a question no longer tracks views, on either the FAQ page or widget. Existing historical view counts remain visible and are not reset. Legacy `PATCH { type: 'view', id }` requests return the current count without updating the row, so cached older clients also cannot accumulate views. Feedback continues to work as before.

## Validation

- Production build and 61 automated tests, including rendered admin labels/link and local category tabs.
- `npx tsx scripts/verify-faq-single-page.ts http://localhost:PORT` checks legacy redirects, the single collection page, sitemap, repeated view requests through all API aliases, and unchanged data.
- Append `crud` on an authorized development environment to validate temporary records and ten repeated view requests without count changes, then clean up those records.
- Append `menu` to require the public FAQ header link after deployment.
- `npx tsx scripts/ensure-public-faq-menu.ts https://dev.nexibase.com` idempotently applies the explicitly requested public FAQ menu through the authenticated admin API.

The branch is `fix/faq-single-page`, based on `747612c`. Environment, media, FAQ data, and schema are preserved. Backups, original service units, SQL snapshot, row fingerprints, and validation logs are stored in `/var/backups/nexibase-faq-single-20261015`.

Rollback restores the saved development service units and restarts them. The new FAQ header link remains valid on the previous release; its creation is recorded separately from the code release.

## 검증 기록

FAQ를 `/faqs` 한 페이지로 통합하고 분류는 페이지 안에서만 선택합니다. 기존 조회수는 유지하며 질문을 열거나 이전 API를 반복 호출해도 증가하지 않습니다. 관리자 표시명과 사용자 링크는 FAQ로 통일합니다. 빌드, 자동 테스트 61개, 임시 데이터 포함 단일 페이지/조회 검증 53건, 기존 FAQ/코어 검증 79건이 통과했습니다.
