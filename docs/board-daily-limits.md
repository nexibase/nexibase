# Daily board writing limits

Administrators can set `board_daily_post_limit` and `board_daily_comment_limit`
in **Settings → Board defaults**. These cap each member's combined activity
across all boards. The server checks this cap first.

Each board's create/edit form also has `dailyPostLimit` and `dailyCommentLimit`.
After the global check passes, the server applies this board's cap. Neither cap
overrides the other. Each value is a nonnegative integer: **0 disables only that
cap**, and 1 or more sets its maximum. Omitted global settings and existing/new
boards default to 0, preserving existing behavior until configured.

For example, global posts = 5 and board A posts = 2 lets a member write at most
2 posts on A, and at most 5 total across all boards. Setting A to 0 still leaves
the global total capped at 5.

The day runs from 00:00 inclusive to the next 00:00 exclusive in **Asia/Seoul**,
independent of the host timezone. Posts and comments have separate counters.
Replies count as comments; edits do not consume quota. Deleted content does not
refund quota. The limits apply to all signed-in members, including administrators.

Run the normal plugin/schema scan and `prisma generate`, then apply migration
`20261015030000_board_daily_limits` and `20261015031000_board_write_locks`
before starting the updated application.
It adds two board columns and a `board_daily_usage` ledger and backfills today's
existing posts and comments, including soft-deleted posts. Previously hard-deleted
comments cannot be reconstructed. Content is otherwise unchanged.

Creation locks a dedicated member mutex row, checks both caps, records usage, and creates the
content in one transaction. Failures roll back the consumed slot. Serializing
writes for each member prevents simultaneous requests across boards from exceeding
the global cap. A quota rejection returns HTTP 429 with code
`BOARD_DAILY_LIMIT_REACHED`, `scope` (`global` or `board`), `kind`, `limit`, and
`resetAt` (an absolute ISO timestamp). The existing writing UI displays the error.
