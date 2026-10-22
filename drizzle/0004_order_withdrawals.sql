CREATE TABLE `order_withdrawals` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36),
	`order_number` varchar(64) NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(256) NOT NULL,
	`items` text,
	`note` text,
	`user_id` varchar(128),
	`created_at` datetime(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `order_withdrawals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `order_withdrawals_order` ON `order_withdrawals` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_withdrawals_created` ON `order_withdrawals` (`created_at`);