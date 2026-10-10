/*
 * Kolejność wartości filtrów/opcji. Sanity zwraca wartości w kolejności
 * dodania, więc rozmiary potrafiły wyjść jako „Duży, Mikro, Średni”.
 * Znane rozmiary (rozmiar psa: mikro → mały → średni → duży oraz litery
 * XS…XXL) układamy rosnąco; pozostałe wartości (kolory, smaki) zostają
 * w kolejności z danych, za rozmiarami.
 */

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const SIZE_RANK: Record<string, number> = {
  mikro: 0,
  micro: 0,
  mini: 0,
  xxs: 0,
  xs: 1,
  maly: 2,
  'dla malych psow': 2,
  s: 2,
  sredni: 3,
  'dla srednich psow': 3,
  m: 3,
  duzy: 4,
  'dla duzych psow': 4,
  l: 4,
  'bardzo duzy': 5,
  xl: 5,
  xxl: 6,
}

export function sizeRank(label: string | null | undefined): number | null {
  if (!label) return null
  const rank = SIZE_RANK[normalize(label)]
  return rank === undefined ? null : rank
}

/** Stabilnie sortuje listę: znane rozmiary rosnąco, reszta bez zmian kolejności. */
export function sortFilterValues<T>(items: T[], label: (item: T) => string | null | undefined): T[] {
  return items
    .map((item, index) => ({ item, index, rank: sizeRank(label(item)) }))
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank || a.index - b.index
      if (a.rank !== null) return -1
      if (b.rank !== null) return 1
      return a.index - b.index
    })
    .map(({ item }) => item)
}
