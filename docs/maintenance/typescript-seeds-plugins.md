# Seed and plugin TypeScript maintenance

Seed means initial or test data, rather than a kind of plugin. Installation/menu seeds provide initial configuration; the removed auction sample seed generated test auctions and bids.

## Causes and changes

- Auction was removed from the core in `d2a5fcb`, but `prisma/seed-auction.ts` still referenced its absent models. Remove this obsolete destructive seed from the core. Its previous contents remain in Git history; auction sample data belongs with the optional auction plugin.
- `HomeWidget` was replaced by `WidgetPage` and `PageWidget` in the 20260416 migration. Menu seeding, plugin activation and the explicit installation-reset utility now use the current models. Home widgets belong to the page whose slug is empty.
- Widget initialization adds missing keys on the home page and preserves existing layouts/settings. Widgets on other pages do not suppress home widgets. Repeated calls are idempotent, and menu/widget writes share a transaction. Initial home widgets reuse the localized installation defaults; the removed auction menu and the old FAQ content URL are corrected for new seeds.
- Countdown/weather metadata now follows the other plugins' inferred metadata objects, without importing the nonexistent `@/types/plugin` module.
- The poll form exports its submitted data type, accepts optional/nullable initial emoji values and normalizes them to form strings. Create/update handlers share the submitted type.
- Shop stock restoration accepts nullable product references, matching retained order items after a product is removed. Existing null checks continue to skip removed products.
- `npm run typecheck` checks the whole project. The Next.js build no longer ignores TypeScript errors. No compiler exclusions or new error suppressions were added.

## Verification

- Full TypeScript check and production build with TypeScript validation pass.
- All 81 existing automated tests pass.
- `scripts/verify-home-widget-seeds.ts` exercises five cases in a separate empty database, including page scoping, duplicate prevention, preserved custom settings and rollback on a failed insert. It requires `TEST_DATABASE_URL` with a database name beginning with `nexibase_seed_verify_` and does not run against the dev application database.
- Seven authenticated/unauthenticated HTTP requests on an isolated production instance verify initial menu/widget creation, repeat seeding, plugin activation, preserved customization and administrator permissions.
- Installation reset retains its production and explicit-confirmation guards. Reset/sample-data commands are not executed against dev data.
