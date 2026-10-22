import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { adminDenied, errorMessage } from '@/lib/admin/guard'
import { addProductImage, setSubcategoryImage, withTimeout } from '@/lib/admin/catalog'
import { setCollectionImage } from '@/lib/admin/collections'
import { uploadHomeImage } from '@/lib/admin/homeLayout'

/*
 * Wysyłka zdjęć z panelu (kolekcje, subkategorie, produkty, import ZIP).
 *
 * Zwykła trasa zamiast server action: na hostingu wywołanie akcji z plikiem
 * potrafiło zawisnąć bez odpowiedzi — panel pokazywał „Wysyłam…” bez końca,
 * bez błędu w konsoli. Tu klient ma własny limit czasu (lib/adminImageUpload),
 * serwer limituje każdy etap i zwraca, NA KTÓRYM stanął, a log serwera
 * ([images]) pokazuje czasy. Odświeżenie widoków (revalidatePath) nie
 * renderuje strony w odpowiedzi, jak robiła to akcja.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * `home` — zdjęcie do sekcji „O nas”, `campaign` — zdjęcie do kampanii newslettera.
 * Oba tylko wgrywają plik do Sanity (bez `id`); zapis w treści robi formularz.
 */
type Target = 'product' | 'collection' | 'subcategory' | 'home' | 'campaign'
const TARGETS: Target[] = ['product', 'collection', 'subcategory', 'home', 'campaign']
const SAVE_TIMEOUT_MS = 30_000

export async function POST(req: Request) {
  const denied = await adminDenied()
  if (denied) return NextResponse.json({ ok: false, error: 'Brak uprawnień — zaloguj się jako admin.' }, { status: denied.status })

  let stage = 'odczyt pliku'
  const started = Date.now()
  try {
    const form = await withTimeout(req.formData(), SAVE_TIMEOUT_MS, 'Plik nie dotarł do serwera w ciągu 30 s.')
    const target = String(form.get('target') ?? '') as Target
    const id = String(form.get('id') ?? '')
    const alt = String(form.get('alt') ?? '')
    const file = form.get('file')
    if (!TARGETS.includes(target)) throw new Error('Nieznany cel zdjęcia.')
    if (!(file instanceof File) || !file.size) throw new Error('Nie wybrano pliku.')
    console.info(`[images] ${target} ${id}: ${file.name} ${(file.size / 1024).toFixed(0)} kB odebrany (${Date.now() - started} ms)`)

    stage = 'wysyłka do Sanity i zapis'
    let data: unknown
    if (target === 'product') {
      const variantKeys = form.getAll('variantKeys').map(String).filter(Boolean).slice(0, 200)
      data = await addProductImage(id, file, alt, variantKeys)
    } else if (target === 'home' || target === 'campaign') {
      data = await uploadHomeImage(file)
    } else if (target === 'collection') {
      data = await setCollectionImage(id, file, alt)
      revalidatePath('/kolekcje', 'layout')
    } else {
      data = await setSubcategoryImage(id, file, alt)
    }
    revalidatePath('/admin', 'layout')
    console.info(`[images] ${target} ${id}: gotowe (${Date.now() - started} ms)`)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error(`[images] błąd na etapie „${stage}” po ${Date.now() - started} ms`, error)
    return NextResponse.json({ ok: false, error: `${errorMessage(error, 'Nie udało się wgrać zdjęcia.')} (etap: ${stage})` }, { status: 500 })
  }
}
