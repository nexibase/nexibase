-- CreateTable: widget_pages
CREATE TABLE `widget_pages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(200) NOT NULL,
    `slug` VARCHAR(200) NOT NULL,
    `layoutTemplate` VARCHAR(30) NOT NULL DEFAULT 'full-width',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `seoTitle` VARCHAR(200) NULL,
    `seoDescription` VARCHAR(500) NULL,
    `seoOgImage` VARCHAR(500) NULL,
    `seoOgTitle` VARCHAR(200) NULL,
    `seoOgDescription` VARCHAR(500) NULL,
    `seoCanonical` VARCHAR(500) NULL,
    `seoNoIndex` BOOLEAN NOT NULL DEFAULT false,
    `seoNoFollow` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `widget_pages_slug_key`(`slug`),
    INDEX `widget_pages_slug_idx`(`slug`),
    INDEX `widget_pages_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: page_widgets
CREATE TABLE `page_widgets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageId` INTEGER NOT NULL,
    `widgetKey` VARCHAR(50) NOT NULL,
    `widgetType` VARCHAR(20) NOT NULL DEFAULT 'registry',
    `zone` VARCHAR(20) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `settings` TEXT NULL,
    `colSpan` INTEGER NOT NULL DEFAULT 1,
    `rowSpan` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `page_widgets_pageId_zone_sortOrder_idx`(`pageId`, `zone`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `page_widgets` ADD CONSTRAINT `page_widgets_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `widget_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate data: create Home page and copy widgets
INSERT INTO `widget_pages` (`title`, `slug`, `layoutTemplate`, `isActive`, `sortOrder`, `updatedAt`)
VALUES ('Home', '', 'with-sidebar', true, 0, NOW());

INSERT INTO `page_widgets` (`pageId`, `widgetKey`, `widgetType`, `zone`, `title`, `settings`, `colSpan`, `rowSpan`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`)
SELECT
    (SELECT `id` FROM `widget_pages` WHERE `slug` = ''),
    `widgetKey`, 'registry', `zone`, `title`, `settings`, `colSpan`, `rowSpan`, `isActive`, `sortOrder`, `createdAt`, `updatedAt`
FROM `home_widgets`;

-- Drop old table
DROP TABLE `home_widgets`;
