/*
 * Przygotowanie zdjęcia do wysłania z przeglądarki (panel admina).
 * Serwer przyjmuje do 10 MB na plik — większe zdjęcie (np. prosto z aparatu)
 * zmniejszamy tutaj, zamiast kazać adminowi robić to ręcznie.
 *
 * Domyślnie (produkty, kolekcje, kampanie…) ruszamy tylko pliki > 9,5 MB.
 * Blog podaje ostrzejsze progi (`BLOG_IMAGE_PREP`): zdjęcie w artykule nie
 * potrzebuje 6000 px i 8 MB, a mniejszy plik szybciej przechodzi przez hosting.
 */

const SERVER_MAX_BYTES = 9.5 * 1024 * 1024

export type ImagePrepOptions = {
  /** Plik nie większy niż to (i nie dłuższy niż `maxEdge`) idzie bez zmian. */
  maxBytes?: number
  /** Dłuższy bok po zmniejszeniu (px). */
  maxEdge?: number
}

/** Zdjęcia w poradnikach: kolumna ~760 px, więc 2560 px wystarcza z zapasem (retina, okładka). */
export const BLOG_IMAGE_PREP: ImagePrepOptions = { maxBytes: 2.5 * 1024 * 1024, maxEdge: 2560 }

// Animowany GIF i SVG przerysowane na canvasie straciłyby animację / wektor.
const KEEP_AS_IS = new Set(['image/gif', 'image/svg+xml'])

export async function prepareImageForUpload(file: File, options: ImagePrepOptions = {}): Promise<File> {
  const maxBytes = Math.min(options.maxBytes ?? SERVER_MAX_BYTES, SERVER_MAX_BYTES)
  const maxEdge = options.maxEdge ?? 3200
  if (KEEP_AS_IS.has(file.type) || typeof createImageBitmap !== 'function') return file
  if (file.size <= maxBytes && !options.maxEdge) return file
  try {
    const bitmap = await createImageBitmap(file)
    const longest = Math.max(bitmap.width, bitmap.height)
    if (file.size <= maxBytes && longest <= maxEdge) {
      bitmap.close?.()
      return file
    }
    const scale = Math.min(1, maxEdge / longest)
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close?.()
      return file
    }
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    // WebP zachowuje przezroczystość (PNG) i jest mały; JPEG jako zapas.
    // Gdy żadna jakość nie zmieści się w `maxBytes`, bierzemy najmniejszy
    // wynik, o ile jest mniejszy od oryginału i mieści się w limicie serwera.
    let best: Blob | null = null
    let bestExt = ''
    for (const [type, ext] of [['image/webp', 'webp'], ['image/jpeg', 'jpg']] as const) {
      for (const quality of [0.9, 0.82, 0.72]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
        if (!blob || blob.type !== type) break // przeglądarka nie umie tego formatu
        if (blob.size <= maxBytes) return renamed(file, blob, ext)
        if (!best || blob.size < best.size) {
          best = blob
          bestExt = ext
        }
      }
    }
    if (best && best.size < file.size && best.size <= SERVER_MAX_BYTES) return renamed(file, best, bestExt)
  } catch (err) {
    // Np. HEIC w Chrome — przeglądarka nie odczyta pliku; wysyłamy oryginał.
    console.error('[image] resize failed', err)
  }
  return file
}

function renamed(file: File, blob: Blob, ext: string): File {
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + `.${ext}`, { type: blob.type })
}
