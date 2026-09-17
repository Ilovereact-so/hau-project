'use client'

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { REVIEW_SUMMARY_BATCH_MAX, isValidProductId, type ReviewSummary } from '@/lib/reviewsShared'

/*
 * Podsumowania opinii dla kafelków produktów.
 *
 * Karuzela renderuje kilkanaście–kilkadziesiąt kafelków naraz. Zamiast
 * żądania na kafelek zbieramy identyfikatory z jednego „ticku” (20 ms)
 * i pytamy /api/reviews/summary jednym żądaniem (porcje po 60). Wyniki
 * trzymamy w pamięci modułu przez minutę — powrót na stronę główną albo
 * druga karuzela z tymi samymi produktami nie odpytuje serwera ponownie.
 */

type Entry = { summary: ReviewSummary | null; fetchedAt: number; failed: boolean }

const FRESH_MS = 60_000
const RETRY_AFTER_FAIL_MS = 30_000
const FLUSH_DELAY_MS = 20

const entries = new Map<string, Entry>()
const listeners = new Map<string, Set<() => void>>()
const queued = new Set<string>()
const inflight = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null

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

async function fetchChunk(ids: string[]) {
  ids.forEach((id) => inflight.add(id))
  try {
    const res = await fetch(`/api/reviews/summary?ids=${ids.map(encodeURIComponent).join(',')}`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = (await res.json()) as { summaries?: Record<string, ReviewSummary> }
    const now = Date.now()
    for (const id of ids) {
      const summary = data.summaries?.[id] ?? { average: 0, count: 0 }
      entries.set(id, { summary, fetchedAt: now, failed: false })
    }
  } catch (err) {
    console.error('[reviews] summary fetch failed', err)
    const now = Date.now()
    for (const id of ids) {
      const prev = entries.get(id)
      // Zostawiamy ostatnią znaną wartość, jeśli była — kafelek nie „gaśnie”.
      entries.set(id, { summary: prev?.summary ?? null, fetchedAt: now, failed: true })
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
  for (let i = 0; i < ids.length; i += REVIEW_SUMMARY_BATCH_MAX) {
    void fetchChunk(ids.slice(i, i + REVIEW_SUMMARY_BATCH_MAX))
  }
}

function request(id: string) {
  if (!needsFetch(id)) return
  queued.add(id)
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
}

/** Wstawia świeże podsumowanie (np. po dodaniu opinii na stronie produktu). */
export function primeReviewSummary(productId: string, summary: ReviewSummary) {
  entries.set(productId, {
    summary: { average: summary.average, count: summary.count },
    fetchedAt: Date.now(),
    failed: false,
  })
  notify(productId)
}

/**
 * Podsumowanie opinii produktu dla komponentów klienckich.
 * `undefined` — jeszcze się ładuje; `null` — nie udało się pobrać.
 *
 * `initial` — wartość policzona już na serwerze (strona produktu). Zasila
 * pamięć podręczną tylko w przeglądarce i tylko, gdy nic w niej nie ma,
 * więc nie powoduje dodatkowego żądania ani nie nadpisuje świeższych danych.
 */
export function useReviewSummary(
  productId: string | null | undefined,
  initial?: ReviewSummary | null,
): ReviewSummary | null | undefined {
  const id = productId && isValidProductId(productId) ? productId : null

  if (id && initial && typeof window !== 'undefined' && !entries.has(id)) {
    entries.set(id, {
      summary: { average: initial.average, count: initial.count },
      fetchedAt: Date.now(),
      failed: false,
    })
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
    return entry ? entry.summary : undefined
  }, [id])

  // SSR i hydracja widzą wyłącznie `initial` (albo stan „ładowanie”), więc
  // pierwszy render przeglądarki zgadza się z HTML-em z serwera. Obiekt jest
  // memoizowany — useSyncExternalStore wymaga stabilnej wartości.
  const initialAverage = initial?.average
  const initialCount = initial?.count
  const serverValue = useMemo<ReviewSummary | null | undefined>(() => {
    if (!id) return null
    if (initialAverage === undefined || initialCount === undefined) return undefined
    return { average: initialAverage, count: initialCount }
  }, [id, initialAverage, initialCount])
  const getServerSnapshot = useCallback(() => serverValue, [serverValue])

  const summary = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    if (id) request(id)
  }, [id])

  return summary
}
