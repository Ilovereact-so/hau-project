CREATE TABLE `payment_transactions` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`provider` enum('przelewy24','autopay') NOT NULL,
	`external_id` varchar(256),
	`session_id` varchar(256) NOT NULL,
	`status` enum('pending','success','failed','expired','refunded') NOT NULL DEFAULT 'pending',
	`amount_cents` int NOT NULL,
	`raw_response` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipments` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`furgonetka_id` varchar(128),
	`carrier` varchar(64) NOT NULL,
	`service` varchar(64) NOT NULL,
	`tracking_number` varchar(128),
	`label_url` varchar(512),
	`status` enum('created','picked_up','in_transit','out_for_delivery','delivered','failed','returned') NOT NULL DEFAULT 'created',
	`parcel_weight_g` int NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shipments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shipping_addresses` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`first_name` varchar(128) NOT NULL,
	`last_name` varchar(128) NOT NULL,
	`email` varchar(256) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`street` varchar(256) NOT NULL,
	`city` varchar(128) NOT NULL,
	`postal_code` varchar(16) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'PL',
	CONSTRAINT `shipping_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `discount_cents` int NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `variant_label` varchar(256) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `order_items` ADD `image_url` varchar(512) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `guest_email` varchar(256);--> statement-breakpoint
ALTER TABLE `orders` ADD `status` enum('pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_method` enum('przelewy24','autopay','cod') NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_method` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `subtotal_cents` int NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_cents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `notes` varchar(512);--> statement-breakpoint
ALTER TABLE `orders` ADD `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP;