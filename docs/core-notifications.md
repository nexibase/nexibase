# Core notifications

## Policy

- In-app notifications are mandatory for supported events. Existing IDs, URLs, read states and history remain intact.
- Historical notifications are not backfilled into the outbox; old messages are never resent during migration.
- External delivery is for members only. There is no guest delivery path.
- Global channel settings, event rules and the recipient's preferences must all allow a normal external delivery.
- Email is independent. If both Alimtalk and SMS are allowed, Alimtalk runs first and SMS is released only after a confirmed terminal failure. A timeout, interrupted worker or unknown result never releases SMS.
- Delivery history is retained without automatic deletion. Withdrawal deletes the recipient's event/outbox records and encrypted contact snapshots via the core withdrawal policy.
- Authentication mail is independent of notification email preferences, but uses the shared SMTP configuration and development safety gate. Verification links/tokens are not stored in delivery logs. Existing verification token generation is unchanged.
- The legacy admin DM email override no longer bypasses recipient preferences. Its API input remains accepted for compatibility; the misleading checkbox is removed.

## Configuration and installation

1. Back up the database and existing environment configuration.
2. Provision `NOTIFICATION_ENCRYPTION_KEY` as 32 random bytes encoded in 64 hexadecimal characters. Store it only in server environment configuration, protect the file and back up the key securely. Changing or losing it prevents decryption of existing credentials and delivery snapshots.
3. On dev set `NOTIFICATION_ENVIRONMENT=development` for both the web process and worker, including optimized builds that use `NODE_ENV=production`. Development URLs and Next development mode also enforce the recipient allowlist.
4. Run `npm ci`, `node scripts/scan-plugins.js`, `npx prisma generate` and `npx prisma migrate deploy`.
5. When upgrading an existing Shop installation, run `npx tsx src/plugins/shop/scripts/migrate-notifications.ts` **before** initializing/opening the new admin settings. It imports the legacy `email_notification_enabled` value for existing order email events without overwriting configured rules. Cancel/refund-request mail is initially disabled because it was previously in-app only. The old Shop toggle is replaced by a link to core settings.
6. Run `npm run notifications:setup`. This initializes the core configuration while preserving existing SMTP environment values and configured rules. Newly paid channels are disabled.
7. Build and start the web app and a separate persistent `npm run notifications:worker` service. A service template is provided in `deploy/systemd/nexibase-notification-worker.service`. Adjust installation/Node paths for the target host.

Admin pages: `/admin/notifications/settings`, `/admin/notifications`.
Member preferences: `/mypage/settings/notifications`; existing notification APIs and `/mypage/notifications` remain available.

SMTP credentials and Aligo API/profile keys are AES-256-GCM encrypted in a dedicated table. Admin APIs only return configured flags for secrets. Empty secret inputs preserve the saved values. Normal site-setting APIs cannot read the dedicated notification configuration.

## Development safety and testing

Dev defaults to actual external delivery disabled. Email is simulated. SMS sends `testmode_yn=Y`; Alimtalk sends `testMode=Y`. Without required Aligo credentials, those jobs are skipped with the missing configuration recorded. Provider test acceptance does not prove handset delivery.

To test real delivery on dev, explicitly enable actual external delivery and register the exact test email/phone in the allowlist. Select a member whose registered contact matches it. A normal queued test job remains a test even if live mode is subsequently enabled. Actual test requests also check live mode and the allowlist before enqueueing. There is no unrestricted guest/manual recipient field.

Alimtalk requires an authenticated Kakao profile and an approved template. Use the admin approval lookup to import approved content. Preserve line breaks. Map provider variable names to event variables using JSON, for example `{"고객명":"name","주문번호":"orderNo"}`. Basic variables: `title`, `message`, `link`, `name`, `eventType`. Shop adds `orderNo`, `status`, `totalAmount`, `trackingNumber`, `customerName`.

Aligo provider-side fallback is explicitly disabled (`failover=N`); only the core worker may release SMS. If history unexpectedly reports an Aligo fallback message ID, the app stops automatic fallback and marks the outcome for review.

## Delivery and recovery

Events, mandatory notifications and channel jobs share a DB transaction. Comment/DM writes and the integrated order/payment transitions also enqueue inside their business transactions. Callers supply stable event keys; event+recipient deduplication and an event/channel unique constraint prevent duplicate jobs.

The worker claims a job with a conditional update and lock token. Confirmed pre-acceptance transient failures retry with backoff, at most three attempts. A claim interrupted for five minutes becomes `unknown`; it is never automatically resent. Before each send, the worker rechecks the current channel/rule, member preferences, active status and contact snapshot. A changed contact causes the old queued send to be skipped.

- `pending`: ready to send; `waiting`: SMS waits for an Alimtalk failure.
- `processing`: exclusively claimed by a worker.
- `accepted`: SMTP/Aligo accepted the request; final delivery is not established.
- `delivered`: an explicit final provider result confirms delivery. SMTP acceptance stays `accepted` because there is no inbox receipt integration.
- `failed`: confirmed rejection/failure, including exhausted proven pre-acceptance retries.
- `unknown`: possible acceptance, unsupported final result, unexpected provider fallback or worker interruption; inspect Aligo history before any manual action.
- `tested`: simulated SMTP or provider test-mode acceptance; never a delivery receipt.
- `skipped`: disabled channel, user preference, missing/changed contact or missing configuration.

Final Aligo results are polled separately and matched to the recipient. Kakao `status=3` describes a recognizable phone format and is never treated as successful delivery. Unknown result codes are not guessed as successes or failures.

## Plugin API

Plugins declare their events in `notification-events.json` using names prefixed by their folder, e.g. `shop.order_status`. The scanner exposes metadata without importing plugin implementation into core. Definitions can reuse the known preference types (`post_comment`, `comment_reply`, `mention`, `direct_message`, `order_status`). Disabled/uninstalled plugins cannot send queued external notifications.

Use `emitNotification({userId,type,eventKey,title,message,link,definition,variables,email}, transaction?)` from `@/lib/notifications/service`. An event key identifies one source action, not its current title or a random time. Optional `email` supplies escaped subject/HTML from plugin-owned renderers. Never call a provider directly or fire-and-forget an event write.

## Verification

`npm test` covers policy, encryption, provider contracts and preservation through scans, including scanning without Shop.
`npm run typecheck` and `npm run build` validate the full application.
`npx tsx scripts/verify-notifications.ts [BASE_URL]` runs development-only DB/worker fixtures and optionally authenticated admin/member API checks. It requires actual sending and paid channels to be disabled, injects fake transports for paid outcomes, exercises a separate worker process for simulated email, and removes its temporary members/events/rule afterward. It never calls a live paid transport.

Official API references:
- https://smartsms.aligo.in/admin/api/spec.html
- https://smartsms.aligo.in/alimapi.html
