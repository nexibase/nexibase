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
independent of the host timezone. Posts and comments are counted separately from
the existing `posts` and `comments` tables by author and creation time. Replies
count as comments; edits do not count. Soft-deleted posts remain in the table and
are counted; permanently deleted comments are no longer counted. These limits
apply to all signed-in members, including administrators.

Run the normal plugin/schema scan and `prisma generate`. On an existing install,
start the direct-count application before applying migration
`20261015032000_direct_board_daily_limits`, which adds author/date indexes to the
existing content tables and removes the previous `board_daily_usage` and
`board_write_locks` tables. Existing content is unchanged. Earlier migrations
remain in the migration history for upgrade compatibility; no additional limit
tables remain in the final schema.

Creation holds a per-member MySQL advisory lock through the content transaction's
commit or rollback, checks the global count first and then the board count, and
creates the content. The lock uses server memory, with no table or persistent
counter records. A separate connection pool holds these locks so waiting requests
cannot exhaust Prisma's content connections. Failures release the lock; uncertain
connections are destroyed. Serializing writes per member prevents simultaneous
requests across boards from exceeding the global cap. A quota rejection returns HTTP 429 with code
`BOARD_DAILY_LIMIT_REACHED`, `scope` (`global` or `board`), `kind`, `limit`, and
`resetAt` (an absolute ISO timestamp). The existing writing UI displays the error.
