// src/db/schema.ts
import {
  mysqlTable, varchar, int, timestamp, primaryKey
} from 'drizzle-orm/mysql-core'

export const cartItems = mysqlTable('cart_items', {
  id:        varchar('id', { length: 36 }).primaryKey(),
  ownerId:   varchar('owner_id', { length: 128 }).notNull(),
  productId: varchar('product_id', { length: 128 }).notNull(),
  variantId: varchar('variant_id', { length: 128 }),
  qty:       int('qty').notNull().default(1),
  addedAt:   timestamp('added_at').defaultNow(),
})