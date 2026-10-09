CREATE TABLE `installs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`code` text NOT NULL,
	`write_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`start_before` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`started_at` integer,
	`status` text DEFAULT 'waiting' NOT NULL,
	`rank` integer DEFAULT 0 NOT NULL,
	`attention` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	`updates` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_installs_owner_code` ON `installs` (`owner`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_installs_write_hash` ON `installs` (`write_hash`);--> statement-breakpoint
CREATE INDEX `idx_installs_expires_at` ON `installs` (`expires_at`);