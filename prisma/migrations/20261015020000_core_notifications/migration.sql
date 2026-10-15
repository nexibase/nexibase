-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `eventId` VARCHAR(36) NULL;

-- AlterTable
ALTER TABLE `notification_preferences` ADD COLUMN `mobilePreferences` JSON NULL;

-- CreateTable
CREATE TABLE `notification_config` (
    `id` VARCHAR(20) NOT NULL,
    `settings` JSON NOT NULL,
    `secretsEncrypted` TEXT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_rules` (
    `eventType` VARCHAR(50) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `preferenceType` VARCHAR(50) NOT NULL,
    `owner` VARCHAR(50) NOT NULL DEFAULT 'core',
    `emailEnabled` BOOLEAN NOT NULL DEFAULT true,
    `smsEnabled` BOOLEAN NOT NULL DEFAULT false,
    `alimtalkEnabled` BOOLEAN NOT NULL DEFAULT false,
    `smsTemplate` TEXT NOT NULL,
    `alimtalkCode` VARCHAR(100) NOT NULL DEFAULT '',
    `alimtalkTemplate` TEXT NOT NULL,
    `alimtalkButtons` JSON NULL,
    `variableMapping` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`eventType`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_events` (
    `id` VARCHAR(36) NOT NULL,
    `dedupeKey` CHAR(64) NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `notification_events_dedupeKey_key`(`dedupeKey`),
    INDEX `notification_events_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_deliveries` (
    `id` VARCHAR(36) NOT NULL,
    `eventId` VARCHAR(36) NOT NULL,
    `channel` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `recipientMasked` VARCHAR(255) NOT NULL,
    `payloadEncrypted` LONGTEXT NULL,
    `providerId` VARCHAR(100) NULL,
    `providerCode` VARCHAR(50) NULL,
    `reason` VARCHAR(500) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lockedAt` DATETIME(3) NULL,
    `lockToken` VARCHAR(36) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `lastCheckedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notification_deliveries_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `notification_deliveries_status_lastCheckedAt_idx`(`status`, `lastCheckedAt`),
    INDEX `notification_deliveries_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `notification_deliveries_eventId_channel_key`(`eventId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `notifications_eventId_key` ON `notifications`(`eventId`);

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `notification_events`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_events` ADD CONSTRAINT `notification_events_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_deliveries` ADD CONSTRAINT `notification_deliveries_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `notification_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


-- In-app notification delivery is mandatory; preserve email preferences and read history.
UPDATE notification_preferences SET postComment = true, commentReply = true, mention = true, orderStatus = true;
