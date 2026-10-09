ALTER TABLE `installs` ADD `completed_steps` integer DEFAULT 0 NOT NULL CHECK (typeof(`completed_steps`) = 'integer' AND `completed_steps` BETWEEN 0 AND 15);
--> statement-breakpoint
UPDATE `installs` SET `completed_steps` = 8 WHERE `status` = 'services_ready';
