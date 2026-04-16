CREATE TABLE `wishlist_items` (
	`user_id` varchar(128) NOT NULL,
	`product_id` varchar(128) NOT NULL,
	`variant_id` varchar(128),
	`added_at` timestamp DEFAULT (now()),
	CONSTRAINT `wishlist_items_user_id_product_id_pk` PRIMARY KEY(`user_id`,`product_id`)
);
