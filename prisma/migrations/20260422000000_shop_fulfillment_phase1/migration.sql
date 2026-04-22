-- CreateTable
CREATE TABLE `order_activities` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `orderId` INTEGER NOT NULL,
    `actorType` VARCHAR(20) NOT NULL,
    `actorId` INTEGER NULL,
    `action` VARCHAR(60) NOT NULL,
    `fromStatus` VARCHAR(20) NULL,
    `toStatus` VARCHAR(20) NULL,
    `payload` JSON NULL,
    `memo` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `order_activities_orderId_createdAt_idx`(`orderId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `orders`
    ADD COLUMN `originalOrderId` INTEGER NULL,
    ADD COLUMN `orderType` VARCHAR(30) NOT NULL DEFAULT 'normal',
    ADD COLUMN `paymentGateway` VARCHAR(20) NULL,
    ADD COLUMN `pgTransactionId` VARCHAR(200) NULL;

-- CreateIndex
CREATE INDEX `orders_originalOrderId_idx` ON `orders`(`originalOrderId`);
CREATE INDEX `orders_paymentGateway_idx` ON `orders`(`paymentGateway`);

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_originalOrderId_fkey`
    FOREIGN KEY (`originalOrderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_activities` ADD CONSTRAINT `order_activities_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing paid orders: all prior card payments went through Inicis
UPDATE `orders`
   SET `paymentGateway` = 'inicis'
 WHERE `paymentMethod` = 'card' AND `paymentGateway` IS NULL;

-- Backfill legacy manual-deposit orders. Historical paymentMethod value is 'bank'
-- in all shop versions of this codebase; no 'bank_transfer' rows ever existed.
UPDATE `orders`
   SET `paymentGateway` = 'bank_deposit'
 WHERE `paymentMethod` = 'bank' AND `paymentGateway` IS NULL;
