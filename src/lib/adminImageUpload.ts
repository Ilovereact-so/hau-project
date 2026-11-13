/*
 * Wysyłka plików z panelu przez zwykłe trasy API (`/api/admin/images`,
 * `/api/admin/guide-video`) — z limitem czasu po stronie przeglądarki, żeby
 * zawieszone połączenie kończyło się komunikatem, a nie wiecznym „Wysyłam…”.
 * NIE przez server action: na hostingu akcja z plikiem potrafiła zawisnąć
 * bez odpowiedzi (patrz CLAUDE.md, „Zdjęcia z panelu”).
 */

const TIMEOUT_MS = 150_000

type UploadResponse<T> = { ok: true; data: T } | { ok: false; error: string }

export type AdminImageTarget = 'product' | 'collection' | 'subcategory' | 'home' | 'campaign' | 'guide'

export async function uploadAdminImage<T>(input: {
  target: AdminImageTarget
  id: string
  file: File
  alt?: string
  variantKeys?: string[]
}): Promise<UploadResponse<T>> {
  const form = new FormData()
  form.set('target', input.target)
  form.set('id', input.id)
  form.set('alt', input.alt ?? '')
  form.set('file', input.file)
  for (const key of input.variantKeys ?? []) form.append('variantKeys', key)
  return postAdminUpload<T>('/api/admin/images', form, 'zdjęcie')
}

/** Plik wideo do poradnika (MP4/WebM/MOV, limit jak w `GUIDE_VIDEO_MAX_BYTES`). */
export async function uploadGuideVideoFile(file: File): Promise<UploadResponse<{ ref: string; url: string }>> {
  const form = new FormData()
  form.set('file', file)
  return postAdminUpload('/api/admin/guide-video', form, 'film')
}

async function postAdminUpload<T>(url: string, form: FormData, what: 'zdjęcie' | 'film'): Promise<UploadResponse<T>> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { method: 'POST', body: form, signal: controller.signal })
    const json = await res.json().catch(() => null)
    if (json && typeof json.ok === 'boolean') return json
    if (res.status === 413) {
      return { ok: false, error: `Serwer odrzucił plik jako za duży (413) — ${what === 'film' ? 'zmniejsz film albo wrzuć go na YouTube/Vimeo' : 'zmniejsz zdjęcie'}.` }
    }
    return { ok: false, error: `Serwer odpowiedział błędem ${res.status}${res.statusText ? ` (${res.statusText})` : ''}.` }
  } catch (err) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        error: `Serwer nie odpowiedział w ciągu 2,5 min — ${what === 'film' ? 'film nie został zapisany' : 'zdjęcie nie zostało zapisane'}. Spróbuj ponownie albo z mniejszym plikiem.`,
      }
    }
    console.error('[upload]', err)
    return { ok: false, error: 'Brak połączenia z serwerem — sprawdź internet i spróbuj ponownie.' }
  } finally {
    clearTimeout(timer)
  }
}
