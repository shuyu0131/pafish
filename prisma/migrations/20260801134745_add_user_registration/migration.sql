-- AlterTable
ALTER TABLE `users` ADD COLUMN `disabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `reset_token` VARCHAR(64) NULL,
    ADD COLUMN `reset_token_expires` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `users_reset_token_idx` ON `users`(`reset_token`);
