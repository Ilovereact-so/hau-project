// src/db/schema.ts
import {
  mysqlTable, varchar, int,
  timestamp, primaryKey
} from 'drizzle-orm/mysql-core'

// koszyk — tylko co potrzebne
export const cartItems = mysqlTable('cart_items', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  ownerId:   varchar('owner_id', { length: 128 }).notNull(),
  productId: varchar('product_id', { length: 128 }).notNull(),
  variantId: varchar('variant_id', { length: 128 }).notNull().default(''),
  qty:       int('qty').notNull().default(1),
  addedAt:   timestamp('added_at').defaultNow(),
})

// wishlist — tylko relacja
export const wishlistItems = mysqlTable('wishlist_items', {
  userId:    varchar('user_id', { length: 128 }).notNull(),
  productId: varchar('product_id', { length: 128 }).notNull(),
  addedAt:   timestamp('added_at').defaultNow(),
}, t => ({
  pk: primaryKey({ columns: [t.userId, t.productId] }),
}))

// zamówienia — tu dopiero snapshot ceny
export const orders = mysqlTable('orders', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  userId:     varchar('user_id', { length: 128 }).notNull(),
  totalCents: int('total_cents').notNull(),
  discountCode: varchar('discount_code', { length: 64 }),
  discountCents: int('discount_cents').default(0),
  createdAt:  timestamp('created_at').defaultNow(),
})

export const orderItems = mysqlTable('order_items', {
  id:         varchar('id', { length: 36 }).primaryKey(),
  orderId:    varchar('order_id', { length: 36 }).notNull(),
  productId:  varchar('product_id', { length: 128 }).notNull(),
  variantId:  varchar('variant_id', { length: 128 }).notNull().default(''),
  qty:        int('qty').notNull(),
  // snapshot tylko tutaj — moment zakupu
  priceCents: int('price_cents').notNull(),
  name:       varchar('name', { length: 256 }).notNull(),
})