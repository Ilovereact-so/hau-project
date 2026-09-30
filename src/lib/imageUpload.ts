/*
 * Przygotowanie zdjęcia do wysłania z przeglądarki (panel admina).
 * Serwer przyjmuje do 10 MB na plik — większe zdjęcie (np. prosto z aparatu)
 * zmniejszamy tutaj, zamiast kazać adminowi robić to ręcznie.
 */

const MAX_BYTES = 9.5 * 1024 * 1024
const MAX_EDGE = 3200

export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.size <= MAX_BYTES || typeof createImageBitmap !== 'function') return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    // WebP zachowuje przezroczystość (PNG) i jest mały; JPEG jako zapas.
    for (const [type, ext] of [['image/webp', 'webp'], ['image/jpeg', 'jpg']] as const) {
      for (const quality of [0.9, 0.8, 0.7]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
        if (blob && blob.type === type && blob.size <= MAX_BYTES) {
          return new File([blob], file.name.replace(/\.[^.]+$/, '') + `.${ext}`, { type })
        }
      }
    }
  } catch (err) {
    console.error('[image] resize failed', err)
  }
  return file
}
