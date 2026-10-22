CREATE TABLE `newsletter_campaign_recipients` (
	`campaign_id` varchar(36) NOT NULL,
	`subscriber_id` varchar(36) NOT NULL,
	`email` varchar(256) NOT NULL,
	`status` enum('pending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
	`attempts` tinyint NOT NULL DEFAULT 0,
	`error` varchar(300),
	`sent_at` datetime(3),
	CONSTRAINT `newsletter_campaign_recipients_campaign_id_subscriber_id_pk` PRIMARY KEY(`campaign_id`,`subscriber_id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_campaigns` (
	`id` varchar(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`subject` varchar(200) NOT NULL DEFAULT '',
	`preheader` varchar(200) NOT NULL DEFAULT '',
	`content` text NOT NULL,
	`status` enum('draft','scheduled','sending','paused','sent','cancelled') NOT NULL DEFAULT 'draft',
	`scheduled_at` datetime(3),
	`started_at` datetime(3),
	`finished_at` datetime(3),
	`total_count` int NOT NULL DEFAULT 0,
	`sent_count` int NOT NULL DEFAULT 0,
	`failed_count` int NOT NULL DEFAULT 0,
	`last_error` varchar(500),
	`created_by` varchar(128),
	`created_at` datetime(3) NOT NULL DEFAULT (now(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `newsletter_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `newsletter_recipients_queue` ON `newsletter_campaign_recipients` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `newsletter_recipients_sent_at` ON `newsletter_campaign_recipients` (`sent_at`);--> statement-breakpoint
CREATE INDEX `newsletter_campaigns_status` ON `newsletter_campaigns` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `newsletter_campaigns_created` ON `newsletter_campaigns` (`created_at`);