/*
 * Wysyłka zdjęcia z panelu przez /api/admin/images — z limitem czasu po
 * stronie przeglądarki, żeby zawieszone połączenie kończyło się komunikatem,
 * a nie wiecznym „Wysyłam…”.
 */

const TIMEOUT_MS = 150_000

export type AdminImageTarget = 'product' | 'collection' | 'subcategory' | 'home' | 'campaign'

export async function uploadAdminImage<T>(input: {
  target: AdminImageTarget
  id: string
  file: File
  alt?: string
  variantKeys?: string[]
}): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const form = new FormData()
  form.set('target', input.target)
  form.set('id', input.id)
  form.set('alt', input.alt ?? '')
  form.set('file', input.file)
  for (const key of input.variantKeys ?? []) form.append('variantKeys', key)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch('/api/admin/images', { method: 'POST', body: form, signal: controller.signal })
    const json = await res.json().catch(() => null)
    if (json && typeof json.ok === 'boolean') return json
    if (res.status === 413) return { ok: false, error: 'Serwer odrzucił plik jako za duży (413) — zmniejsz zdjęcie.' }
    return { ok: false, error: `Serwer odpowiedział błędem ${res.status}${res.statusText ? ` (${res.statusText})` : ''}.` }
  } catch (err) {
    if (controller.signal.aborted) {
      return { ok: false, error: 'Serwer nie odpowiedział w ciągu 2,5 min — zdjęcie nie zostało zapisane. Spróbuj ponownie albo z mniejszym plikiem.' }
    }
    console.error('[upload]', err)
    return { ok: false, error: 'Brak połączenia z serwerem — sprawdź internet i spróbuj ponownie.' }
  } finally {
    clearTimeout(timer)
  }
}
