import {
  mysqlTable, varchar, int,
  timestamp, primaryKey, mysqlEnum, text,
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
  id:         varchar('id', { length: 36 }).primaryKey(),
  orderId:    varchar('order_id', { length: 36 }).notNull(),
  firstName:  varchar('first_name', { length: 128 }).notNull(),
  lastName:   varchar('last_name', { length: 128 }).notNull(),
  email:      varchar('email', { length: 256 }).notNull(),
  phone:      varchar('phone', { length: 32 }).notNull(),
  street:     varchar('street', { length: 256 }).notNull(),
  city:       varchar('city', { length: 128 }).notNull(),
  postalCode: varchar('postal_code', { length: 16 }).notNull(),
  country:    varchar('country', { length: 2 }).notNull().default('PL'),
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
