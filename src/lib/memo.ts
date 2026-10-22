import 'server-only'

/*
 * Bufor wyniku w pamięci procesu (TTL + wspólne oczekiwanie na trwające
 * zapytanie). Dla tras, które celowo NIE są prerenderowane przy budowaniu
 * (`dynamic = 'force-dynamic'`), a mają chronić Sanity przed zapytaniem przy
 * każdym wejściu. Odrzucony wynik nie trafia do bufora — następne wywołanie
 * spróbuje ponownie.
 */
export function memoize<T>(load: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let value: { data: T; until: number } | null = null
  let pending: Promise<T> | null = null
  return () => {
    if (value && value.until > Date.now()) return Promise.resolve(value.data)
    if (pending) return pending
    pending = load()
      .then((data) => {
        value = { data, until: Date.now() + ttlMs }
        return data
      })
      .finally(() => {
        pending = null
      })
    return pending
  }
}
