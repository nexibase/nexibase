-- Add nullable uuid first so we can backfill
ALTER TABLE `conversations` ADD COLUMN `uuid` VARCHAR(36) NULL;

-- Backfill existing rows with generated UUIDs
UPDATE `conversations` SET `uuid` = UUID() WHERE `uuid` IS NULL;

-- Enforce NOT NULL + unique
ALTER TABLE `conversations` MODIFY COLUMN `uuid` VARCHAR(36) NOT NULL;
ALTER TABLE `conversations` ADD UNIQUE INDEX `conversations_uuid_key` (`uuid`);
