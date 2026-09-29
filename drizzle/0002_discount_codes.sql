CREATE TABLE `discount_codes` (
	`id` varchar(36) NOT NULL,
	`code` varchar(64) NOT NULL,
	`description` varchar(255),
	`type` enum('percent','fixed','free_shipping') NOT NULL,
	`value` int NOT NULL DEFAULT 0,
	`min_subtotal_cents` int NOT NULL DEFAULT 0,
	`max_discount_cents` int,
	`starts_at` datetime,
	`ends_at` datetime,
	`usage_limit` int,
	`usage_limit_per_user` int,
	`times_used` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (now(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `discount_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_codes_code` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `discount_redemptions` (
	`id` varchar(36) NOT NULL,
	`discount_code_id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`customer_key` varchar(256) NOT NULL,
	`customer_email` varchar(256) NOT NULL,
	`code` varchar(64) NOT NULL,
	`discount_cents` int NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `discount_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_redemptions_order` UNIQUE(`order_id`)
);
--> statement-breakpoint
CREATE INDEX `discount_redemptions_code_customer` ON `discount_redemptions` (`discount_code_id`,`customer_key`);--> statement-breakpoint
CREATE INDEX `discount_redemptions_code_email` ON `discount_redemptions` (`discount_code_id`,`customer_email`);
--> statement-breakpoint
-- Kod obiecany w mailu powitalnym newslettera (lib/emailTemplates.ts).
INSERT INTO `discount_codes` (`id`, `code`, `description`, `type`, `value`, `usage_limit_per_user`, `is_active`)
VALUES ('7d1e6a52-4f0b-4c3e-9a51-6e3b0c1f0a10', 'NEWSLETTER10', 'Powitalny rabat dla zapisanych do newslettera', 'percent', 10, 1, true);
