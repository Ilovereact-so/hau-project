ALTER TABLE `newsletter_subscribers` ADD `confirm_token` varchar(64);--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `confirm_sent_at` datetime;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `confirmed_at` datetime;--> statement-breakpoint
-- Dotychczasowi aktywni subskrybenci zapisali się przed wprowadzeniem
-- potwierdzenia mailem — traktujemy ich jako potwierdzonych (data zgody).
UPDATE `newsletter_subscribers` SET `confirmed_at` = COALESCE(`consent_at`, `created_at`) WHERE `is_active` = true AND `confirmed_at` IS NULL;--> statement-breakpoint
-- Link wypisania w mailach wymaga tokenu — uzupełniamy brakujące.
UPDATE `newsletter_subscribers` SET `unsub_token` = REPLACE(UUID(), '-', '') WHERE `unsub_token` IS NULL;
