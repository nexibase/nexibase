# Core publishing migration

Boards, content pages, and versioned policies are core features. Optional modules remain in `src/plugins`.

- User/admin routes and APIs are tracked directly in `src/app`; existing URLs are unchanged.
- Publishing components live in `src/features`; board widgets live in `src/widgets` and keep the `latest-posts`, `board-cards`, and `popular-boards` keys.
- Publishing models and User relations live in `prisma/schema.base.prisma`. Existing table names, columns, indexes, and relations are unchanged. A before/after Prisma migration diff must be empty; do not push or reset the database for this change.
- Translations remain in the same namespaces and are merged from core locale files.
- Post, Comment, and Reaction retention declarations live in the core withdrawal policy.
- The publishing slugs remain reserved for core pages and cannot be reused by optional plugins or widget pages.
- Existing `plugin_boards_*`, `plugin_contents_*`, and `plugin_policies_*` settings are preserved as inert historical settings. Publishing availability no longer depends on them.

## Validation

`npm test` includes repeated plugin scanning, core route preservation, optional plugin preservation, widget/translation/retention checks, and core slug collision checks.

`npx tsx scripts/verify-core-features.ts http://localhost:PORT` checks the running service, authenticated administration, unauthenticated restrictions, existing URLs and data, versioned policy reads, core menu classification, and plugin removal.

Append `crud` to also create uniquely named temporary records, verify board/post/comment/reaction and content operations plus policy version activation, then remove only the records created by the verification. This mode must be used against an authorized development environment. It compares all original publishing, user, menu, widget, and setting rows before and after the run.

## Development deployment

The migration branch is `refactor/core-board-content-policies`. Commit `7e3e49c` preserves the pre-existing development performance baseline separately from this migration, including the corresponding local shop widget baseline.

The development release preserves the prior environment and media paths. No SQL schema migration is applied. Before switching, preserve the `nexibase-dev-public.service` and `nexibase-dev-source.service` units, generated schema, SQL backup, and row fingerprints in `/var/backups/nexibase-core-20261015`.

Rollback consists of restoring the two saved service units, reloading systemd, and restarting those development services. The database does not need restoration because existing rows and schema are unchanged.

## 검증 기록

2026-10-15 개발 서버 전환: 기존 URL·DB 테이블·위젯 키를 유지하고 게시판·콘텐츠·약관을 기본 기능으로 이동했습니다. 자동 테스트 59개와 임시 실행 환경의 HTTP/API 검증 65건이 통과했습니다. DB 스키마 비교는 변경 없음이며 기존 행의 지문은 검증 전후 동일했습니다. 타입 검사는 전환 전부터 있던 오류와 동일하고 추가 오류는 없습니다.
