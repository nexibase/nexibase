ALTER TABLE `boards`
    ADD COLUMN `dailyPostLimit` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `dailyCommentLimit` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `board_daily_usage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boardId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `day` VARCHAR(10) NOT NULL,
    `postCount` INTEGER NOT NULL DEFAULT 0,
    `commentCount` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `board_daily_usage_boardId_userId_key` (`boardId`, `userId`),
    INDEX `board_daily_usage_userId_idx` (`userId`),
    PRIMARY KEY (`id`),
    CONSTRAINT `board_daily_usage_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `boards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `board_daily_usage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
