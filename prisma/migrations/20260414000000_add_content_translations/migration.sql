-- CreateTable
CREATE TABLE `menu_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `menuId` INTEGER NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `menu_translations_menuId_idx`(`menuId`),
    UNIQUE INDEX `menu_translations_menuId_locale_key`(`menuId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `home_widget_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `widgetId` INTEGER NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `home_widget_translations_widgetId_idx`(`widgetId`),
    UNIQUE INDEX `home_widget_translations_widgetId_locale_key`(`widgetId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `setting_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `value` TEXT NOT NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `setting_translations_key_idx`(`key`),
    UNIQUE INDEX `setting_translations_key_locale_key`(`key`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `board_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `boardId` INTEGER NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `board_translations_boardId_idx`(`boardId`),
    UNIQUE INDEX `board_translations_boardId_locale_key`(`boardId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `contentId` INTEGER NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `content_translations_contentId_idx`(`contentId`),
    UNIQUE INDEX `content_translations_contentId_locale_key`(`contentId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `policy_translations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `policyId` INTEGER NOT NULL,
    `locale` VARCHAR(10) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `source` VARCHAR(10) NOT NULL DEFAULT 'auto',
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `policy_translations_policyId_idx`(`policyId`),
    UNIQUE INDEX `policy_translations_policyId_locale_key`(`policyId`, `locale`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `menu_translations` ADD CONSTRAINT `menu_translations_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `menus`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `home_widget_translations` ADD CONSTRAINT `home_widget_translations_widgetId_fkey` FOREIGN KEY (`widgetId`) REFERENCES `home_widgets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `setting_translations` ADD CONSTRAINT `setting_translations_key_fkey` FOREIGN KEY (`key`) REFERENCES `settings`(`key`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `board_translations` ADD CONSTRAINT `board_translations_boardId_fkey` FOREIGN KEY (`boardId`) REFERENCES `boards`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_translations` ADD CONSTRAINT `content_translations_contentId_fkey` FOREIGN KEY (`contentId`) REFERENCES `contents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `policy_translations` ADD CONSTRAINT `policy_translations_policyId_fkey` FOREIGN KEY (`policyId`) REFERENCES `policies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
