> Superseded by [FAQ single page](faq-single-page.md). Public categories now filter within `/faqs`.

# Public FAQ category links

Each category has a public page at `/faqs/{slug}`. Existing names, IDs, and slugs are preserved; no schema or data migration is required. For example, a category whose slug is `general` is accessible at `/faqs/general`.

The FAQ category tabs are links. Selecting a category changes the URL, and reload/back/forward restore the selected category. The root `/faqs` page shows all published questions. A category page queries only its own published questions, including its structured FAQ data and metadata. Unknown slugs return 404; known empty categories show an empty state with navigation back to all FAQs.

Admin category rows display the real `/faqs/{slug}` link and open it in a new tab. The slug field explains the public URL format. Slugs are not automatically renamed. Legacy `/faq/{slug}` and `/faq-accordion/{slug}` redirects continue to work. Categories with published FAQs are included in the sitemap.

## Verification

- `npm test` includes rendered admin link and category tab checks, including an empty category and a category named `all`.
- `npx tsx scripts/verify-faq-category-links.ts http://localhost:PORT` validates all existing category paths, canonical metadata, legacy redirects, unknown slugs, scoped structured data, and existing row fingerprints.
- Append `crud` on an authorized development environment to test temporary categories and questions, cross-category isolation, unpublished questions, empty categories, and cleanup.

The branch is `feat/faq-category-links`, based on `f8122ce`. The existing development environment and media directory are preserved. Backups and validation logs are stored at `/var/backups/nexibase-faq-links-20261015`. Rollback restores the saved two development service units and restarts those services; SQL restoration is unnecessary.

## 검증 기록

카테고리별 공개 주소와 관리자 링크를 연결하고 기존 slug는 유지합니다. 빌드와 자동 테스트 61개, 임시 데이터 및 실제 데이터 기반 카테고리 요청 검증 21건, 기존 FAQ/코어 요청 검증 79건이 통과했습니다. 스키마 변경 및 추가 타입 오류는 없습니다.
