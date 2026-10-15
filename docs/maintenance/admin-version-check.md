# Administrator version checks

The old sidebar reused a browser session's first-tag result for ten minutes even after the installed version changed. It treated every unequal version as an update, including an older cached release.

The sidebar now requests `/api/admin/version` without a browser response cache. This administrator-only endpoint reads GitHub's latest published stable release. It does not fall back to the first tag. A five-minute server cache and shared in-flight lookup limit GitHub requests; failed lookups expire after thirty seconds. Fetches time out after five seconds. Legacy browser session cache entries are discarded. Checks repeat on window focus and every five minutes while the sidebar is mounted.

Version precedence compares major/minor/patch numbers, prerelease identifiers and build metadata correctly. Only a strictly newer release receives the update notification. Equal versions are current; an older published release receives a neutral display and an ahead-of-release tooltip. Invalid/unavailable release values never produce an update notification. Links target the actual release.

Regression tests cover the reported `0.33.1` / `0.33.0` case, numeric ordering, prereleases, equal builds, invalid data, release selection, cache expiration, concurrent lookups and failed refreshes. All 92 automated tests, the full TypeScript check and the production build pass.
