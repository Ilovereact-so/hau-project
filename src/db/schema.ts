import {
  mysqlTable, varchar, int,
  timestamp, primaryKey, mysqlEnum, text, boolean,
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
  id:          varchar('id', { length: 36 }).primaryKey(),
  orderId:     varchar('order_id', { length: 36 }).notNull(),
  provider:    mysqlEnum('provider', ['przelewy24', 'autopay']).notNull(),
  externalId:  varchar('external_id', { length: 256 }),
  sessionId:   varchar('session_id', { length: 256 }).notNull(),
  status:      mysqlEnum('status', PAYMENT_TX_STATUSES).notNull().default('pending'),
  amountCents: int('amount_cents').notNull(),
  rawResponse: text('raw_response'),
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow().onUpdateNow(),
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
