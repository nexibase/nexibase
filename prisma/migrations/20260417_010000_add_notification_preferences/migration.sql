-- CreateTable
CREATE TABLE `notification_preferences` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `postComment` BOOLEAN NOT NULL DEFAULT true,
    `commentReply` BOOLEAN NOT NULL DEFAULT true,
    `mention` BOOLEAN NOT NULL DEFAULT true,
    `orderStatus` BOOLEAN NOT NULL DEFAULT true,
    `emailPostComment` BOOLEAN NOT NULL DEFAULT false,
    `emailCommentReply` BOOLEAN NOT NULL DEFAULT false,
    `emailMention` BOOLEAN NOT NULL DEFAULT false,
    `emailAdminMessage` BOOLEAN NOT NULL DEFAULT true,
    `emailOrderStatus` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_preferences_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
