import 'server-only'
import { createClient, type RedisClientOptions } from 'redis'

/*
 * Klient Redisa.
 *
 * `REDIS_URL` przyjmuje dwie postacie:
 *  - adres TCP — `redis://host:port` (albo `rediss://` po TLS),
 *  - ścieżkę do gniazda uniksowego — `/home/user/.redis/redis.sock`.
 *    Tak wystawiają Redisa hostingi współdzielone (DirectAdmin/CloudLinux).
 *
 * Drugiej postaci NIE wolno podać jako `url`: parser `node-redis` przepuszcza
 * tylko schematy `redis:` i `rediss:`, a na samej ścieżce wywraca się na
 * ERR_INVALID_URL. Gniazdo idzie przez `socket.path`. Przyjmujemy też zapis
 * `unix:///ścieżka`, bo w takiej formie bywa podawany w panelach hostingu.
 */
function connectionOptions(): RedisClientOptions {
  const value = (process.env.REDIS_URL ?? '').trim()
  if (!value) return {}
  const path = value.replace(/^(redis\+)?unix:\/\//, '')
  // `tls: false` jest w typie gniazda uniksowego wymagane — po sockecie
  // lokalnym i tak nie ma czego szyfrować.
  return path.startsWith('/') ? { socket: { path, tls: false } } : { url: value }
}

const client = createClient(connectionOptions())

client.on('error', (err) => console.error('Redis error:', err))

if (!client.isOpen) await client.connect()

export const redis = client
