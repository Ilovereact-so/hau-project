CREATE TABLE `product_price_history` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_key` varchar(64) NOT NULL DEFAULT '',
	`price_cents` int NOT NULL,
	`valid_from` datetime(3) NOT NULL,
	`valid_to` datetime(3),
	`source` enum('init','admin','import','webhook','cron','observed') NOT NULL,
	`open_marker` tinyint GENERATED ALWAYS AS ((if(`valid_to` is null, 1, null))) STORED,
	`created_at` datetime(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `product_price_history_id` PRIMARY KEY(`id`),
	CONSTRAINT `price_history_one_open` UNIQUE(`product_id`,`variant_key`,`open_marker`)
);
--> statement-breakpoint
CREATE INDEX `price_history_lookup` ON `product_price_history` (`product_id`,`variant_key`,`valid_from`);