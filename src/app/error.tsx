'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * Awaria po stronie serwera w sklepie (np. chwilowy brak połączenia z Sanity
 * albo bazą). Zamiast pustego ekranu klient dostaje wyjaśnienie, przycisk
 * ponowienia i kod błędu, który można podać przy zgłoszeniu.
 */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[store]', error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-20 text-center font-poppins">
      <span className="rounded-full bg-[#ededed] p-5" aria-hidden="true">
        <AlertTriangle className="h-8 w-8 text-fancy-black" />
      </span>
      <h1 className="mt-6 text-[clamp(22px,3vw,34px)] font-medium text-black">Coś poszło nie tak</h1>
      <p className="mt-3 max-w-[520px] text-[clamp(14px,1.5vw,17px)] text-[#6C6C6C]">
        Nie udało się wczytać tej strony. Spróbuj ponownie — jeśli błąd się powtarza, napisz do nas, podając kod poniżej.
      </p>
      {error.digest && <code className="mt-2 text-[13px] text-[#9a9a9a]">kod: {error.digest}</code>}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-2 rounded-full bg-fancy-black px-8 py-3 font-medium text-white hover:bg-[#272929] cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Spróbuj ponownie
        </button>
        <Link href="/" className="rounded-full border border-fancy-black px-8 py-3 font-medium text-black hover:bg-[#ededed]">
          Strona główna
        </Link>
      </div>
    </div>
  )
}
