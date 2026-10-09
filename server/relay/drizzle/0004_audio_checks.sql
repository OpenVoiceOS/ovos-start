ALTER TABLE `installs` ADD `audio_status` text DEFAULT 'pending' NOT NULL CHECK (`audio_status` IN ('pending','checking','passed','failed'));
--> statement-breakpoint
ALTER TABLE `installs` ADD `microphone_status` text DEFAULT 'pending' NOT NULL CHECK (`microphone_status` IN ('pending','checking','passed','failed'));
--> statement-breakpoint
UPDATE `installs` SET `audio_status` = 'passed', `microphone_status` = 'passed' WHERE `status` = 'voice_ready';
