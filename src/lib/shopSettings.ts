/*
 * Ustawienia sklepu widoczne dla klienta (próg darmowej dostawy).
 * Czysta logika — korzystają z niej koszyk i mini koszyk (przeglądarka)
 * oraz kasa (serwer), więc „Gratis” w koszyku = 0 zł w zamówieniu.
 *
 * Źródło: dokument Sanity `shopSettings` (edycja: panel → Dostawy).
 */

export const SHOP_SETTINGS_ID = 'shopSettings'

export type ShopSettings = {
  /** Próg darmowej dostawy w groszach albo `null` (wyłączona). */
  freeShippingThresholdCents: number | null
  /** Najtańsza aktywna metoda dostawy (grosze) — „Dostawa od …” w koszyku. */
  minShippingCents: number | null
}

export const EMPTY_SHOP_SETTINGS: ShopSettings = { freeShippingThresholdCents: null, minShippingCents: null }

/** Dokument z Sanity → ustawienia (nieprawidłowe wartości = wyłączone). */
export function normalizeShopSettings(
  doc: { freeShippingEnabled?: boolean | null; freeShippingThreshold?: number | null } | null | undefined,
  minShippingPrice?: number | null,
): ShopSettings {
  const threshold = doc?.freeShippingThreshold
  const enabled = Boolean(doc?.freeShippingEnabled) && typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0
  return {
    freeShippingThresholdCents: enabled ? Math.round(threshold! * 100) : null,
    minShippingCents:
      typeof minShippingPrice === 'number' && Number.isFinite(minShippingPrice) && minShippingPrice >= 0
        ? Math.round(minShippingPrice * 100)
        : null,
  }
}

/**
 * Czy zamówienie łapie się na darmową dostawę. Liczone od wartości
 * produktów PRZED kodem rabatowym — tak samo w koszyku i w kasie.
 */
export function qualifiesForFreeShipping(settings: ShopSettings, subtotalCents: number): boolean {
  return settings.freeShippingThresholdCents !== null && subtotalCents >= settings.freeShippingThresholdCents
}

/** Ile brakuje do darmowej dostawy (grosze); `null` = brak progu. */
export function missingForFreeShipping(settings: ShopSettings, subtotalCents: number): number | null {
  if (settings.freeShippingThresholdCents === null) return null
  return Math.max(0, settings.freeShippingThresholdCents - subtotalCents)
}
