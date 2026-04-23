-- CreateTable
CREATE TABLE `faq_categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `faq_categories_slug_key`(`slug`),
    INDEX `faq_categories_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `faqs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question` VARCHAR(500) NOT NULL,
    `answer` TEXT NOT NULL,
    `categoryId` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `views` INTEGER NOT NULL DEFAULT 0,
    `helpful` INTEGER NOT NULL DEFAULT 0,
    `notHelpful` INTEGER NOT NULL DEFAULT 0,
    `published` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `faqs_categoryId_idx`(`categoryId`),
    INDEX `faqs_views_idx`(`views`),
    INDEX `faqs_published_idx`(`published`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `faqs` ADD CONSTRAINT `faqs_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `faq_categories`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
