-- Automatyczne zdejmowanie stanu magazynu (lib/inventory.server.ts).
-- Uruchom RĘCZNIE na bazie PRZED wdrożeniem kodu (deploy nie robi migracji).
-- Ostatnia instrukcja oznacza istniejące zamówienia jako „legacy” — stan
-- zdejmujemy tylko dla zamówień opłaconych po wdrożeniu (i dla tych, które
-- w chwili migracji jeszcze czekają na płatność).
CREATE TABLE `stock_movements` (
	`id` varchar(36) NOT NULL,
	`order_id` varchar(36) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_key` varchar(128) NOT NULL DEFAULT '',
	`kind` enum('deduct','restore') NOT NULL,
	`requested_qty` int NOT NULL,
	`applied_qty` int NOT NULL,
	`target` varchar(16) NOT NULL,
	`stock_before` int,
	`stock_after` int,
	`reason` varchar(32) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (now(3)),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`),
	CONSTRAINT `stock_movements_line` UNIQUE(`order_id`,`product_id`,`variant_key`,`kind`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_state` enum('none','pending','deducted','restored','legacy') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `stock_note` varchar(512);--> statement-breakpoint
CREATE INDEX `stock_movements_product` ON `stock_movements` (`product_id`,`created_at`);--> statement-breakpoint
UPDATE `orders` SET `stock_state` = 'legacy' WHERE `status` NOT IN ('pending', 'awaiting_payment');
