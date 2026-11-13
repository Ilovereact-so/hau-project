/*
 * Menu sklepu: kolejność i widoczność kategorii oraz podkategorii.
 *
 * Dane leżą w samych dokumentach Sanity (`category`, `subcategory`):
 *   - `menuOrder` — liczba, mniejsza = wyżej/wcześniej (panel zapisuje 10, 20, 30…),
 *   - `menuHidden` — `true` = nie pokazuj w nawigacji sklepu.
 * Ustawia je panel (Produkty → Menu sklepu, `/admin/menu`); w Studio pole
 * „Ukryj w menu” też działa.
 *
 * „Ukryta” znaczy: nie ma jej w menu (komputer i telefon), w pigułkach
 * podkategorii na stronie kategorii ani w kafelkach podkategorii na stronie
 * głównej. Strona kategorii/podkategorii nadal działa pod swoim adresem
 * (linki z kampanii, Google), a produkty są normalnie w wyszukiwarce i na
 * listingach. Ukrycie kategorii ukrywa w menu też wszystkie jej podkategorie.
 *
 * Kolejność bez ustawionego `menuOrder` = kolejność `_id` — tak Sanity zwraca
 * dokumenty bez `order()`, więc menu wygląda jak przed wprowadzeniem tej
 * funkcji, dopóki ktoś nie zapisze własnej kolejności. Sortujemy w JS, nie
 * w GROQ: lista jest krótka, a zachowanie `null` w `order()` nie jest
 * gwarantowane.
 *
 * Moduł czysty (bez importów serwerowych) — używa go serwer (navbar, strona
 * kategorii, zapis w panelu) i przeglądarka (kafelki na stronie głównej,
 * edytor w panelu).
 */

export type MenuFields = {
  menuOrder?: number | null
  menuHidden?: boolean | null
}

/** Pola do dopisania w projekcji GROQ kategorii/podkategorii. */
export const MENU_FIELDS_GROQ = 'menuOrder, menuHidden'

/** Odstęp między kolejnymi pozycjami — w Studio da się ręcznie wstawić coś pomiędzy. */
export const MENU_ORDER_STEP = 10

export type MenuSortable = MenuFields & { _id?: string | null; id?: string | null }

const orderValue = (item: MenuSortable) =>
  typeof item.menuOrder === 'number' && Number.isFinite(item.menuOrder) ? item.menuOrder : Number.POSITIVE_INFINITY

const idValue = (item: MenuSortable) => String(item._id ?? item.id ?? '')

/** Porównanie do sortowania: `menuOrder` rosnąco, bez numeru na końcu, remis — `_id` (jak Sanity). */
export function compareMenuOrder(a: MenuSortable, b: MenuSortable): number {
  const byOrder = orderValue(a) - orderValue(b)
  if (byOrder !== 0 && !Number.isNaN(byOrder)) return byOrder
  const ia = idValue(a)
  const ib = idValue(b)
  return ia < ib ? -1 : ia > ib ? 1 : 0
}

export const isHiddenInMenu = (item: MenuFields | null | undefined) => item?.menuHidden === true

/** Kopia listy w kolejności menu (bez filtrowania). */
export function sortForMenu<T extends MenuSortable>(items: readonly T[] | null | undefined): T[] {
  return [...(items ?? [])].sort(compareMenuOrder)
}

/** Lista do pokazania klientowi: kolejność menu, bez ukrytych. */
export function visibleInMenu<T extends MenuSortable>(items: readonly T[] | null | undefined): T[] {
  return sortForMenu(items).filter((item) => !isHiddenInMenu(item))
}

/**
 * Drzewo do menu: kategorie i ich podkategorie posortowane, ukryte usunięte
 * (razem z podkategoriami ukrytej kategorii).
 */
type SubcategoryOf<C> = C extends { subcategory?: readonly (infer S)[] | null } ? S : never

export function buildMenuTree<C extends MenuSortable & { subcategory?: readonly MenuSortable[] | null }>(
  categories: readonly C[] | null | undefined,
): Array<Omit<C, 'subcategory'> & { subcategory: SubcategoryOf<C>[] }> {
  return visibleInMenu(categories).map((category) => ({
    ...category,
    subcategory: visibleInMenu((category.subcategory ?? []) as readonly SubcategoryOf<C>[]),
  }))
}

// ─── zapis z panelu ──────────────────────────────────────────────────────────

export type MenuLayoutInput = {
  categories: Array<{
    id: string
    hidden: boolean
    subcategories: Array<{ id: string; hidden: boolean }>
  }>
}

