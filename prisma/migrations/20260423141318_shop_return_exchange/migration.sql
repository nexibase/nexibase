-- CreateTable
CREATE TABLE `return_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `reason` VARCHAR(40) NOT NULL,
    `reasonDetail` TEXT NULL,
    `photos` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'requested',
    `rejectReason` TEXT NULL,
    `returnTrackingCompany` VARCHAR(50) NULL,
    `returnTrackingNumber` VARCHAR(50) NULL,
    `customerBearsShipping` BOOLEAN NOT NULL DEFAULT false,
    `refundAmount` INTEGER NULL,
    `refundedAt` DATETIME(3) NULL,
    `replacementOrderId` INTEGER NULL,
    `adminMemo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `return_requests_userId_idx`(`userId`),
    INDEX `return_requests_orderId_idx`(`orderId`),
    INDEX `return_requests_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `return_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `returnRequestId` INTEGER NOT NULL,
    `orderItemId` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unitPrice` INTEGER NOT NULL,

    UNIQUE INDEX `return_items_returnRequestId_orderItemId_key`(`returnRequestId`, `orderItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `return_requests` ADD CONSTRAINT `return_requests_replacementOrderId_fkey`
    FOREIGN KEY (`replacementOrderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_returnRequestId_fkey`
    FOREIGN KEY (`returnRequestId`) REFERENCES `return_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `return_items` ADD CONSTRAINT `return_items_orderItemId_fkey`
    FOREIGN KEY (`orderItemId`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed shop_settings (safe if rows exist)
INSERT INTO `shop_settings` (`key`, `value`, `updatedAt`) VALUES
    ('return_window_days', '7', NOW()),
    ('sms_notifications_enabled', 'false', NOW()),
    ('sms_provider_config', '{}', NOW())
ON DUPLICATE KEY UPDATE `key`=`key`;
