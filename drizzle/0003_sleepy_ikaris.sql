CREATE TABLE `order_items` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_id` varchar(128) NOT NULL DEFAULT '',
	`qty` int NOT NULL,
	`price_cents` int NOT NULL,
	`name` varchar(256) NOT NULL,
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(128) NOT NULL,
	`total_cents` int NOT NULL,
	`discount_code` varchar(64),
	`discount_cents` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cart_items` MODIFY COLUMN `variant_id` varchar(128) NOT NULL DEFAULT '';