ALTER TABLE `installs` ADD `installed_at` integer;--> statement-breakpoint
ALTER TABLE `installs` ADD `phase` integer DEFAULT 0 NOT NULL;