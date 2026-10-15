# Per-board daily posting limits

Each board has independent `dailyPostLimit` and `dailyCommentLimit` settings in
both the create and edit forms. Both default to **0 (unlimited)**. Limits apply
per member, per board, and reset at midnight in Korea (UTC+9). Administrators and
managers are exempt. Replies use the same comment allowance.

The shared `reserveBoardDailyWrite` helper must run inside the same Prisma
transaction as content creation. Core post and comment routes use it; extensions
that create board content should call it too. Editing does not consume another
slot, and deleting content does not refund a slot. A failed transaction rolls
back the reservation. At the limit the API returns HTTP 429 with
`code: BOARD_DAILY_LIMIT`, `resetAt`, and `Retry-After`.

The additive migration adds two board columns and `board_daily_usage`. The
counter keeps one rolling day per board/member rather than accumulating daily
history. A stable User row lock serializes simultaneous requests, including the
first request after midnight and requests handled by different server processes.
When a counter is initialized, existing posts and comments created that day are
included. Counters continue tracking unlimited boards so later limit changes
retain activity counted since deployment. Deleted content predating deployment
cannot be reconstructed. User withdrawal deletes usage rows.

Run `npm run db:migrate` before running the updated server and regenerate Prisma
when building. Existing boards remain unlimited until configured by an admin.
No existing content is modified by the migration.

Validation includes settings parsing, midnight boundaries, existing activity,
separate boards and action types, zero limits, role exemptions, and integration
checks against MariaDB for concurrent requests and transaction rollback.
