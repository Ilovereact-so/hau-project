import { NextResponse } from 'next/server'
import { adminDenied, errorMessage } from '@/lib/admin/guard'
import { withTimeout } from '@/lib/admin/catalog'
import { uploadGuideVideo } from '@/lib/admin/guides'

/*
 * Wysyłka pliku wideo do poradnika (edytor bloga w panelu).
 *
 * Zwykła trasa zamiast server action — z tego samego powodu co
 * `/api/admin/images`: na hostingu akcja z plikiem potrafiła zawisnąć bez
 * odpowiedzi. Klient ma własny limit czasu (lib/adminImageUpload), serwer
 * limituje odbiór pliku i wysyłkę do Sanity, log ma linie `[guide-video]`.
 */

export const runtime = 'nodejs'
export const maxDuration = 160

const RECEIVE_TIMEOUT_MS = 60_000

export async function POST(req: Request) {
  const denied = await adminDenied()
  if (denied) return NextResponse.json({ ok: false, error: 'Brak uprawnień — zaloguj się jako admin.' }, { status: denied.status })

  let stage = 'odczyt pliku'
  const started = Date.now()
  try {
    const form = await withTimeout(req.formData(), RECEIVE_TIMEOUT_MS, 'Plik nie dotarł do serwera w ciągu 60 s — sprawdź łącze albo wyślij mniejszy plik.')
    const file = form.get('file')
    if (!(file instanceof File) || !file.size) throw new Error('Nie wybrano pliku.')
    console.info(`[guide-video] ${file.name} ${(file.size / 1024).toFixed(0)} kB odebrany (${Date.now() - started} ms)`)

    stage = 'wysyłka do Sanity'
    const data = await uploadGuideVideo(file)
    console.info(`[guide-video] ${file.name}: gotowe → ${data.ref} (${Date.now() - started} ms)`)
    return NextResponse.json({ ok: true, data })
  } catch (error) {
    console.error(`[guide-video] błąd na etapie „${stage}” po ${Date.now() - started} ms`, error)
    return NextResponse.json({ ok: false, error: `${errorMessage(error, 'Nie udało się wgrać filmu.')} (etap: ${stage})` }, { status: 500 })
  }
}
