'use client'

import { useEffect, useState } from 'react'
import { EMPTY_SHOP_SETTINGS, type ShopSettings } from '@/lib/shopSettings'

/*
 * Ustawienia koszyka (próg darmowej dostawy) dla koszyka, mini koszyka
 * i kasy. Jedno żądanie na kartę przeglądarki (pamięć modułu, 5 min).
 */

const FRESH_MS = 5 * 60_000
let cache: { data: ShopSettings; at: number } | null = null
let inflight: Promise<ShopSettings> | null = null

async function load(): Promise<ShopSettings> {
  if (cache && Date.now() - cache.at < FRESH_MS) return cache.data
  if (inflight) return inflight
  inflight = fetch('/api/shop-settings')
    .then((res) => (res.ok ? res.json() : EMPTY_SHOP_SETTINGS))
    .then((data: ShopSettings) => {
      const clean: ShopSettings = {
        freeShippingThresholdCents: typeof data?.freeShippingThresholdCents === 'number' ? data.freeShippingThresholdCents : null,
        minShippingCents: typeof data?.minShippingCents === 'number' ? data.minShippingCents : null,
      }
      cache = { data: clean, at: Date.now() }
      return clean
    })
    .catch(() => EMPTY_SHOP_SETTINGS)
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** `null` — jeszcze się ładuje. */
export function useShopSettings(): ShopSettings | null {
  const [settings, setSettings] = useState<ShopSettings | null>(cache?.data ?? null)
  useEffect(() => {
    let active = true
    void load().then((data) => {
      if (active) setSettings(data)
    })
    return () => {
      active = false
    }
  }, [])
  return settings
}
