/*
 * Kolejność wartości filtrów/opcji. Sanity zwraca wartości w kolejności
 * dodania, więc rozmiary potrafiły wyjść jako „Duży, Mikro, Średni”.
 * Znane rozmiary (rozmiar psa: mikro → mały → średni → duży oraz litery
 * XS…XXL) układamy rosnąco, ilości z jednostką (250 ml, 1 l, 2 kg) też
 * rosnąco; pozostałe wartości (kolory, smaki) zostają w kolejności z danych.
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

// Ilości z jednostką (pojemność, waga, długość): „250 ml”, „1 l”, „1,5 kg”,
// „500g”, „30 cm”. Przeliczamy do jednostki bazowej, żeby „1 l” było po
// „500 ml”. Wymiar rozróżniamy, żeby nie porównywać litrów z kilogramami.
const UNITS: Record<string, { dim: string; factor: number }> = {
  ml: { dim: 'v', factor: 1 }, cl: { dim: 'v', factor: 10 }, l: { dim: 'v', factor: 1000 },
  mg: { dim: 'm', factor: 0.001 }, g: { dim: 'm', factor: 1 }, dag: { dim: 'm', factor: 10 }, kg: { dim: 'm', factor: 1000 },
  mm: { dim: 'd', factor: 0.1 }, cm: { dim: 'd', factor: 1 }, m: { dim: 'd', factor: 100 },
  szt: { dim: 'n', factor: 1 }, sztuk: { dim: 'n', factor: 1 }, sztuki: { dim: 'n', factor: 1 }, '': { dim: 'n', factor: 1 },
}

/** „1,5 kg” → { dim: 'm', amount: 1500 }; nie-ilość → null. */
export function quantityOf(label: string | null | undefined): { dim: string; amount: number } | null {
  if (!label) return null
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*([a-ząćęłńóśźż.]*)\s*$/i.exec(label)
  if (!match) return null
  const unit = UNITS[match[2].toLowerCase().replace(/\.$/, '')]
  if (!unit) return null
  return { dim: unit.dim, amount: Number(match[1].replace(',', '.')) * unit.factor }
}

/**
 * Stabilnie sortuje listę: znane rozmiary rosnąco, potem ilości z jednostką
 * rosnąco (każdy wymiar osobno), reszta (kolory, smaki) bez zmian kolejności.
 */
export function sortFilterValues<T>(items: T[], label: (item: T) => string | null | undefined): T[] {
  return items
    .map((item, index) => {
      const text = label(item)
      const rank = sizeRank(text)
      return { item, index, rank, quantity: rank === null ? quantityOf(text) : null }
    })
    .sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank || a.index - b.index
      if (a.rank !== null) return -1
      if (b.rank !== null) return 1
      if (a.quantity && b.quantity) {
        if (a.quantity.dim !== b.quantity.dim) return a.quantity.dim < b.quantity.dim ? -1 : 1
        return a.quantity.amount - b.quantity.amount || a.index - b.index
      }
      if (a.quantity) return -1
      if (b.quantity) return 1
      return a.index - b.index
    })
    .map(({ item }) => item)
}
