# Built-in FAQ module

The core module is named `faqs`, matching the plural names of `boards`, `contents`, and `policies`. The visible feature name remains FAQ.

- Canonical page: `/faqs`; administration: `/admin/faqs`; APIs: `/api/faqs` and `/api/admin/faqs`.
- `/faq` and `/faq-accordion`, including admin subpaths and locale-prefixed paths, redirect permanently to the canonical paths and preserve query parameters.
- The corresponding legacy API paths re-export the core handlers, preserving HTTP methods, JSON payloads, status codes, and authorization behavior. Singular payload types such as `type: 'faq'` are unchanged.
- Components and shared sanitization live in `src/features/faqs`; FAQ admin pages share a layout containing the core admin sidebar.
- `Faq` and `FaqCategory` remain mapped to the existing `faqs` and `faq_categories` tables in the core schema. The schema migration diff is empty.
- The FAQ widget is built in and keeps its existing `faq-widget` key and `faq-voted:*` browser keys.
- Translation messages are part of core locales under `faqs`. FAQ is absent from the plugin manifest and `.gitmodules`; existing plugin settings remain inert.
- Core and compatibility route names are reserved against optional plugin and widget-page collisions.

## Validation and deployment

`npm test` checks preservation of core pages and APIs across repeated scans, optional plugin preservation, schemas, widgets, translations, withdrawal policies, and reserved route collisions.

`npx tsx scripts/verify-core-faq.ts http://localhost:PORT` checks canonical pages, legacy redirects and APIs, authorization, sitemap URLs, plugin removal, and existing row fingerprints. Append `crud` to validate temporary category/FAQ creation, editing, ordering, view/feedback actions, draft visibility, protected deletion, and cleanup. Use write tests only on an authorized development environment.

Temporary test records are removed before deployment. The production release is copied without `.next/cache` so temporary random-widget results cannot enter the deployed cache.

The change is isolated on branch `refactor/core-faqs` based on `6817f6e`. SQL backup, generated schema, row fingerprints, service units, and validation logs are kept in `/var/backups/nexibase-core-faq-20261015`.

The development environment and existing upload directory are preserved. Rollback restores the two saved development service units and restarts them; no database restoration is required.

## 검증

2026-10-15: 기본 모듈 이름을 `faqs`로 통일하고 화면 표시명은 FAQ로 유지합니다. 기존 FAQ 테이블·위젯 키·API 입력 형식을 유지하며 단수 주소와 이전 플러그인 주소를 호환 경로로 제공합니다. 빌드와 자동 테스트 59개가 통과했고 스키마 변경 및 추가 타입 오류는 없습니다.
