CREATE TABLE `conversations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user1Id` INT NOT NULL,
  `user2Id` INT NOT NULL,
  `lastMessageAt` DATETIME(3) NULL,
  `user1LastReadAt` DATETIME(3) NULL,
  `user2LastReadAt` DATETIME(3) NULL,
  `user1HiddenAt` DATETIME(3) NULL,
  `user2HiddenAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `conversations_user1Id_user2Id_key`(`user1Id`, `user2Id`),
  INDEX `conversations_user1Id_lastMessageAt_idx`(`user1Id`, `lastMessageAt`),
  INDEX `conversations_user2Id_lastMessageAt_idx`(`user2Id`, `lastMessageAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `messages` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `conversationId` INT NOT NULL,
  `senderId` INT NOT NULL,
  `content` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `messages_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
  INDEX `messages_senderId_idx`(`senderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `conversations`
  ADD CONSTRAINT `conversations_user1Id_fkey` FOREIGN KEY (`user1Id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `conversations_user2Id_fkey` FOREIGN KEY (`user2Id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `messages`
  ADD CONSTRAINT `messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `messages_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notification_preferences`
  ADD COLUMN `emailDirectMessage` BOOLEAN NOT NULL DEFAULT false;
