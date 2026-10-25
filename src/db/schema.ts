import { sql } from 'drizzle-orm'
import {
  mysqlTable, varchar, int, tinyint, bigint, datetime,
  timestamp, primaryKey, mysqlEnum, text, boolean,
  index, uniqueIndex,
} from 'drizzle-orm/mysql-core'

// ─── cart ─────────────────────────────────────────────────────────────────────

export const cartItems = mysqlTable('cart_items', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  ownerId:   varchar('owner_id', { length: 128 }).notNull(),
  productId: varchar('product_id', { length: 128 }).notNull(),
  variantId: varchar('variant_id', { length: 128 }).notNull().default(''),
  qty:       int('qty').notNull().default(1),
  addedAt:   timestamp('added_at').defaultNow(),
})

// ─── wishlist ─────────────────────────────────────────────────────────────────

export const wishlistItems = mysqlTable('wishlist_items', {
  userId:    varchar('user_id', { length: 128 }).notNull(),
  productId: varchar('product_id', { length: 128 }).notNull(),
  addedAt:   timestamp('added_at').defaultNow(),
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.productId] }),
}))

// ─── orders ───────────────────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  'pending',
  'awaiting_payment',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const
export type OrderStatus = typeof ORDER_STATUSES[number]

export const ORDER_STOCK_STATES = ['none', 'pending', 'deducted', 'restored', 'legacy'] as const
export type OrderStockState = typeof ORDER_STOCK_STATES[number]

export const PAYMENT_METHODS = ['przelewy24', 'autopay', 'cod'] as const
export type PaymentMethod = typeof PAYMENT_METHODS[number]

export const orders = mysqlTable('orders', {
  id:             varchar('id', { length: 36 }).primaryKey(),
  userId:         varchar('user_id', { length: 128 }).notNull(),
  guestEmail:     varchar('guest_email', { length: 256 }),
  status:         mysqlEnum('status', ORDER_STATUSES).notNull().default('pending'),
  paymentMethod:  mysqlEnum('payment_method', PAYMENT_METHODS).notNull(),
  shippingMethod: varchar('shipping_method', { length: 64 }).notNull(),
  subtotalCents:  int('subtotal_cents').notNull(),
  shippingCents:  int('shipping_cents').notNull().default(0),
  discountCents:  int('discount_cents').notNull().default(0),
  totalCents:     int('total_cents').notNull(),
  discountCode:   varchar('discount_code', { length: 64 }),
  notes:          varchar('notes', { length: 512 }),
  // Automatyczne zdejmowanie stanu magazynu (lib/inventory.server.ts):
  //   none     — jeszcze nie zdjęto (czeka na płatność),
  //   pending  — zdejmowanie rozpoczęte, nie wszystkie pozycje zapisane (ponowi je cron),
  //   deducted — stan zdjęty, restored — stan oddany (anulowanie / zwrot towaru),
  //   legacy   — zamówienie sprzed tej funkcji (nigdy nie zdejmujemy wstecz).
  stockState:     mysqlEnum('stock_state', ORDER_STOCK_STATES).notNull().default('none'),
  // Ostrzeżenie dla admina, np. zamówienie opłacone, gdy towaru zabrakło.
  stockNote:      varchar('stock_note', { length: 512 }),
  createdAt:      timestamp('created_at').defaultNow(),
  updatedAt:      timestamp('updated_at').defaultNow().onUpdateNow(),
})

export const orderItems = mysqlTable('order_items', {
  id:           varchar('id', { length: 36 }).primaryKey(),
  orderId:      varchar('order_id', { length: 36 }).notNull(),
  productId:    varchar('product_id', { length: 128 }).notNull(),
  variantId:    varchar('variant_id', { length: 128 }).notNull().default(''),
  qty:          int('qty').notNull(),
  priceCents:   int('price_cents').notNull(),
  name:         varchar('name', { length: 256 }).notNull(),
  brand:        varchar('brand', { length: 128 }).notNull().default(''),
  variantLabel: varchar('variant_label', { length: 256 }).notNull().default(''),
  imageUrl:     varchar('image_url', { length: 512 }).notNull().default(''),
})

