'use server'

import { auth } from '@clerk/nextjs/server'
import Papa from 'papaparse'
import { sanityClient } from '@/sanity/sanityClient.server'

export async function requireAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') throw new Error('Forbidden')
}

/**
 * Sucha walidacja CSV produktów (format subcat1.csv) — bez zapisu do Sanity.
 * Sprawdza: brakujące kategorie/subkategorie, duplikaty slug/SKU, błędy ceny/stock.
 * Używane przez /admin/import krok 2 (dry-run).
 */
export async function adminValidateProductsCsv(csvText: string) {
  await requireAdmin()

  const parsed = Papa.parse<Record<string, string | undefined>>(csvText, {
    header: true,
    skipEmptyLines: true,
  })
  const rows = parsed.data.filter(Boolean)
  if (!rows.length) return { rows: [], errors: ['CSV nie zawiera wierszy'], total: 0 }

  const seenSlugs = new Map<string, number>()
  const seenSkus = new Map<string, number>()
  const errors: Array<{ row: number; field: string; message: string }> = []
  const dupes: Array<{ a: number; b: number; type: string; value: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const n = i + 2 // nagłówek = 1

    if (!r.title || !r.title.trim()) errors.push({ row: n, field: 'title', message: 'Brak tytułu' })
    const sku = (r.sku ?? '').trim()
    if (!sku) errors.push({ row: n, field: 'sku', message: 'Brak SKU' })
    const slug = (r.slug ?? '').trim()

    if (sku) {
      if (seenSkus.has(sku)) dupes.push({ a: seenSkus.get(sku)!, b: n, type: 'SKU', value: sku })
      else seenSkus.set(sku, n)
    }
    if (slug) {
      if (seenSlugs.has(slug)) dupes.push({ a: seenSlugs.get(slug)!, b: n, type: 'slug', value: slug })
      else seenSlugs.set(slug, n)
    }

    const price = Number(r.price)
    if (!r.price || isNaN(price) || price <= 0) errors.push({ row: n, field: 'price', message: `Błędna cena: "${r.price}"` })

    const stock = Number(r.stock)
    if (r.stock !== undefined && r.stock !== '' && (isNaN(stock) || stock < 0)) {
      errors.push({ row: n, field: 'stock', message: `Błędny stan: "${r.stock}"` })
    }
  }

  // duplikaty vs Sanity (kategorie/subkategorie istniejące)
  const categories = new Set<string>()
  const subcategories = new Set<string>()
  try {
    const cats = await sanityClient.fetch(`*[_type=="category"]{"slug": slug.current}`)
    cats.forEach((c: any) => c.slug && categories.add(c.slug))
    const subs = await sanityClient.fetch(`*[_type=="subcategory"]{"slug": slug.current}`)
    subs.forEach((s: any) => s.slug && subcategories.add(s.slug))
  } catch (e) {
    errors.push({ row: 0, field: 'sanity', message: `Nie udało się pobrać kategorii z Sanity: ${(e as any)?.message}` })
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const n = i + 2
    const cat = (r.category_slug ?? '').trim()
    if (cat && !categories.has(cat)) errors.push({ row: n, field: 'category_slug', message: `Nieznana kategoria: "${cat}"` })
    const sub = (r.type ?? '').trim()
    if (sub && !subcategories.has(sub)) errors.push({ row: n, field: 'type', message: `Nieznana subkategoria: "${sub}"` })
  }

  return {
    total: rows.length,
    errors,
    dupes,
    // krótka linia dla strony: "wiersz X jest OK / błąd"
    perRow: rows.map((_, i) => {
      const n = i + 2
      const errs = errors.filter((e: any) => e.row === n)
      const d = dupes.filter((d: any) => d.a === n || d.b === n)
      return { row: n, ok: errs.length === 0 && d.length === 0, messages: [...errs.map((e: any) => e.message), ...d.map((x: any) => `${x.type} powtórzone`)] }
    }),
  }
}