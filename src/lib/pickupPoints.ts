/*
 * Punkty odbioru (paczkomaty, punkty ORLEN Paczka, Żabki…) — wspólne dla
 * wyszukiwarki punktów w kasie (przeglądarka) i trasy
 * /api/furgonetka/points/search (serwer). Czyste funkcje, bez importów serwerowych.
 */

export type PickupCandidate = {
  code: string
  name: string
  /** kod usługi Furgonetki (inpost, orlen, dpd, poczta…) */
  carrier: string
  /** rodzaj punktu z API (np. paczkomat / punkt w sklepie), jeśli API go podało */
  type?: string | null
  distance: number | null
  street: string
  city: string
  postcode: string
}

/**
 * Kod usługi w aktualnym nazewnictwie Furgonetki. Stare kody z konfiguracji
 * dostaw (paczkomat, kiosk/ruch, placowka…) i nowe (inpost, orlen, poczta…)
 * muszą się dopasować — inaczej punkt ORLEN Paczka nie znalazłby swojej
 * metody dostawy (brak ceny, błąd zamówienia).
 */
export function normalizeServiceCode(code: string | null | undefined): string {
  const value = String(code ?? '').trim().toLowerCase()
  if (!value) return value
  if (value === 'paczkomat' || value === 'inpost_paczkomat') return 'inpost'
  if (value === 'kiosk' || value === 'ruch' || value === 'orlen_paczka' || value === 'orlenpaczka') return 'orlen'
  if (value === 'placowka' || value === 'pocztex' || value === 'poczta_polska') return 'poczta'
  if (value === 'uap') return 'ups'
  if (value === 'parcelshop' || value === 'dhl_pop') return 'dhl'
  if (value === 'dpd_pickup') return 'dpd'
  return value
}

const CARRIER_LABELS: Record<string, string> = {
  inpost: 'InPost',
  orlen: 'ORLEN Paczka',
  dpd: 'DPD Pickup',
  dhl: 'DHL POP',
  poczta: 'Poczta Polska',
  ups: 'UPS Access Point',
  gls: 'GLS',
  fedex: 'FedEx',
}

/** Nazwa przewoźnika do pokazania klientowi. */
export function carrierLabel(carrier: string): string {
  const code = normalizeServiceCode(carrier)
  return CARRIER_LABELS[code] ?? (carrier ? carrier.charAt(0).toUpperCase() + carrier.slice(1) : 'Punkt odbioru')
}

/** „Paczkomat” / „Punkt odbioru” — tylko gdy API podało rodzaj punktu. */
export function pointKindLabel(point: Pick<PickupCandidate, 'type' | 'carrier' | 'name'>): string | null {
  const type = String(point.type ?? '').toLowerCase()
  if (!type) return null
  if (/(machine|locker|automat|paczkomat|apm)/.test(type)) return normalizeServiceCode(point.carrier) === 'inpost' ? 'Paczkomat' : 'Automat paczkowy'
  if (/(point|shop|store|pop|kiosk|punkt|service)/.test(type)) return 'Punkt odbioru'
  return null
}

const byDistance = (a: PickupCandidate, b: PickupCandidate) =>
  (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name, 'pl')

export type PickupGroup = { carrier: string; label: string; points: PickupCandidate[]; total: number }

/**
 * Najbliższe punkty KAŻDEGO przewoźnika (domyślnie 3) — żeby najbliższa
 * Żabka nie zasłaniała paczkomatu dwa kroki dalej ani punktu ORLEN Paczka.
 * Grupy w kolejności najbliższego punktu; w grupie od najbliższego.
 */
export function nearestByCarrier(points: PickupCandidate[], perCarrier = 3): PickupGroup[] {
  const groups = new Map<string, PickupCandidate[]>()
  const seen = new Set<string>()
  for (const point of points) {
    if (!point?.code || seen.has(point.code)) continue
    seen.add(point.code)
    const carrier = normalizeServiceCode(point.carrier) || 'inne'
    groups.set(carrier, [...(groups.get(carrier) ?? []), point])
  }
  return [...groups.entries()]
    .map(([carrier, list]) => {
      const sorted = [...list].sort(byDistance)
      return { carrier, label: carrierLabel(carrier), points: sorted.slice(0, perCarrier), total: sorted.length }
    })
    .sort((a, b) => byDistance(a.points[0], b.points[0]))
}

/** Wszystkie punkty od najbliższego (lista „Pokaż więcej”). */
export function sortedByDistance(points: PickupCandidate[]): PickupCandidate[] {
  const seen = new Set<string>()
  return [...points].filter((p) => p?.code && !seen.has(p.code) && seen.add(p.code)).sort(byDistance)
}

/** Kod pocztowy wpisany w całości (z myślnikiem albo bez) — wtedy szukamy od razu. */
export function isCompletePostcode(value: string): boolean {
  return /^\s*\d{2}-?\d{3}\s*$/.test(value)
}

/** „33100” → „33-100” (API lepiej rozpoznaje zapis z myślnikiem). */
export function formatPostcodeQuery(value: string): string {
  const match = value.trim().match(/^(\d{2})-?(\d{3})$/)
  return match ? `${match[1]}-${match[2]}` : value.trim()
}