// ─── shipping addresses ───────────────────────────────────────────────────────

export const shippingAddresses = mysqlTable('shipping_addresses', {
  id:               varchar('id', { length: 36 }).primaryKey(),
  orderId:          varchar('order_id', { length: 36 }).notNull(),
  firstName:        varchar('first_name', { length: 128 }).notNull(),
  lastName:         varchar('last_name', { length: 128 }).notNull(),
  email:            varchar('email', { length: 256 }).notNull(),
  phone:            varchar('phone', { length: 32 }).notNull(),
  // null for paczkomat orders (pickup point replaces street address)
  street:           varchar('street', { length: 256 }),
  city:             varchar('city', { length: 128 }),
  apartment_number: varchar('apartment_number', { length: 64 }),
  postalCode:       varchar('postal_code', { length: 16 }),
  country:          varchar('country', { length: 2 }).notNull().default('PL'),
  // filled only for paczkomat deliveries
  pickupPointCode:  varchar('pickup_point_code', { length: 128 }),
  pickupPointName:  varchar('pickup_point_name', { length: 256 }),
})

// ─── payment transactions ─────────────────────────────────────────────────────

export const PAYMENT_TX_STATUSES = ['pending', 'success', 'failed', 'expired', 'refunded'] as const
export type PaymentTxStatus = typeof PAYMENT_TX_STATUSES[number]

