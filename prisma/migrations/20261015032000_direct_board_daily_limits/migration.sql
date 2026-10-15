-- Daily limits now count existing posts/comments directly. Apply after the
-- application has switched to the direct-count implementation.
CREATE INDEX `posts_authorId_createdAt_idx` ON `posts` (`authorId`, `createdAt`);
CREATE INDEX `comments_authorId_createdAt_idx` ON `comments` (`authorId`, `createdAt`);
DROP TABLE `board_daily_usage`;
DROP TABLE `board_write_locks`;
