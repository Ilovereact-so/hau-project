/*
 * Zgody na cookies (RODO / art. 173 Prawa telekomunikacyjnego).
 *
 * Zasada: bez zgody działają WYŁĄCZNIE cookies niezbędne (koszyk, sesja,
 * zabezpieczenia). Skrypty analityczne i marketingowe ładują się dopiero
 * po wyraźnej zgodzie i dają się wycofać — dlatego wybór trzymamy w zwykłym
 * ciasteczku (a nie w localStorage): jest czytelny dla serwera i wygasa sam.
 *
 * Moduł jest czysty (bez importów serwerowych) — korzysta z niego baner
 * w przeglądarce i ewentualny kod serwerowy czytający ciasteczko.
 */

export const CONSENT_COOKIE = 'hau_cookie_consent'
/** Zmiana wersji = ponowne pytanie o zgodę (np. gdy dojdzie nowa kategoria). */
export const CONSENT_VERSION = 1
/** 12 miesięcy — tyle, ile rekomenduje UODO dla zapamiętanej zgody. */
export const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60

export const CONSENT_CATEGORIES = ['necessary', 'analytics', 'marketing'] as const
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number]

/** Kategorie, o które pytamy (niezbędne są zawsze włączone). */
export const OPTIONAL_CATEGORIES = ['analytics', 'marketing'] as const satisfies ReadonlyArray<ConsentCategory>

export type ConsentState = {
  version: number
  analytics: boolean
  marketing: boolean
  /** Kiedy zapadła decyzja (ISO) — dowód zgody. */
  decidedAt: string
}

export const CONSENT_LABELS: Record<ConsentCategory, { title: string; description: string }> = {
  necessary: {
    title: 'Niezbędne',
    description:
      'Konieczne, żeby sklep działał: koszyk, logowanie, bezpieczeństwo płatności i zapamiętanie Twojego wyboru zgód. Nie da się ich wyłączyć.',
  },
  analytics: {
    title: 'Analityczne',
    description:
      'Anonimowe statystyki odwiedzin (Google Analytics) — pokazują, które strony są przydatne, a które wymagają poprawy.',
  },
  marketing: {
    title: 'Marketingowe',
    description:
      'Dopasowanie reklam i mierzenie ich skuteczności poza sklepem. Włączamy je tylko wtedy, gdy wyrazisz zgodę.',
  },
}

export const ALL_DENIED: Omit<ConsentState, 'decidedAt'> = { version: CONSENT_VERSION, analytics: false, marketing: false }
export const ALL_GRANTED: Omit<ConsentState, 'decidedAt'> = { version: CONSENT_VERSION, analytics: true, marketing: true }

/** Zdarzenie emitowane po każdej zmianie zgody (nasłuchują go skrypty). */
export const CONSENT_EVENT = 'hau:consent-change'
/** Zdarzenie otwierające panel ustawień (link w stopce). */
export const CONSENT_OPEN_EVENT = 'hau:consent-open'

export function parseConsent(raw: string | null | undefined): ConsentState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<ConsentState>
    if (typeof value !== 'object' || value === null) return null
    // Stara wersja zgody = pytamy od nowa.
    if (value.version !== CONSENT_VERSION) return null
    return {
      version: CONSENT_VERSION,
      analytics: value.analytics === true,
      marketing: value.marketing === true,
      decidedAt: typeof value.decidedAt === 'string' ? value.decidedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export function serializeConsent(state: ConsentState): string {
  return encodeURIComponent(JSON.stringify(state))
}

/** Odczyt zgody z `document.cookie` (tylko w przeglądarce). */
export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=([^;]*)`))
  return parseConsent(match?.[1])
}

/** Zapis zgody i powiadomienie nasłuchujących skryptów. */
export function writeConsentCookie(input: Omit<ConsentState, 'decidedAt'> & { decidedAt?: string }): ConsentState {
  const state: ConsentState = {
    version: CONSENT_VERSION,
    analytics: input.analytics,
    marketing: input.marketing,
    decidedAt: input.decidedAt ?? new Date().toISOString(),
  }
  if (typeof document !== 'undefined') {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CONSENT_COOKIE}=${serializeConsent(state)}; Path=/; Max-Age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secure}`
    window.dispatchEvent(new CustomEvent<ConsentState>(CONSENT_EVENT, { detail: state }))
  }
  return state
}

/** Otwiera panel ustawień cookies (np. z linku w stopce). */
export function openConsentSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}
