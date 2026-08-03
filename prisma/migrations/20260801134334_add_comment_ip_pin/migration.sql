-- AlterTable
ALTER TABLE `comments` ADD COLUMN `ip` VARCHAR(45) NULL,
    ADD COLUMN `is_pinned` BOOLEAN NOT NULL DEFAULT false;
