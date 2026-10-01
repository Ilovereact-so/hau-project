/*
 * Środowisko Furgonetki — JEDNO dla mapy punktów (przeglądarka) i API
 * (lib/furgonetka.ts). Klucz mapy, dane OAuth i token są wydawane osobno
 * w piaskownicy i na produkcji: klucz z piaskownicy wysłany do
 * api.furgonetka.pl kończy się 403 na /points/map (tak było na stagingu,
 * gdy środowisko wynikało z NODE_ENV, a konto było z piaskownicy).
 *
 * NEXT_PUBLIC_FURGONETKA_ENV = sandbox | production. Jest wkompilowywana przy
 * budowaniu (także w kod serwera), więc ustawia się ją w środowisku builda.
 * Bez niej: produkcja dla buildu produkcyjnego, piaskownica w dev.
 * Bez importów serwerowych — czyta to też komponent mapy.
 */
export type FurgonetkaEnv = 'sandbox' | 'production'

function resolveEnv(): FurgonetkaEnv {
  const value = (process.env.NEXT_PUBLIC_FURGONETKA_ENV ?? '').trim().toLowerCase()
  if (value === 'sandbox' || value === 'production') return value
  return process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
}

export const FURGONETKA_ENV: FurgonetkaEnv = resolveEnv()

export const FURGONETKA_API_URL =
  FURGONETKA_ENV === 'production' ? 'https://api.furgonetka.pl' : 'https://api.sandbox.furgonetka.pl'

/** Panel Furgonetki (koszyk, regulaminy przewoźników) — w tym samym środowisku co API. */
export const FURGONETKA_PANEL_URL =
  FURGONETKA_ENV === 'production' ? 'https://furgonetka.pl' : 'https://sandbox.furgonetka.pl'
