CREATE TABLE `cart_items` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(128) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_id` varchar(128),
	`qty` int NOT NULL DEFAULT 1,
	`added_at` timestamp DEFAULT (now()),
	CONSTRAINT `cart_items_id` PRIMARY KEY(`id`)
);
