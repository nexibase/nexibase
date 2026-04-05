-- CreateTable
CREATE TABLE `auctions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sellerId` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `image` VARCHAR(500) NULL,
    `startingPrice` INTEGER NOT NULL,
    `currentPrice` INTEGER NOT NULL,
    `buyNowPrice` INTEGER NULL,
    `bidIncrement` INTEGER NOT NULL DEFAULT 1000,
    `bidCount` INTEGER NOT NULL DEFAULT 0,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `winnerId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `auctions_status_endsAt_idx`(`status`, `endsAt`),
    INDEX `auctions_sellerId_idx`(`sellerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bids` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `auctionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `amount` INTEGER NOT NULL,
    `isAutoBid` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `bids_auctionId_createdAt_idx`(`auctionId`, `createdAt`),
    INDEX `bids_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `auto_bids` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `auctionId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `maxAmount` INTEGER NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `auto_bids_auctionId_userId_key`(`auctionId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_sellerId_fkey` FOREIGN KEY (`sellerId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auctions` ADD CONSTRAINT `auctions_winnerId_fkey` FOREIGN KEY (`winnerId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bids` ADD CONSTRAINT `bids_auctionId_fkey` FOREIGN KEY (`auctionId`) REFERENCES `auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bids` ADD CONSTRAINT `bids_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auto_bids` ADD CONSTRAINT `auto_bids_auctionId_fkey` FOREIGN KEY (`auctionId`) REFERENCES `auctions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auto_bids` ADD CONSTRAINT `auto_bids_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
