-- AlterTable
ALTER TABLE `posts`
    ADD COLUMN `category_pinned` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `custom_fields` TEXT NULL,
    ADD COLUMN `external_url` VARCHAR(500) NULL,
    ADD COLUMN `favorite_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `like_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `password` VARCHAR(100) NULL;
