/*
 * Ustawienia sklepu widoczne dla klienta (próg darmowej dostawy, linki do
 * mediów społecznościowych).
 * Czysta logika — korzystają z niej koszyk i mini koszyk (przeglądarka)
 * oraz kasa (serwer), więc „Gratis” w koszyku = 0 zł w zamówieniu.
 *
 * Źródło: dokument Sanity `shopSettings` (edycja: panel → Dostawy;
 * linki social — panel → Marketing → Strona główna).
 */

export const SHOP_SETTINGS_ID = 'shopSettings'

export const SOCIAL_NETWORKS = ['facebook', 'instagram', 'tiktok'] as const
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]
export type SocialLinks = Record<SocialNetwork, string | null>

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
}

/** Domeny, pod które może prowadzić dany link (chroni przed literówką w panelu). */
const SOCIAL_HOSTS: Record<SocialNetwork, string[]> = {
  facebook: ['facebook.com', 'fb.com', 'fb.me'],
  instagram: ['instagram.com', 'instagr.am'],
  tiktok: ['tiktok.com'],
}

export const EMPTY_SOCIAL_LINKS: SocialLinks = { facebook: null, instagram: null, tiktok: null }

/**
 * Link do profilu: dopisuje https://, przyjmuje „@nazwa” dla Instagrama
 * i TikToka. `null` = pusty albo nie prowadzi do właściwego serwisu.
 */
export function normalizeSocialUrl(network: SocialNetwork, input: unknown): string | null {
  let text = String(input ?? '').trim()
  if (!text) return null
  if (text.startsWith('@') && network !== 'facebook') {
    const handle = text.slice(1).replace(/[^A-Za-z0-9._]/g, '')
    if (!handle) return null
    text = network === 'instagram' ? `https://www.instagram.com/${handle}/` : `https://www.tiktok.com/@${handle}`
  }
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '')
  if (!SOCIAL_HOSTS[network].some((allowed) => host === allowed || host.endsWith(`.${allowed}`))) return null
  url.protocol = 'https:'
  return url.toString().slice(0, 300)
}

export function normalizeSocialLinks(input: Partial<Record<SocialNetwork, unknown>> | null | undefined): SocialLinks {
  return {
    facebook: normalizeSocialUrl('facebook', input?.facebook),
    instagram: normalizeSocialUrl('instagram', input?.instagram),
    tiktok: normalizeSocialUrl('tiktok', input?.tiktok),
  }
}

export const hasSocialLinks = (links: SocialLinks | null | undefined) => Boolean(links && SOCIAL_NETWORKS.some((n) => links[n]))

export type ShopSettings = {
  /** Próg darmowej dostawy w groszach albo `null` (wyłączona). */
  freeShippingThresholdCents: number | null
  /** Najtańsza aktywna metoda dostawy (grosze) — „Dostawa od …” w koszyku. */
  minShippingCents: number | null
  /** Profile sklepu w mediach społecznościowych (stopka, strona główna). */
  social: SocialLinks
}

export const EMPTY_SHOP_SETTINGS: ShopSettings = { freeShippingThresholdCents: null, minShippingCents: null, social: EMPTY_SOCIAL_LINKS }

type ShopSettingsDoc = {
  freeShippingEnabled?: boolean | null
  freeShippingThreshold?: number | null
  socialFacebook?: string | null
  socialInstagram?: string | null
  socialTiktok?: string | null
}

/** Dokument z Sanity → ustawienia (nieprawidłowe wartości = wyłączone). */
export function normalizeShopSettings(
  doc: ShopSettingsDoc | null | undefined,
  minShippingPrice?: number | null,
): ShopSettings {
  const threshold = doc?.freeShippingThreshold
  const enabled = Boolean(doc?.freeShippingEnabled) && typeof threshold === 'number' && Number.isFinite(threshold) && threshold >= 0
  return {
    social: normalizeSocialLinks({ facebook: doc?.socialFacebook, instagram: doc?.socialInstagram, tiktok: doc?.socialTiktok }),
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
