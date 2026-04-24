CREATE TABLE `delivery_services` (
	`id` varchar(36) NOT NULL,
	`service_code` varchar(64) NOT NULL,
	`map_service_code` varchar(64),
	`name` varchar(128) NOT NULL,
	`delivery_type` enum('kurier','paczkomat') NOT NULL DEFAULT 'kurier',
	`price_cents` int NOT NULL DEFAULT 0,
	`estimated_days` varchar(64),
	`is_active` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 99,
	`furgonetka_service_id` int,
	`synced_at` timestamp,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `delivery_services_id` PRIMARY KEY(`id`),
	CONSTRAINT `delivery_services_service_code_unique` UNIQUE(`service_code`)
);
--> statement-breakpoint
CREATE TABLE `saved_addresses` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`first_name` varchar(128) NOT NULL,
	`last_name` varchar(128) NOT NULL,
	`email` varchar(256) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`street` varchar(256) NOT NULL,
	`city` varchar(128) NOT NULL,
	`postal_code` varchar(16) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'PL',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_addresses_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
ALTER TABLE `shipping_addresses` MODIFY COLUMN `street` varchar(256);--> statement-breakpoint
ALTER TABLE `shipping_addresses` MODIFY COLUMN `city` varchar(128);--> statement-breakpoint
ALTER TABLE `shipping_addresses` MODIFY COLUMN `postal_code` varchar(16);--> statement-breakpoint
ALTER TABLE `shipping_addresses` ADD `pickup_point_code` varchar(128);--> statement-breakpoint
ALTER TABLE `shipping_addresses` ADD `pickup_point_name` varchar(256);