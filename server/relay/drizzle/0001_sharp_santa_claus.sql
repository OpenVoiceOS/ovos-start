ALTER TABLE `installs` ADD `launch_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_installs_launch_hash` ON `installs` (`launch_hash`);