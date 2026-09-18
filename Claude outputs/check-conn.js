/*
 * Sprawdza, czy aplikacja dosięga MySQL-a i Redisa oraz czy baza ma tabele.
 * Uruchamiać W KATALOGU `standalone` (tam leży .env, a node_modules jest piętro wyżej):
 *
 *   cd ~/domains/e-hau-prod.wibbly.pl/public_html/standalone
 *   node check-conn.js
 */
const fs = require('fs')

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const WYMAGANE = ['DB_HOST', 'DB_USER', 'DB_NAME', 'REDIS_URL', 'CLERK_SECRET_KEY', 'NEXT_PUBLIC_APP_URL']
console.log('--- zmienne z .env ---')
for (const key of WYMAGANE) {
  const value = env[key]
  const shown = key.includes('SECRET') || key.includes('PASSWORD') ? (value ? '(ustawione)' : '') : value
  console.log(`${key.padEnd(24)} ${value ? shown : '>>> BRAK <<<'}`)
}

const TABELE = ['orders', 'order_items', 'product_reviews', 'product_price_history', 'cart_items', 'wishlist_items']

;(async () => {
  console.log('\n--- MySQL ---')
  try {
    const mysql = require('mysql2/promise')
    const conn = await mysql.createConnection({
      host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
      connectTimeout: 8000,
    })
    const [rows] = await conn.query('SHOW TABLES')
    const nazwy = rows.map((r) => Object.values(r)[0])
    console.log('połączenie OK, tabel:', nazwy.length)
    for (const t of TABELE) console.log(`  ${nazwy.includes(t) ? 'jest  ' : 'BRAK  '} ${t}`)
    await conn.end()
  } catch (error) {
    console.log('BŁĄD:', error.code || error.message)
  }

  console.log('\n--- Redis ---')
  try {
    const { createClient } = require('redis')
    const client = createClient({ url: env.REDIS_URL, socket: { connectTimeout: 8000 } })
    client.on('error', () => {})
    await client.connect()
    console.log('połączenie OK:', await client.ping())
    await client.quit()
  } catch (error) {
    console.log('BŁĄD:', error.code || error.message)
  }
  process.exit(0)
})()
