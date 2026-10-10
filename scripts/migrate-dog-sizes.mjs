#!/usr/bin/env node
/*
 * Rozmiary S / M / L → rozmiar psa (Mikro / Mały / Średni / Duży).
 *
 * Uruchomienie (z katalogu projektu, korzysta z .env — SANITY_API_TOKEN):
 *   node scripts/migrate-dog-sizes.mjs            ← SUCHA PRÓBA: tylko pokazuje plan
 *   node scripts/migrate-dog-sizes.mjs --apply    ← zapisuje zmiany w Sanity
 *
 * Co robi:
 *  1. Szuka filtra rozmiaru (key: size / rozmiar albo etykieta „Rozmiar…”)
 *     i zmienia jego etykietę na „Rozmiar psa”.
 *  2. Wartości tego filtra przemianowuje wg mapy niżej — ZOSTAWIA ich `_id`,
 *     więc produkty, warianty i zdjęcia przypisane do wariantów nadal działają.
 *     Zmienia się nazwa i slug (adres filtra: ?size=maly zamiast ?size=s).
 *  3. Dopisuje brakujące wartości (np. „Mikro”), żeby były do wyboru.
 *  4. Poprawia pomocnicze etykiety wariantów (`optionValues[].label`,
 *     `indexedOptions`) w produktach — opublikowanych i szkicach.
 *
 * MAPA jest decyzją biznesową — sprawdź ją przed `--apply` (zmienisz ją niżej).
 * Wartości spoza mapy zostają bez zmian i są wypisane w raporcie.
 */
import 'dotenv/config'
import { createClient } from '@sanity/client'

const APPLY = process.argv.includes('--apply')

// stara wartość (bez wielkości liter) → nowa nazwa + slug
const MAP = {
  xs: { value: 'Mikro', slug: 'mikro' },
  s: { value: 'Mały', slug: 'maly' },
  m: { value: 'Średni', slug: 'sredni' },
  l: { value: 'Duży', slug: 'duzy' },
}
// Wartości, które mają istnieć po migracji (kolejność w sklepie ustawia sam sklep).
const TARGET = [
  { value: 'Mikro', slug: 'mikro' },
  { value: 'Mały', slug: 'maly' },
  { value: 'Średni', slug: 'sredni' },
  { value: 'Duży', slug: 'duzy' },
]
const FILTER_LABEL = 'Rozmiar psa'

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
const token = process.env.SANITY_API_TOKEN
if (!projectId || !dataset || !token) {
  console.error('Brak NEXT_PUBLIC_SANITY_PROJECT_ID / NEXT_PUBLIC_SANITY_DATASET / SANITY_API_TOKEN w .env')
  process.exit(1)
}

const client = createClient({ projectId, dataset, token, apiVersion: '2025-10-11', useCdn: false, perspective: 'raw' })
const norm = (v) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
const baseId = (id) => id.replace(/^drafts\./, '')

const filters = await client.fetch(`*[_type == "filter"]{ _id, key, label }`)
const sizeFilters = filters.filter(
  (f) => ['size', 'rozmiar', 'rozmiar-psa'].includes(norm(f.key)) || /rozmiar/i.test(f.label ?? ''),
)
if (!sizeFilters.length) {
  console.log('Nie znaleziono filtra rozmiaru (key: size/rozmiar). Nic do zrobienia.')
  process.exit(0)
}

const tx = client.transaction()
let changes = 0
const renamedLabels = new Map() // _id wartości → nowa nazwa

for (const filter of sizeFilters) {
  const id = baseId(filter._id)
  console.log(`\nFiltr: ${filter.label ?? filter.key} (${filter._id})`)
  if (!filter._id.startsWith('drafts.') && filter.label !== FILTER_LABEL) {
    console.log(`  etykieta: „${filter.label}” → „${FILTER_LABEL}”`)
    tx.patch(filter._id, { set: { label: FILTER_LABEL } })
    changes++
  }
  const values = await client.fetch(`*[_type == "filterValue" && filter._ref == $id]{ _id, value, "slug": slug.current }`, { id })
  const present = new Set()
  for (const value of values) {
    const target = MAP[norm(value.value)] ?? MAP[norm(value.slug)]
    if (!target) {
      const already = TARGET.find((t) => t.slug === norm(value.slug) || t.slug === norm(value.value))
      if (already) present.add(already.slug)
      else console.log(`  ! „${value.value}” (${value.slug}) — brak w mapie, zostaje bez zmian`)
      continue
    }
    present.add(target.slug)
    if (value.value === target.value && value.slug === target.slug) continue
    console.log(`  „${value.value}” (${value.slug}) → „${target.value}” (${target.slug})  [${value._id}]`)
    tx.patch(value._id, { set: { value: target.value, slug: { _type: 'slug', current: target.slug } } })
    renamedLabels.set(baseId(value._id), { value: target.value, oldSlug: value.slug, slug: target.slug })
    changes++
  }
  for (const target of TARGET) {
    if (present.has(target.slug)) continue
    const newId = `filterValue-${norm(filter.key ?? id)}-${target.slug}`
    console.log(`  + nowa wartość „${target.value}” (${target.slug})  [${newId}]`)
    tx.createIfNotExists({ _id: newId, _type: 'filterValue', filter: { _type: 'reference', _ref: id }, value: target.value, slug: { _type: 'slug', current: target.slug } })
    changes++
  }
}

// Pomocnicze etykiety wariantów w produktach („Rozmiar: S” → „Rozmiar psa: Mały”).
if (renamedLabels.size) {
  const ids = [...renamedLabels.keys()]
  const products = await client.fetch(
    `*[_type == "product" && count(variants[].optionValues[value._ref in $ids]) > 0]{ _id, variants[]{ _key, indexedOptions, optionValues[]{ _key, label, "ref": value._ref } } }`,
    { ids },
  )
  for (const product of products) {
    const set = {}
    for (const variant of product.variants ?? []) {
      for (const ov of variant.optionValues ?? []) {
        const renamed = renamedLabels.get(ov.ref)
        if (!renamed) continue
        set[`variants[_key=="${variant._key}"].optionValues[_key=="${ov._key}"].label`] = `${FILTER_LABEL}: ${renamed.value}`
        if (Array.isArray(variant.indexedOptions)) {
          set[`variants[_key=="${variant._key}"].indexedOptions`] = variant.indexedOptions.map((entry) => {
            const [key, slug] = String(entry).split(':')
            return slug === renamed.oldSlug ? `${key}:${renamed.slug}` : entry
          })
        }
      }
    }
    if (Object.keys(set).length) {
      console.log(`  produkt ${product._id}: ${Object.keys(set).length} etykiet wariantów`)
      tx.patch(product._id, { set })
      changes++
    }
  }
}

console.log(`\nZmian do zapisania: ${changes}`)
if (!changes) process.exit(0)
if (!APPLY) {
  console.log('To była SUCHA PRÓBA. Uruchom z --apply, żeby zapisać zmiany.')
  process.exit(0)
}
await tx.commit({ visibility: 'async' })
console.log('Zapisano. Sklep pokaże nowe nazwy po odświeżeniu cache (do ~10 min).')
