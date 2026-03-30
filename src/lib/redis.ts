import 'server-only'
import { createClient } from 'redis'

const client = createClient({ url: process.env.REDIS_URL })

client.on('error', (err) => console.error('Redis error:', err))

if (!client.isOpen) await client.connect()

export const redis = client