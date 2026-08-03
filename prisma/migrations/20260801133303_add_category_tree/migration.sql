-- AlterTable
ALTER TABLE `categories` ADD COLUMN `parent_id` BIGINT UNSIGNED NULL,
    ADD COLUMN `sort_order` INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX `categories_parent_id_sort_order_idx` ON `categories`(`parent_id`, `sort_order`);

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
