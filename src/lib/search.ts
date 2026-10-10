/*
 * Wyszukiwarka produktów — dopasowanie i ranking (czysta logika).
 *
 * Szukamy nie tylko w nazwie: także w marce, kategorii i podkategorii,
 * tagach, SKU, podtytule, krótkim opisie i pełnym opisie produktu.
 * Zasady:
 *  - KAŻDE słowo z frazy musi się gdzieś znaleźć („miska ceramiczna” nie
 *    zwróci wszystkich misek ani wszystkiego, co ceramiczne);
 *  - bez wielkości liter i polskich znaków („smycz” = „Smycz”, „zolta” = „żółta”);
 *  - prosta odmiana: słowa od 5 liter dopasowujemy po rdzeniu (bez 1–2
 *    ostatnich liter), więc „zabawki” znajdzie „zabawka”, a „miski” — „miska”;
 *  - wynik: nazwa waży najwięcej, potem marka/kategoria/tagi/SKU, na końcu
 *    opisy — produkt z frazą w nazwie zawsze wyprzedzi ten, który ma ją
 *    tylko w opisie.
 */

export type SearchIndexEntry = {
  _id: string
  title: string
  subtitle?: string | null
  brand?: string | null
  sku?: string | null
  tags?: string[] | null
  category?: string | null
  subcategory?: string | null
  shortDescription?: string | null
  /** Pełny opis jako zwykły tekst (`pt::text(description)`). */
  body?: string | null
}

export const SEARCH_MIN_QUERY = 2
const MAX_TOKENS = 6

export function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Słowa frazy (bez powtórzeń, maks. 6). Jednoznakowe pomijamy (szum). */
export function searchTokens(query: string): string[] {
  const words = normalizeSearchText(query).split(' ').filter((word) => word.length >= 2)
  return [...new Set(words)].slice(0, MAX_TOKENS)
}

// Rdzeń do prostej odmiany: 5–6 liter → bez ostatniej, 7+ → bez dwóch
// („miski” → „misk”, „zabawki” → „zabaw”). Krótszych słów nie skracamy.
const root = (token: string) => (token.length >= 7 ? token.slice(0, -2) : token.length >= 5 ? token.slice(0, -1) : token)

type FieldMatch = 0 | 1 | 2 | 3 // brak / w środku słowa / rdzeń / początek słowa

function matchField(words: string[], joined: string, token: string): FieldMatch {
  if (!joined) return 0
  let best: FieldMatch = 0
  const stem = root(token)
  for (const word of words) {
    if (word.startsWith(token)) return 3
    if (stem !== token && word.startsWith(stem)) best = 2
  }
  if (best) return best
  // Fragment w środku słowa — tylko dla dłuższych słów (krótkie dają szum).
  return token.length >= 3 && joined.includes(token) ? 1 : 0
}

type PreparedField = { words: string[]; joined: string; weight: number }

const WEIGHTS = {
  title: 10,
  brand: 5,
  subcategory: 5,
  category: 4,
  tags: 4,
  sku: 4,
  subtitle: 3,
  shortDescription: 2,
  body: 1,
} as const

function prepare(entry: SearchIndexEntry): PreparedField[] {
  const field = (value: string | null | undefined, weight: number): PreparedField => {
    const joined = normalizeSearchText(value)
    return { words: joined ? joined.split(' ') : [], joined, weight }
  }
  return [
    field(entry.title, WEIGHTS.title),
    field(entry.brand, WEIGHTS.brand),
    field(entry.subcategory, WEIGHTS.subcategory),
    field(entry.category, WEIGHTS.category),
    field((entry.tags ?? []).join(' '), WEIGHTS.tags),
    field(entry.sku, WEIGHTS.sku),
    field(entry.subtitle, WEIGHTS.subtitle),
    field(entry.shortDescription, WEIGHTS.shortDescription),
    field(entry.body, WEIGHTS.body),
  ]
}

/** Punkty dopasowania (0 = nie pasuje — brakuje któregoś słowa). */
export function scoreEntry(entry: SearchIndexEntry, tokens: string[]): number {
  if (!tokens.length) return 0
  const fields = prepare(entry)
  let total = 0
  for (const token of tokens) {
    let best = 0
    for (const field of fields) {
      const match = matchField(field.words, field.joined, token)
      if (match) best = Math.max(best, field.weight * match)
    }
    if (!best) return 0
    total += best
  }
  // Cała fraza na początku nazwy — premia (np. „miska” → „Miska ceramiczna…”).
  const title = normalizeSearchText(entry.title)
  const phrase = tokens.join(' ')
  if (title.startsWith(phrase)) total += 15
  else if (title.includes(phrase)) total += 8
  return total
}

/** Produkty pasujące do frazy, od najlepszego dopasowania. */
export function searchEntries(entries: SearchIndexEntry[], query: string, limit = 200): Array<{ id: string; score: number }> {
  const tokens = searchTokens(query)
  if (!tokens.length) return []
  const collator = new Intl.Collator('pl', { sensitivity: 'base' })
  return entries
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || collator.compare(a.entry.title, b.entry.title))
    .slice(0, limit)
    .map((hit) => ({ id: hit.entry._id, score: hit.score }))
}