export const paymentTransactions = mysqlTable('payment_transactions', {
  id:               varchar('id', { length: 36 }).primaryKey(),
  orderId:          varchar('order_id', { length: 36 }).notNull(),
  provider:         mysqlEnum('provider', ['przelewy24', 'autopay']).notNull(),
  externalId:       varchar('external_id', { length: 256 }),
  sessionId:        varchar('session_id', { length: 256 }).notNull(),
  status:           mysqlEnum('status', PAYMENT_TX_STATUSES).notNull().default('pending'),
  amountCents:      int('amount_cents').notNull(),
  saveCardConsent:  boolean('save_card_consent').notNull().default(false),
  cardToken:        varchar('card_token', { length: 256 }),
  rawResponse:      text('raw_response'),
  createdAt:        timestamp('created_at').defaultNow(),
  updatedAt:        timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ─── saved cards ──────────────────────────────────────────────────────────────

export const savedCards = mysqlTable('saved_cards', {
  id:           varchar('id', { length: 36 }).primaryKey(),
  userId:       varchar('user_id', { length: 128 }).notNull(),
  provider:     mysqlEnum('provider', ['autopay']).notNull().default('autopay'),
  token:        varchar('token', { length: 256 }).notNull(),
  maskedNumber: varchar('masked_number', { length: 20 }),
  expiryMonth:  int('expiry_month'),
  expiryYear:   int('expiry_year'),
  cardBrand:    varchar('card_brand', { length: 32 }),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at').defaultNow(),
})

// ─── shipments ────────────────────────────────────────────────────────────────

export const SHIPMENT_STATUSES = [
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed',
  'returned',
] as const
export type ShipmentStatus = typeof SHIPMENT_STATUSES[number]

export const shipments = mysqlTable('shipments', {
  id:             varchar('id', { length: 36 }).primaryKey(),
  orderId:        varchar('order_id', { length: 36 }).notNull(),
  furgonetkaId:   varchar('furgonetka_id', { length: 128 }),
  carrier:        varchar('carrier', { length: 64 }).notNull(),
  service:        varchar('service', { length: 64 }).notNull(),
  trackingNumber: varchar('tracking_number', { length: 128 }),
  labelUrl:       varchar('label_url', { length: 512 }),
  status:         mysqlEnum('status', SHIPMENT_STATUSES).notNull().default('created'),
  parcelWeightG:  int('parcel_weight_g').notNull(),
  createdAt:      timestamp('created_at').defaultNow(),
  updatedAt:      timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ─── delivery services (synced from Furgonetka, prices set manually) ──────────

export const DELIVERY_TYPES = ['kurier', 'paczkomat'] as const
export type DeliveryType = typeof DELIVERY_TYPES[number]

export const deliveryServices = mysqlTable('delivery_services', {
  id:                  varchar('id', { length: 36 }).primaryKey(),
  // matches Furgonetka's `service` field — used when creating shipments
  serviceCode:         varchar('service_code', { length: 64 }).notNull().unique(),
  // widget courierServices param (e.g. "inpost" for both kurier and paczkomat)
  mapServiceCode:      varchar('map_service_code', { length: 64 }),
  name:                varchar('name', { length: 128 }).notNull(),
  deliveryType:        mysqlEnum('delivery_type', DELIVERY_TYPES).notNull().default('kurier'),
  priceCents:          int('price_cents').notNull().default(0),
  estimatedDays:       varchar('estimated_days', { length: 64 }),
  isActive:            boolean('is_active').notNull().default(false),
  sortOrder:           int('sort_order').notNull().default(99),
  // numeric ID from Furgonetka /account/services — kept for reference
  furgonetkaServiceId: int('furgonetka_service_id'),
  syncedAt:            timestamp('synced_at'),
  updatedAt:           timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ─── newsletter subscribers ───────────────────────────────────────────────────

export const newsletterSubscribers = mysqlTable('newsletter_subscribers', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  email:      varchar('email', { length: 256 }).notNull().unique(),
  // RODO: zapis zgody i data jej wyrażenia
  consent:    boolean('consent').notNull().default(true),
  consentAt:  timestamp('consent_at').defaultNow(),
  // false po wypisaniu się (hard opt-out zachowuje historię zgody)
  isActive:   boolean('is_active').notNull().default(true),
  // token linku wypisania (bez logowania) — /newsletter/wypisz?token=…
  unsubToken: varchar('unsub_token', { length: 64 }),
  // Double opt-in: zapis jest aktywny dopiero po kliknięciu linku z maila
  // (confirmed_at). Token potwierdzenia jest jednorazowy.
  confirmToken:  varchar('confirm_token', { length: 64 }),
  confirmSentAt: datetime('confirm_sent_at'),
  confirmedAt:   datetime('confirmed_at'),
  createdAt:  timestamp('created_at').defaultNow(),
  updatedAt:  timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ─── email templates (edytowalne z panelu admina) ────────────────────────────

export const emailTemplates = mysqlTable('email_templates', {
  // np. 'newsletter_welcome' — klucz identyfikujący szablon
  key:       varchar('key', { length: 128 }).primaryKey(),
  subject:   varchar('subject', { length: 256 }).notNull(),
  // treść HTML maila (może zawierać placeholder {{email}})
  html:      text('html').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ─── import jobs (audyt hurtowych importów CSV z panelu admina) ───────────────

export const IMPORT_TYPES = ['products', 'subcategories'] as const
export type ImportType = typeof IMPORT_TYPES[number]

export const IMPORT_JOB_STATUSES = ['running', 'done', 'failed'] as const
export type ImportJobStatus = typeof IMPORT_JOB_STATUSES[number]

export const importJobs = mysqlTable('import_jobs', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  type:       mysqlEnum('type', IMPORT_TYPES).notNull(),
  fileName:   varchar('file_name', { length: 256 }).notNull().default(''),
  totalRows:  int('total_rows').notNull().default(0),
  okRows:     int('ok_rows').notNull().default(0),
  failedRows: int('failed_rows').notNull().default(0),
  status:     mysqlEnum('status', IMPORT_JOB_STATUSES).notNull().default('running'),
  // szczegółowy raport per wiersz: [{ row: 1, ok: true }, { row: 2, ok: false, error: '...' }]
  logJson:    text('log_json'),
  createdBy:  varchar('created_by', { length: 128 }),
  createdAt:  timestamp('created_at').defaultNow(),
})

// ─── saved addresses (one per logged-in user, pre-fills checkout) ─────────────

export const savedAddresses = mysqlTable('saved_addresses', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  userId:     varchar('user_id', { length: 128 }).notNull().unique(),
  firstName:  varchar('first_name', { length: 128 }).notNull(),
  lastName:   varchar('last_name', { length: 128 }).notNull(),
  email:      varchar('email', { length: 256 }).notNull(),
  phone:      varchar('phone', { length: 32 }).notNull(),
  street:     varchar('street', { length: 256 }).notNull(),
  apartment_number: varchar('apartment_number', { length: 64 }),
  city:       varchar('city', { length: 128 }).notNull(),
  postalCode: varchar('postal_code', { length: 16 }).notNull(),
  country:    varchar('country', { length: 2 }).notNull().default('PL'),
  updatedAt:  timestamp('updated_at').defaultNow().onUpdateNow(),
})

// ─── product reviews (opinie o produktach) ────────────────────────────────────

export const REVIEW_STATUSES = ['published', 'hidden'] as const
export type ReviewStatus = typeof REVIEW_STATUSES[number]

export const productReviews = mysqlTable('product_reviews', {
  id:               varchar('id', { length: 36 }).primaryKey(),
  // `_id` produktu z Sanity (opublikowany dokument, bez prefiksu `drafts.`)
  productId:        varchar('product_id', { length: 128 }).notNull(),
  userId:           varchar('user_id', { length: 128 }).notNull(),
  // podpis zapisany w chwili dodania opinii ("Anna K.") — nie zdradza nazwiska
  authorName:       varchar('author_name', { length: 64 }).notNull(),
  rating:           tinyint('rating').notNull(),
  title:            varchar('title', { length: 120 }),
  body:             text('body').notNull(),
  // true, gdy autor ma opłacone zamówienie z tym produktem (liczone przy zapisie)
  verifiedPurchase: boolean('verified_purchase').notNull().default(false),
  // opinie są publikowane od razu; admin może je ukryć (nie liczą się wtedy do średniej)
  status:           mysqlEnum('status', REVIEW_STATUSES).notNull().default('published'),
  adminReply:       text('admin_reply'),
  adminReplyAt:     timestamp('admin_reply_at'),
  createdAt:        timestamp('created_at').defaultNow(),
  updatedAt:        timestamp('updated_at').defaultNow().onUpdateNow(),
}, t => [
  // jedna opinia na konto i produkt — ponowne wysłanie formularza ją edytuje
  uniqueIndex('product_reviews_user_product').on(t.userId, t.productId),
  index('product_reviews_product_status').on(t.productId, t.status, t.createdAt),
])

// ─── product price history (rejestr cen — najniższa cena z 30 dni) ────────────

export const PRICE_CHANGE_SOURCES = [
  'init',      // pierwsza rejestracja ceny (produkt nie miał jeszcze historii)
  'admin',     // zapis z panelu admina
  'import',    // import CSV
  'webhook',   // zmiana w Sanity Studio zgłoszona webhookiem
  'cron',      // okresowe uzgodnienie z Sanity
  'observed',  // zmiana wykryta przy wyświetlaniu produktu
] as const
// Zniknięcie ceny ze sklepu (wycofany produkt, usunięty wariant) tylko
// zamyka przedział — nie tworzy nowego wiersza.
export type PriceChangeSource = typeof PRICE_CHANGE_SOURCES[number]

/*
 * Każdy wiersz = jedna cena obowiązująca w sklepie w przedziale
 * [valid_from, valid_to). `valid_to IS NULL` → cena bieżąca.
 * Historię prowadzi osobno każdy wariant (`variant_key`) oraz cena bazowa
 * produktu (`variant_key = ''`). Wierszy się nie usuwa ani nie edytuje cen —
 * to dowód, z czego wyliczono „najniższą cenę z 30 dni”.
 */
export const productPriceHistory = mysqlTable('product_price_history', {
  id:          bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
  // `_id` opublikowanego produktu z Sanity
  productId:   varchar('product_id', { length: 128 }).notNull(),
  // `variants[]._key` albo '' dla ceny bazowej produktu
  variantKey:  varchar('variant_key', { length: 64 }).notNull().default(''),
  priceCents:  int('price_cents').notNull(),
  // DATETIME w UTC (drizzle zapisuje i czyta daty jako UTC). Nie TIMESTAMP:
  // przy explicit_defaults_for_timestamp=OFF (starsze MySQL/MariaDB na
  // hostingu) pierwsza kolumna TIMESTAMP NOT NULL dostaje ON UPDATE
  // CURRENT_TIMESTAMP i zamknięcie przedziału przestawiałoby jego początek.
  validFrom:   datetime('valid_from', { mode: 'date', fsp: 3 }).notNull(),
  validTo:     datetime('valid_to', { mode: 'date', fsp: 3 }),
  source:      mysqlEnum('source', PRICE_CHANGE_SOURCES).notNull(),
  // 1 dla przedziału otwartego, NULL dla zamkniętych — unikalny indeks
  // gwarantuje, że współbieżne zapisy nie utworzą dwóch „bieżących” cen.
  openMarker:  tinyint('open_marker').generatedAlwaysAs(sql`(if(\`valid_to\` is null, 1, null))`, { mode: 'stored' }),
  createdAt:   datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
}, t => [
  uniqueIndex('price_history_one_open').on(t.productId, t.variantKey, t.openMarker),
  index('price_history_lookup').on(t.productId, t.variantKey, t.validFrom),
])

// ─── discount codes ───────────────────────────────────────────────────────────

export const DISCOUNT_TYPES = ['percent', 'fixed', 'free_shipping'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

/*
 * Kody rabatowe definiowane w panelu (/admin/discounts). `code` zapisujemy
 * WIELKIMI literami — klient może wpisać dowolną wielkość liter.
 * `value`: procent (1–100) dla `percent`, grosze dla `fixed`, 0 dla
 * `free_shipping`. Daty w UTC (DATETIME — patrz uwaga przy rejestrze cen).
 */
export const discountCodes = mysqlTable('discount_codes', {
  id:                 varchar('id', { length: 36 }).primaryKey(),
  code:               varchar('code', { length: 64 }).notNull(),
  description:        varchar('description', { length: 255 }),
  type:               mysqlEnum('type', DISCOUNT_TYPES).notNull(),
  value:              int('value').notNull().default(0),
  // próg wartości produktów (bez dostawy), 0 = bez progu
  minSubtotalCents:   int('min_subtotal_cents').notNull().default(0),
  // górna granica rabatu procentowego, NULL = bez limitu
  maxDiscountCents:   int('max_discount_cents'),
  startsAt:           datetime('starts_at', { mode: 'date' }),
  endsAt:             datetime('ends_at', { mode: 'date' }),
  // NULL = bez limitu
  usageLimit:         int('usage_limit'),
  usageLimitPerUser:  int('usage_limit_per_user'),
  // licznik użyć (zamówienia z kodem, bez anulowanych) — zmieniany w transakcji
  timesUsed:          int('times_used').notNull().default(0),
  isActive:           boolean('is_active').notNull().default(true),
  createdAt:          datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
  updatedAt:          datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
}, t => [
  uniqueIndex('discount_codes_code').on(t.code),
])

/*
 * Jedno użycie kodu = jedno zamówienie. Wiersz powstaje w tej samej transakcji
 * co zamówienie; anulowanie zamówienia usuwa go i zmniejsza `times_used`.
 * `customer_key` = userId z Clerka (albo id gościa) — do limitu na klienta.
 */
export const discountRedemptions = mysqlTable('discount_redemptions', {
  id:              varchar('id', { length: 36 }).primaryKey(),
  discountCodeId:  varchar('discount_code_id', { length: 36 }).notNull(),
  orderId:         varchar('order_id', { length: 36 }).notNull(),
  customerKey:     varchar('customer_key', { length: 256 }).notNull(),
  // e-mail z zamówienia (małe litery) — limit na klienta liczy się po koncie
  // ORAZ po adresie, żeby drugie konto na ten sam e-mail nie dawało drugiego rabatu
  customerEmail:   varchar('customer_email', { length: 256 }).notNull(),
  code:            varchar('code', { length: 64 }).notNull(),
  discountCents:   int('discount_cents').notNull(),
  createdAt:       datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
}, t => [
  uniqueIndex('discount_redemptions_order').on(t.orderId),
  index('discount_redemptions_code_customer').on(t.discountCodeId, t.customerKey),
  index('discount_redemptions_code_email').on(t.discountCodeId, t.customerEmail),
])

// ─── odstąpienie od umowy (funkcja odstąpienia online) ───────────────────────

/*
 * Oświadczenia o odstąpieniu od umowy złożone przez formularz
 * /help/odstapienie-od-umowy (dyrektywa (UE) 2023/2673 — „przycisk odstąpienia”,
 * obowiązuje od 19.06.2026). Wiersz = dowód złożenia oświadczenia (treść
 * i chwila złożenia); klient dostaje potwierdzenie mailem, sklep —
 * powiadomienie. `order_id` jest wypełnione, gdy numer zamówienia i e-mail
 * pasują do zamówienia w bazie (formularz przyjmuje oświadczenie także bez
 * dopasowania — prawo nie pozwala go odrzucić z powodu literówki).
 */
export const orderWithdrawals = mysqlTable('order_withdrawals', {
  id:          varchar('id', { length: 36 }).primaryKey(),
  orderId:     varchar('order_id', { length: 36 }),
  // numer zamówienia tak, jak podał go klient (np. „3F2A9C1B”)
  orderNumber: varchar('order_number', { length: 64 }).notNull(),
  name:        varchar('name', { length: 200 }).notNull(),
  email:       varchar('email', { length: 256 }).notNull(),
  // których produktów dotyczy (puste = całe zamówienie)
  items:       text('items'),
  note:        text('note'),
  userId:      varchar('user_id', { length: 128 }),
  createdAt:   datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
}, t => [
  index('order_withdrawals_order').on(t.orderId),
  index('order_withdrawals_created').on(t.createdAt),
])

// ─── kampanie newslettera (panel: Marketing → Kampanie) ──────────────────────
//
// Kampania = jeden mail do aktywnych (potwierdzonych) subskrybentów. Treść to
// JSON (`lib/campaigns/content.ts`), HTML składa się przy wysyłce. Przy
// „Wyślij” powstaje lista odbiorców (migawka) w `newsletter_campaign_recipients`,
// a maile wychodzą partiami z limitem na minutę i na dobę
// (`lib/campaigns/campaigns.server.ts`). Migracja: drizzle/0005_*.sql.

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'sending', 'paused', 'sent', 'cancelled'] as const
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number]

export const newsletterCampaigns = mysqlTable('newsletter_campaigns', {
  id:          varchar('id', { length: 36 }).primaryKey(),
  name:        varchar('name', { length: 160 }).notNull(),
  subject:     varchar('subject', { length: 200 }).notNull().default(''),
  preheader:   varchar('preheader', { length: 200 }).notNull().default(''),
  // JSON treści (CampaignContent)
  content:     text('content').notNull(),
  status:      mysqlEnum('status', CAMPAIGN_STATUSES).notNull().default('draft'),
  scheduledAt: datetime('scheduled_at', { mode: 'date', fsp: 3 }),
  startedAt:   datetime('started_at', { mode: 'date', fsp: 3 }),
  finishedAt:  datetime('finished_at', { mode: 'date', fsp: 3 }),
  // liczniki (przeliczane z listy odbiorców po każdej partii)
  totalCount:  int('total_count').notNull().default(0),
  sentCount:   int('sent_count').notNull().default(0),
  failedCount: int('failed_count').notNull().default(0),
  lastError:   varchar('last_error', { length: 500 }),
  createdBy:   varchar('created_by', { length: 128 }),
  createdAt:   datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
  updatedAt:   datetime('updated_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
}, t => [
  index('newsletter_campaigns_status').on(t.status, t.scheduledAt),
  index('newsletter_campaigns_created').on(t.createdAt),
])

export const CAMPAIGN_RECIPIENT_STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const
export type CampaignRecipientStatus = typeof CAMPAIGN_RECIPIENT_STATUSES[number]

export const newsletterCampaignRecipients = mysqlTable('newsletter_campaign_recipients', {
  campaignId:   varchar('campaign_id', { length: 36 }).notNull(),
  subscriberId: varchar('subscriber_id', { length: 36 }).notNull(),
  email:        varchar('email', { length: 256 }).notNull(),
  status:       mysqlEnum('status', CAMPAIGN_RECIPIENT_STATUSES).notNull().default('pending'),
  attempts:     tinyint('attempts').notNull().default(0),
  error:        varchar('error', { length: 300 }),
  sentAt:       datetime('sent_at', { mode: 'date', fsp: 3 }),
}, t => [
  primaryKey({ columns: [t.campaignId, t.subscriberId] }),
  index('newsletter_recipients_queue').on(t.campaignId, t.status),
  // limit dobowy liczony po wszystkich kampaniach
  index('newsletter_recipients_sent_at').on(t.sentAt),
])

// ─── ruchy magazynowe (automatyczne zdejmowanie stanu) ────────────────────────
// Jeden wiersz = zdjęcie albo oddanie stanu jednej pozycji zamówienia
// (produkt + wariant). Unikalny klucz pilnuje, że ta sama pozycja nie zejdzie
// (ani nie wróci) dwa razy — nawet przy powtórzonym ITN albo ponowieniu przez cron.

export const STOCK_MOVEMENT_KINDS = ['deduct', 'restore'] as const
export type StockMovementKind = typeof STOCK_MOVEMENT_KINDS[number]

export const stockMovements = mysqlTable('stock_movements', {
  id:           varchar('id', { length: 36 }).primaryKey(),
  orderId:      varchar('order_id', { length: 36 }).notNull(),
  productId:    varchar('product_id', { length: 128 }).notNull(),
  variantKey:   varchar('variant_key', { length: 128 }).notNull().default(''),
  kind:         mysqlEnum('kind', STOCK_MOVEMENT_KINDS).notNull(),
  // Ile sztuk wynikało z zamówienia i ile faktycznie zdjęto/oddano
  // (mniej, gdy towaru zabrakło — stan nie schodzi poniżej zera).
  requestedQty: int('requested_qty').notNull(),
  appliedQty:   int('applied_qty').notNull(),
  // Gdzie był stan: 'variant' | 'product' | 'untracked' (stan nieprowadzony).
  target:       varchar('target', { length: 16 }).notNull(),
  stockBefore:  int('stock_before'),
  stockAfter:   int('stock_after'),
  reason:       varchar('reason', { length: 32 }).notNull(),
  createdAt:    datetime('created_at', { mode: 'date', fsp: 3 }).notNull().default(sql`(now(3))`),
}, t => [
  uniqueIndex('stock_movements_line').on(t.orderId, t.productId, t.variantKey, t.kind),
  index('stock_movements_product').on(t.productId, t.createdAt),
])
