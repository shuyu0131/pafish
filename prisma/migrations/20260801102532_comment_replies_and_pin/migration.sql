-- DropIndex
DROP INDEX `ft_posts_search` ON `posts`;

-- AlterTable
ALTER TABLE `posts` ADD COLUMN `is_pinned` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `comments` ADD CONSTRAINT `comments_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `comments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
