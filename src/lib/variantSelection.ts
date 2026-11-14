/*
 * Wybór wariantu na karcie produktu — czysta logika (testowalna, bez Reacta).
 *
 * Opcje wyboru to filtry z `productOptions` produktu (kolor, rozmiar psa,
 * pojemność… — dowolny filtr dodany w Sanity / imporcie CSV). Wartości do
 * wyboru bierzemy z WARIANTÓW, nie z parametrów produktu (`filterValues`):
 * parametr może mieć wartość, dla której nie ma wariantu do kupienia.
 */

type ValueRef = { _id?: string | null; value?: string | null; slug?: { current?: string | null } | null } | null | undefined

type OptionValueLike = {
  name?: { _id?: string | null; key?: string | null } | null
  value?: ValueRef
} | null | undefined

type VariantLike = { _key?: string | null; optionValues?: OptionValueLike[] | null } | null | undefined

type FilterValueLike = { _id?: string | null; filter?: { _ref?: string | null } | null; value?: string | null; slug?: { current?: string | null } | null } | null | undefined

const slugOf = (value: ValueRef) => value?.slug?.current ?? null

/** Mapa opcji wariantu: klucz filtra → slug wartości. */
export function optionsOf(variant: VariantLike): Record<string, string> {
  const map: Record<string, string> = {}
  for (const option of variant?.optionValues ?? []) {
    const key = option?.name?.key
    const slug = slugOf(option?.value)
    if (key && slug) map[key] = slug
  }
  return map
}

/**
 * Wartości opcji `key`, które występują w wariantach — w kolejności
 * parametrów produktu (`filterValues`, czyli kolejności z importu), a te,
 * których tam nie ma (np. wariant dopisany w Studio), na końcu.
 */
export function optionChoices<F extends FilterValueLike>(
  variants: readonly VariantLike[] | null | undefined,
  filterValues: readonly F[] | null | undefined,
  key: string | null | undefined,
): Array<{ _id: string; value: string | null; slug: { current: string } }> {
  if (!key) return []
  const found = new Map<string, { _id: string; value: string | null; slug: { current: string } }>()
  for (const variant of variants ?? []) {
    for (const option of variant?.optionValues ?? []) {
      const slug = slugOf(option?.value)
      if (option?.name?.key !== key || !slug || found.has(slug)) continue
      found.set(slug, { _id: option.value?._id ?? `${key}-${slug}`, value: option.value?.value ?? slug, slug: { current: slug } })
    }
  }
  const ordered: Array<{ _id: string; value: string | null; slug: { current: string } }> = []
  for (const fv of filterValues ?? []) {
    const slug = fv?.slug?.current
    const hit = slug ? found.get(slug) : undefined
    if (hit) {
      ordered.push({ ...hit, value: fv?.value ?? hit.value })
      found.delete(slug!)
    }
  }
  return [...ordered, ...found.values()]
}

/**
 * Wariant po zmianie jednej opcji. Najpierw dokładna kombinacja (reszta opcji
 * bez zmian). Gdy jej nie ma — np. mięta jest tylko w rozmiarze M, a wybrany
 * był L — wariant z nową wartością, który zgadza się z największą liczbą
 * pozostałych opcji (remis: pierwszy z listy). Dzięki temu kliknięcie zawsze
 * coś wybiera, zamiast cicho nic nie robić.
 */
export function pickVariant(
  variants: readonly VariantLike[] | null | undefined,
  current: Record<string, string>,
  key: string,
  value: string,
): string | undefined {
  const withValue = (variants ?? []).filter((variant) => variant?._key && optionsOf(variant)[key] === value)
  if (!withValue.length) return undefined
  const wanted = { ...current, [key]: value }
  let best: { key: string; score: number } | undefined
  for (const variant of withValue) {
    const options = optionsOf(variant)
    const entries = Object.entries(options)
    const exact = entries.length === Object.keys(wanted).length && entries.every(([k, v]) => wanted[k] === v)
    if (exact) return variant!._key!
    const score = entries.filter(([k, v]) => k !== key && current[k] === v).length
    if (!best || score > best.score) best = { key: variant!._key!, score }
  }
  return best?.key
}
