CREATE TABLE `faq_views` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `faqId` INTEGER NOT NULL,
    `viewerKey` VARCHAR(64) NOT NULL,
    `userId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `faq_views_faqId_viewerKey_key` (`faqId`, `viewerKey`),
    INDEX `faq_views_userId_idx` (`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `faq_views` ADD CONSTRAINT `faq_views_faqId_fkey` FOREIGN KEY (`faqId`) REFERENCES `faqs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `faq_views` ADD CONSTRAINT `faq_views_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
