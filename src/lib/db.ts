import 'server-only'
import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

// Cache the pool on globalThis in dev so Turbopack/webpack HMR reuses the
// same pool across module reloads instead of leaking a new one each time.
const globalForDb = globalThis as unknown as { mysqlPool?: mysql.Pool }

const pool = globalForDb.mysqlPool ?? mysql.createPool({
  host:            process.env.DB_HOST,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  database:        process.env.DB_NAME,
  connectionLimit: 10,
})

if (process.env.NODE_ENV !== 'production') globalForDb.mysqlPool = pool

export const db = drizzle(pool)