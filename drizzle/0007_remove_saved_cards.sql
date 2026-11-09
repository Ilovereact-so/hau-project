-- Usunięcie zapisanych kart (Autopay One Click / płatności automatyczne).
-- Usługa niedostępna na umowie sklepu — kod nie zapisuje ani nie czyta kart.
-- Uruchom RĘCZNIE na bazie (deploy nie robi migracji) PO wdrożeniu nowego
-- kodu — stary kod zapisuje `save_card_consent` i bez kolumny psułby zamówienia.
-- UWAGA: nieodwracalne — kasuje tokeny kart zapisane w czasie testów.
DROP TABLE `saved_cards`;--> statement-breakpoint
ALTER TABLE `payment_transactions` DROP COLUMN `save_card_consent`;--> statement-breakpoint
ALTER TABLE `payment_transactions` DROP COLUMN `card_token`;