-- CreateTable
CREATE TABLE `consent_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `consentId` VARCHAR(36) NOT NULL,
    `userId` INTEGER NULL,
    `analytics` BOOLEAN NOT NULL DEFAULT false,
    `marketing` BOOLEAN NOT NULL DEFAULT false,
    `policyVersion` VARCHAR(20) NULL,
    `bannerVersion` VARCHAR(20) NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `consent_logs_consentId_idx`(`consentId`),
    INDEX `consent_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 기존 설치는 배너를 꺼진 상태로 시작한다.
-- 업그레이드 즉시 GA가 말없이 끊기는 것을 막기 위함이며,
-- 운영자가 관리자 설정에서 직접 켜야 한다.
-- 신규 설치는 install wizard가 'true'로 넣으므로 이 INSERT가 실행되지 않는다.
INSERT INTO `settings` (`key`, `value`, `updatedAt`)
SELECT 'consent_enabled', 'false', NOW(3)
FROM DUAL
WHERE EXISTS (SELECT 1 FROM `settings` WHERE `key` = 'site_initialized')
  AND NOT EXISTS (SELECT 1 FROM `settings` WHERE `key` = 'consent_enabled');
