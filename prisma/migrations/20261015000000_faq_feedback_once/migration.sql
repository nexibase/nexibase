CREATE TABLE `faq_feedback` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `faqId` INTEGER NOT NULL,
    `voterKey` VARCHAR(64) NOT NULL,
    `userId` INTEGER NULL,
    `helpful` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `faq_feedback_faqId_voterKey_key` (`faqId`, `voterKey`),
    INDEX `faq_feedback_userId_idx` (`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `faq_feedback` ADD CONSTRAINT `faq_feedback_faqId_fkey` FOREIGN KEY (`faqId`) REFERENCES `faqs` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `faq_feedback` ADD CONSTRAINT `faq_feedback_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
