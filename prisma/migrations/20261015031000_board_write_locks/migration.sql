-- A dedicated member mutex avoids locking users referenced by notification
-- foreign keys while holding content/counter locks during comment creation.
CREATE TABLE `board_write_locks` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `authorId` INTEGER NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `board_write_locks_authorId_key` (`authorId`),
  CONSTRAINT `board_write_locks_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
