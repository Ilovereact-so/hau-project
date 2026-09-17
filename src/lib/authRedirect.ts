// Bezpieczne przekierowania po zalogowaniu (tylko ta sama domena).
// Moduł kliencki — używa window/sessionStorage wyłącznie w funkcjach.

const STORAGE_KEY = 'hau:post-auth-redirect'

// Ścieżki, na które nie ma sensu wracać po zalogowaniu.
const AUTH_PATHS = ['/sign-in', '/sign-up', '/sso-callback', '/verify-email', '/reset-password']

/**
 * Zwraca bezpieczną ścieżkę względną (`/a/b?x=1#y`) albo null.
 * Akceptuje ścieżki względne i pełne adresy z tej samej domeny
 * (middleware podaje pełny URL w `redirect_url`).
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw || typeof window === 'undefined') return null
  // "//evil.com" i "/\evil.com" przeglądarki traktują jak adres innej domeny.
  if (/^\/[\\/]/.test(raw)) return null
  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (AUTH_PATHS.some(p => url.pathname === p || url.pathname.startsWith(`${p}/`))) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export function currentPath(): string {
  if (typeof window === 'undefined') return '/'
  const { pathname, search, hash } = window.location
  return `${pathname}${search}${hash}`
}

/** `redirect_url` z paska adresu (strony /sign-in, /sign-up). */
export function redirectFromQuery(): string | null {
  if (typeof window === 'undefined') return null
  return sanitizeRedirect(new URLSearchParams(window.location.search).get('redirect_url'))
}

/** Zapamiętuje cel na czas przekierowań OAuth / weryfikacji e-maila. */
export function rememberPostAuthRedirect(path: string | null) {
  try {
    const safe = sanitizeRedirect(path)
    if (safe) sessionStorage.setItem(STORAGE_KEY, safe)
    else      sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* tryb prywatny / zablokowany storage — wracamy na fallback */
  }
}

export function consumePostAuthRedirect(fallback = '/'): string {
  try {
    const value = sanitizeRedirect(sessionStorage.getItem(STORAGE_KEY))
    sessionStorage.removeItem(STORAGE_KEY)
    return value ?? fallback
  } catch {
    return fallback
  }
}
