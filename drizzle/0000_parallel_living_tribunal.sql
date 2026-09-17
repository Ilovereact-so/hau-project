CREATE TABLE `cart_items` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(128) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_id` varchar(128) NOT NULL DEFAULT '',
	`qty` int NOT NULL DEFAULT 1,
	`added_at` timestamp DEFAULT (now()),
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `email_templates` (
	`key` varchar(128) NOT NULL,
	`subject` varchar(256) NOT NULL,
	`html` text NOT NULL,
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` varchar(36) NOT NULL,
	`type` enum('products','subcategories') NOT NULL,
	`file_name` varchar(256) NOT NULL DEFAULT '',
	`total_rows` int NOT NULL DEFAULT 0,
	`ok_rows` int NOT NULL DEFAULT 0,
	`failed_rows` int NOT NULL DEFAULT 0,
	`status` enum('running','done','failed') NOT NULL DEFAULT 'running',
	`log_json` text,
	`created_by` varchar(128),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (
	`id` varchar(36) NOT NULL,
	`email` varchar(256) NOT NULL,
	`consent` boolean NOT NULL DEFAULT true,
	`consent_at` timestamp DEFAULT (now()),
	`is_active` boolean NOT NULL DEFAULT true,
	`unsub_token` varchar(64),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsletter_subscribers_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_subscribers_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_id` varchar(128) NOT NULL DEFAULT '',
	`qty` int NOT NULL,
	`price_cents` int NOT NULL,
	`name` varchar(256) NOT NULL,
	`brand` varchar(128) NOT NULL DEFAULT '',
	`variant_label` varchar(256) NOT NULL DEFAULT '',
	`image_url` varchar(512) NOT NULL DEFAULT '',
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`guest_email` varchar(256),
	`status` enum('pending','awaiting_payment','paid','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`payment_method` enum('przelewy24','autopay','cod') NOT NULL,
	`shipping_method` varchar(64) NOT NULL,
	`subtotal_cents` int NOT NULL,
	`shipping_cents` int NOT NULL DEFAULT 0,
	`discount_cents` int NOT NULL DEFAULT 0,
	`total_cents` int NOT NULL,
	`discount_code` varchar(64),
	`notes` varchar(512),
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`provider` enum('przelewy24','autopay') NOT NULL,
	`external_id` varchar(256),
	`session_id` varchar(256) NOT NULL,
	`status` enum('pending','success','failed','expired','refunded') NOT NULL DEFAULT 'pending',
	`amount_cents` int NOT NULL,
	`save_card_consent` boolean NOT NULL DEFAULT false,
	`card_token` varchar(256),
	`raw_response` text,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payment_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_reviews` (
	`id` varchar(36) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`author_name` varchar(64) NOT NULL,
	`rating` tinyint NOT NULL,
	`title` varchar(120),
	`body` text NOT NULL,
	`verified_purchase` boolean NOT NULL DEFAULT false,
	`status` enum('published','hidden') NOT NULL DEFAULT 'published',
	`admin_reply` text,
	`admin_reply_at` timestamp,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_reviews_user_product` UNIQUE(`user_id`,`product_id`)
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
	`apartment_number` varchar(64),
	`city` varchar(128) NOT NULL,
	`postal_code` varchar(16) NOT NULL,
	`country` varchar(2) NOT NULL DEFAULT 'PL',
	`updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_addresses_user_id_unique` UNIQUE(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `saved_cards` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`provider` enum('autopay') NOT NULL DEFAULT 'autopay',
	`token` varchar(256) NOT NULL,
	`masked_number` varchar(20),
	`expiry_month` int,
	`expiry_year` int,
	`card_brand` varchar(32),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `saved_cards_id` PRIMARY KEY(`id`)
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
	`street` varchar(256),
	`city` varchar(128),
	`apartment_number` varchar(64),
	`postal_code` varchar(16),
	`country` varchar(2) NOT NULL DEFAULT 'PL',
	`pickup_point_code` varchar(128),
	`pickup_point_name` varchar(256),
	CONSTRAINT `shipping_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wishlist_items` (
	`user_id` varchar(128) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`added_at` timestamp DEFAULT (now()),
	CONSTRAINT `wishlist_items_user_id_product_id_pk` PRIMARY KEY(`user_id`,`product_id`)
);
--> statement-breakpoint
CREATE INDEX `product_reviews_product_status` ON `product_reviews` (`product_id`,`status`,`created_at`);