import { redirect } from 'next/navigation'

/**
 * Stary uploader CSV+ZIP. Całość (sucha próba, podgląd, wzór pliku, import,
 * historia) jest teraz w panelu pod /admin/import — ta ścieżka nie była
 * objęta ochroną `/admin(.*)` w middleware, więc tylko przekierowuje.
 */
export default function LegacyUploadPage() {
  redirect('/admin/import')
}
