-- 2024-12-24 마이그레이션
-- 첨부파일, 썸네일 및 갤러리 표시 기능 추가
--
-- 실행 방법:
-- mysql -u [사용자] -p [DB명] < prisma/sql/2024-12-24_add_thumbnail_and_display_type.sql

-- =============================================
-- 1. post_attachments 테이블 생성 (없는 경우)
-- =============================================
CREATE TABLE IF NOT EXISTS `post_attachments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `postId` INT NOT NULL,
  `filename` VARCHAR(255) NOT NULL,
  `storedName` VARCHAR(255) NOT NULL,
  `filePath` VARCHAR(500) NOT NULL,
  `fileSize` INT NOT NULL,
  `mimeType` VARCHAR(100) NOT NULL,
  `downloadCount` INT NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `sortOrder` INT NOT NULL DEFAULT 0,
  `thumbnailPath` VARCHAR(500) NULL,
  PRIMARY KEY (`id`),
  INDEX `post_attachments_postId_idx` (`postId`),
  CONSTRAINT `post_attachments_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. boards 테이블에 displayType 컬럼 추가
-- =============================================
-- 이미 존재하면 에러가 나므로, 에러 무시하고 실행
-- MySQL 8.0.19+에서는 아래처럼 실행 가능
SET @sql = (
  SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'boards' AND COLUMN_NAME = 'displayType') = 0,
    'ALTER TABLE `boards` ADD COLUMN `displayType` VARCHAR(20) NOT NULL DEFAULT ''list'' AFTER `sortOrder`',
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
