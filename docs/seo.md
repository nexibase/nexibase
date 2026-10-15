# Search appearance and NexiBase product discovery

The CMS generates metadata on the server using the configured site URL, or the
current request's public origin when that setting is empty. There is no hardcoded
production domain in board or content canonical URLs. Set **Settings → Site URL**
to the installation's preferred public origin before its production launch.

**Settings → Search appearance profile** controls product branding:

- **Automatic** enables NexiBase product copy when the active homepage contains a
  `nexibase-landing-hero`, `nexibase-home-hero`, or `nexibase-hero` widget.
- **NexiBase** enables a visible Next.js / JavaScript forum, e-commerce and CMS
  introduction and matching `SoftwareApplication` structured data. The software
  license is free; paid services and goods sold through a shop are separate.
- **General site** keeps the site's own branding and content. It does not insert
  a NexiBase product description or software schema.

Homepage editor SEO titles, descriptions, canonical URLs and indexing controls
take priority over defaults. General site content is never replaced with product
marketing copy. Social cards are served at `/opengraph-image`.

Public board directories, board lists, post bodies, comments and content pages
are included in the initial server HTML. Member-only and secret post contents
are excluded from public metadata, structured data and hydration props. Deleted,
inactive, mismatched or invalid content paths return 404. Server rendering does
not increment post view counts; the existing browser API keeps that behavior.

`/sitemap.xml` uses real modification timestamps and includes active public
boards/posts, public contents/policies and indexable widget pages. It omits
secret/member-only/inactive/deleted content, search pages and pages with an
external canonical target. A single sitemap is capped at 50,000 URLs, with up to
40,000 recently updated posts; very large installations should add sitemap
pagination before exceeding those bounds.

`/robots.txt` is bundled by default as the Next.js metadata route
`src/app/robots.ts`, including in the Docker build. No file creation, domain
replacement or admin switch is required after installation. It resolves the
configured site URL or the request's public origin on each request; do not add a
second `public/robots.txt` to the same application.

It references the same installation's sitemap and excludes account,
admin, API, search and commerce transaction paths. Those application paths also
send `X-Robots-Tag: noindex, nofollow`. Robots rules are indexing controls, not
access control; application authorization remains in effect.

## Applying the code to nexibase.com

The existing marketing homepage's landing hero automatically selects the product
profile. Its configured `https://nexibase.com` URL supplies canonical, social and
sitemap origins. Apply normal CMS migrations for the version being deployed;
this SEO change itself adds no tables or columns.

The current Apache vhost excludes top-level `.txt` files from its proxy. When
deploying this code there, ensure `/robots.txt` reaches Next.js (as `/sitemap.xml`
already does). For example, change that exclusion's negative lookahead from
`(?!sitemap\.xml$)` to `(?!sitemap\.xml$|robots\.txt$)`, then validate the Apache
configuration before reloading. Do not leave a stale static robots file masking
the dynamic route. Confirm both endpoints over the public HTTPS domain.

For the legacy main installation, a compatibility file was placed in Apache's
document root at `/home/kagla/_nexibase.com/public/robots.txt` on 2026-10-16.
Both its robots file and sitemap return HTTP 200. Remove that compatibility file
when switching this vhost to the bundled dynamic route above.

Submit the production sitemap in the site's existing Google Search Console and
Naver Search Advisor properties after deployment. Verification tags configured
in the admin settings are preserved. Structured data describes real visible
features; no ratings or reviews are fabricated.

Reference: [Google SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).
