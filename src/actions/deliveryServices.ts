'use server'

import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { deliveryServices, DELIVERY_TYPES } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { redis } from '@/lib/redis'
import { getAvailableServices } from '@/lib/furgonetka'

const CACHE_KEY = 'delivery_services:active'
const CACHE_TTL = 60 * 10 // 10 min

// ─── types ────────────────────────────────────────────────────────────────────

export interface DeliveryService {
  id:              string
  serviceCode:     string
  mapServiceCode:  string | null
  name:            string
  deliveryType:    'kurier' | 'paczkomat'
  priceCents:      number
  estimatedDays:   string | null
  isActive:        boolean
  sortOrder:       number
}

// ─── public ───────────────────────────────────────────────────────────────────

export async function getActiveDeliveryServices(): Promise<DeliveryService[]> {
  const cached = await redis.get(CACHE_KEY)
  if (cached) return JSON.parse(cached as string)

  const rows = await db
    .select({
      id:             deliveryServices.id,
      serviceCode:    deliveryServices.serviceCode,
      mapServiceCode: deliveryServices.mapServiceCode,
      name:           deliveryServices.name,
      deliveryType:   deliveryServices.deliveryType,
      priceCents:     deliveryServices.priceCents,
      estimatedDays:  deliveryServices.estimatedDays,
    })
    .from(deliveryServices)
    .where(eq(deliveryServices.isActive, true))
    .orderBy(deliveryServices.sortOrder)
    
  await redis.setEx(CACHE_KEY, CACHE_TTL, JSON.stringify(rows))
  return rows as DeliveryService[]
}

export async function getDeliveryServiceByCode(serviceCode: string): Promise<DeliveryService | null> {
  const rows = await db
    .select({
      id:             deliveryServices.id,
      serviceCode:    deliveryServices.serviceCode,
      mapServiceCode: deliveryServices.mapServiceCode,
      name:           deliveryServices.name,
      deliveryType:   deliveryServices.deliveryType,
      priceCents:     deliveryServices.priceCents,
      estimatedDays:  deliveryServices.estimatedDays,
    })
    .from(deliveryServices)
    .where(eq(deliveryServices.serviceCode, serviceCode))
    .limit(1)

  return (rows[0] as DeliveryService) ?? null
}

/** Wszystkie metody dostawy (również nieaktywne) — panel admina. */
export async function getAllDeliveryServices(): Promise<DeliveryService[]> {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Brak uprawnień')
  return db
    .select()
    .from(deliveryServices)
    .orderBy(deliveryServices.sortOrder)
}

// ─── admin — sync from Furgonetka ─────────────────────────────────────────────

export async function syncDeliveryServicesFromFurgonetka(): Promise<{
  ok: boolean
  added: number
  existing: number
  error?: string
}> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { ok: false, added: 0, existing: 0, error: 'Brak uprawnień' }
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return { ok: false, added: 0, existing: 0, error: 'Brak uprawnień' }

  let services: Awaited<ReturnType<typeof getAvailableServices>>
  try {
    services = await getAvailableServices()
  } catch (e) {
    return { ok: false, added: 0, existing: 0, error: String(e) }
  }

  const existing = await db
    .select({ serviceCode: deliveryServices.serviceCode })
    .from(deliveryServices)

  const existingCodes = new Set(existing.map(r => r.serviceCode))

  let added = 0
  for (const s of services) {
    if (existingCodes.has(s.code)) continue
    await db.insert(deliveryServices).values({
      id:                  crypto.randomUUID(),
      serviceCode:         s.code,
      mapServiceCode:      s.code, // same code used for widget by default
      name:                s.name,
      deliveryType:        'kurier', // admin updates manually
      priceCents:          0,
      isActive:            false,   // inactive until admin configures
      sortOrder:           99,
      furgonetkaServiceId: s.id,
      syncedAt:            new Date(),
    })
    added++
  }

  await redis.del(CACHE_KEY)
  return { ok: true, added, existing: existingCodes.size }
}

// ─── admin — update service config ────────────────────────────────────────────

export async function updateDeliveryService(
  id: string,
  patch: {
    name?:           string
    mapServiceCode?: string
    deliveryType?:   typeof DELIVERY_TYPES[number]
    priceCents?:     number
    estimatedDays?:  string
    isActive?:       boolean
    sortOrder?:      number
  },
): Promise<{ ok: boolean; error?: string }> {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { ok: false, error: 'Brak uprawnień' }
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') return { ok: false, error: 'Brak uprawnień' }

  await db
    .update(deliveryServices)
    .set(patch)
    .where(eq(deliveryServices.id, id))

  await redis.del(CACHE_KEY)
  return { ok: true }
}
