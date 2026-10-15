ALTER TABLE `boards`
  ADD COLUMN `dailyPostLimit` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `dailyCommentLimit` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `board_daily_usage` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `boardId` INTEGER NOT NULL,
  `authorId` INTEGER NOT NULL,
  `day` DATE NOT NULL,
  `postCount` INTEGER NOT NULL DEFAULT 0,
  `commentCount` INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `board_daily_usage_boardId_authorId_day_key` (`boardId`, `authorId`, `day`),
  INDEX `board_daily_usage_authorId_day_idx` (`authorId`, `day`),
  INDEX `board_daily_usage_day_idx` (`day`),
  CONSTRAINT `board_daily_usage_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `boards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `board_daily_usage_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve today's existing usage at upgrade time, including deleted posts.
INSERT INTO `board_daily_usage` (`boardId`, `authorId`, `day`, `postCount`, `commentCount`)
SELECT `boardId`, `authorId`, DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)), SUM(`postCount`), SUM(`commentCount`)
FROM (
  SELECT `boardId`, `authorId`, COUNT(*) AS `postCount`, 0 AS `commentCount`
  FROM `posts`
  WHERE `createdAt` >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)), INTERVAL 9 HOUR)
    AND `createdAt` < DATE_ADD(DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)), INTERVAL 9 HOUR), INTERVAL 1 DAY)
  GROUP BY `boardId`, `authorId`
  UNION ALL
  SELECT p.`boardId`, c.`authorId`, 0 AS `postCount`, COUNT(*) AS `commentCount`
  FROM `comments` c JOIN `posts` p ON p.`id` = c.`postId`
  WHERE c.`createdAt` >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)), INTERVAL 9 HOUR)
    AND c.`createdAt` < DATE_ADD(DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 9 HOUR)), INTERVAL 9 HOUR), INTERVAL 1 DAY)
  GROUP BY p.`boardId`, c.`authorId`
) AS `existing_usage`
GROUP BY `boardId`, `authorId`;