/** Stan dokumentu w Sanity potrzebny do zaplanowania zapisu. */
export type MenuDocState = {
  id: string
  kind: 'category' | 'subcategory'
  /** Rodzic podkategorii (`parent._ref`), dla kategorii `null`. */
  parentId: string | null
  menuOrder: number | null
  menuHidden: boolean
}

export type MenuChange = {
  id: string
  set: { menuOrder?: number; menuHidden?: true }
  unset: Array<'menuHidden'>
}

const MAX_CATEGORIES = 200
const MAX_SUBCATEGORIES = 2000

/**
 * Porównuje układ z panelu ze stanem w Sanity i zwraca TYLKO potrzebne zmiany
 * (dokument bez zmian nie dostaje nowego `_updatedAt`). Rzuca błąd z czytelnym
 * komunikatem, gdy wejście jest niespójne: nieznany lub zdublowany dokument,
 * podkategoria pod cudzą kategorią (np. ktoś przeniósł ją w Studio w czasie
 * edycji) — wtedy panel prosi o odświeżenie zamiast zapisywać połowę.
 *
 * Dokumenty, których nie ma w wejściu (np. dodane w Studio po otwarciu
 * panelu), zostają nietknięte.
 */
export function planMenuChanges(current: readonly MenuDocState[], input: unknown): MenuChange[] {
  const layout = parseMenuLayout(input)
  const byId = new Map(current.map((doc) => [doc.id, doc]))
  const seen = new Set<string>()
  const changes: MenuChange[] = []

  const plan = (doc: MenuDocState, order: number, hidden: boolean) => {
    const set: MenuChange['set'] = {}
    const unset: MenuChange['unset'] = []
    if (doc.menuOrder !== order) set.menuOrder = order
    if (hidden && !doc.menuHidden) set.menuHidden = true
    if (!hidden && doc.menuHidden) unset.push('menuHidden')
    if (Object.keys(set).length || unset.length) changes.push({ id: doc.id, set, unset })
  }

  const take = (id: string, kind: MenuDocState['kind']) => {
    if (seen.has(id)) throw new Error('Ta sama pozycja jest w menu dwa razy — odśwież stronę i spróbuj ponownie.')
    seen.add(id)
    const doc = byId.get(id)
    if (!doc || doc.kind !== kind) {
      throw new Error(`${kind === 'category' ? 'Kategoria' : 'Podkategoria'} z menu nie istnieje już w Sanity (mogła zostać usunięta) — odśwież stronę.`)
    }
    return doc
  }

  layout.categories.forEach((entry, index) => {
    const category = take(entry.id, 'category')
    plan(category, (index + 1) * MENU_ORDER_STEP, entry.hidden)
    entry.subcategories.forEach((subEntry, subIndex) => {
      const sub = take(subEntry.id, 'subcategory')
      if (sub.parentId !== category.id) {
        throw new Error('Podkategoria zmieniła kategorię nadrzędną (np. w Studio) — odśwież stronę, żeby zobaczyć aktualne menu.')
      }
      plan(sub, (subIndex + 1) * MENU_ORDER_STEP, subEntry.hidden)
    })
  })
  return changes
}

/** Walidacja kształtu danych z przeglądarki (akcja serwera dostaje dowolny JSON). */
export function parseMenuLayout(input: unknown): MenuLayoutInput {
  const fail = () => {
    throw new Error('Nieprawidłowe dane menu — odśwież stronę i spróbuj ponownie.')
  }
  const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
  const isId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(value) && !value.startsWith('drafts.')
  if (!isRecord(input) || !Array.isArray(input.categories)) fail()
  const raw = (input as { categories: unknown[] }).categories
  if (raw.length > MAX_CATEGORIES) fail()
  let subTotal = 0
  const categories = raw.map((entry) => {
    if (!isRecord(entry) || !isId(entry.id) || typeof entry.hidden !== 'boolean' || !Array.isArray(entry.subcategories)) fail()
    const item = entry as { id: string; hidden: boolean; subcategories: unknown[] }
    subTotal += item.subcategories.length
    if (subTotal > MAX_SUBCATEGORIES) fail()
    return {
      id: item.id,
      hidden: item.hidden,
      subcategories: item.subcategories.map((sub) => {
        if (!isRecord(sub) || !isId(sub.id) || typeof sub.hidden !== 'boolean') fail()
        return { id: (sub as { id: string }).id, hidden: (sub as { hidden: boolean }).hidden }
      }),
    }
  })
  return { categories }
}
