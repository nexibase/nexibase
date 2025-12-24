-- 2024-12-24 마이그레이션
-- 첨부파일, 썸네일 및 갤러리 표시 기능 추가

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
-- 2. 기존 post_attachments 테이블에 thumbnailPath 컬럼 추가 (있는 경우)
-- =============================================
-- 테이블이 이미 존재하고 thumbnailPath 컬럼이 없으면 추가
-- 에러 무시하려면 아래 명령을 별도로 실행
-- ALTER TABLE `post_attachments` ADD COLUMN `thumbnailPath` VARCHAR(500) NULL AFTER `sortOrder`;

-- =============================================
-- 3. boards 테이블에 displayType 컬럼 추가
-- =============================================
-- displayType 컬럼이 없으면 추가 (list 또는 gallery)
ALTER TABLE `boards`
ADD COLUMN IF NOT EXISTS `displayType` VARCHAR(20) NOT NULL DEFAULT 'list' AFTER `sortOrder`;
