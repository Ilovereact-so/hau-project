'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import {
  OMNIBUS_BATCH_MAX,
  isOmnibusInfo,
  isValidProductId,
  type ProductOmnibus,
} from '@/lib/omnibus'

/*
 * Najniższa cena z 30 dni dla kafelków produktów.
 *
 * Działa jak useReviewSummary: identyfikatory z jednego „ticku” (20 ms)
 * idą jednym żądaniem do /api/prices/omnibus (porcje po 60), a wyniki
 * żyją w pamięci modułu przez minutę.
 */

type Entry = { data: ProductOmnibus | null; fetchedAt: number; failed: boolean }

const FRESH_MS = 60_000
const RETRY_AFTER_FAIL_MS = 30_000
const FLUSH_DELAY_MS = 20

const entries = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()
const queued = new Set<string>()
const inflight = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
// Obiekty `initial` już wstawione do pamięci — każdy wstawiamy raz.
const primed = new WeakSet<object>()

function notify(id: string) {
  listeners.get(id)?.forEach((listener) => listener())
}

function needsFetch(id: string): boolean {
  if (queued.has(id) || inflight.has(id)) return false
  const entry = entries.get(id)
  if (!entry) return true
  const age = Date.now() - entry.fetchedAt
  return entry.failed ? age > RETRY_AFTER_FAIL_MS : age > FRESH_MS
}

function sanitize(value: unknown): ProductOmnibus {
  const result: ProductOmnibus = {}
  if (!value || typeof value !== 'object') return result
  for (const [key, info] of Object.entries(value as Record<string, unknown>)) {
    if (isOmnibusInfo(info)) result[key] = info
  }
  return result
}

async function fetchChunk(ids: string[]) {
  ids.forEach((id) => inflight.add(id))
  try {
    const res = await fetch(`/api/prices/omnibus?ids=${ids.map(encodeURIComponent).join(',')}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as { prices?: Record<string, unknown> }
    const now = Date.now()
    for (const id of ids) {
      entries.set(id, { data: sanitize(body.prices?.[id]), fetchedAt: now, failed: false })
    }
  } catch (err) {
    console.error('[prices] omnibus fetch failed', err)
    const now = Date.now()
    for (const id of ids) {
      const prev = entries.get(id)
      entries.set(id, { data: prev?.data ?? null, fetchedAt: now, failed: true })
    }
  } finally {
    ids.forEach((id) => {
      inflight.delete(id)
      notify(id)
    })
  }
}

function flush() {
  flushTimer = null
  const ids = [...queued]
  queued.clear()
  for (let i = 0; i < ids.length; i += OMNIBUS_BATCH_MAX) {
    void fetchChunk(ids.slice(i, i + OMNIBUS_BATCH_MAX))
  }
}

function request(id: string) {
  if (!needsFetch(id)) return
  queued.add(id)
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
}

/**
 * Dane Omnibus produktu (wszystkie klucze cen).
 * `undefined` — ładuje się; `null` — nie udało się pobrać.
 *
 * `initial` — policzone na serwerze (strona produktu) przy tym renderze:
 * jest świeższe od pamięci podręcznej, więc raz ją nadpisuje (tylko
 * w przeglądarce). Z `initial` hook nie odpytuje API.
 */
export function useOmnibus(
  productId: string | null | undefined,
  initial?: ProductOmnibus | null,
): ProductOmnibus | null | undefined {
  const id = productId && isValidProductId(productId) ? productId : null

  if (id && initial && typeof window !== 'undefined' && !primed.has(initial)) {
    primed.add(initial)
    entries.set(id, { data: initial, fetchedAt: Date.now(), failed: false })
  }

  const subscribe = useCallback(
    (listener: () => void) => {
      if (!id) return () => {}
      let set = listeners.get(id)
      if (!set) {
        set = new Set()
        listeners.set(id, set)
      }
      set.add(listener)
      return () => {
        set.delete(listener)
        if (!set.size) listeners.delete(id)
      }
    },
    [id],
  )

  const getSnapshot = useCallback(() => {
    if (!id) return null
    const entry = entries.get(id)
    return entry ? entry.data : undefined
  }, [id])

  // SSR i hydracja widzą tylko `initial` (albo „ładowanie”) — zgodnie z HTML-em z serwera.
  const getServerSnapshot = useCallback(() => (id ? (initial ?? undefined) : null), [id, initial])

  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (!id) return
    // Dane z serwera odświeżają też inne kafelki tego produktu na stronie.
    if (initial) notify(id)
    else request(id)
  }, [id, initial])

  return data
}
