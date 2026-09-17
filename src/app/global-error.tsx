'use client'

import { useEffect } from 'react'

/**
 * Ostatnia linia obrony: błąd w samym layoucie (np. w ClerkProvider) —
 * React nie ma wtedy żadnego działającego layoutu, więc ten plik renderuje
 * własny dokument HTML bez zależności od reszty aplikacji.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global]', error)
  }, [error])

  return (
    <html lang="pl">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#ffffff', color: '#1a1a1a' }}>
        <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, fontWeight: 600, margin: 0 }}>Sklep chwilowo niedostępny</h1>
          <p style={{ maxWidth: 520, color: '#6C6C6C', lineHeight: 1.6 }}>
            Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę za chwilę.
          </p>
          {error.digest && <code style={{ color: '#9a9a9a', fontSize: 13 }}>kod: {error.digest}</code>}
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 24, padding: '12px 32px', borderRadius: 999, border: 'none', background: '#1a1a1a', color: '#fff', fontSize: 16, cursor: 'pointer' }}
          >
            Odśwież
          </button>
        </main>
      </body>
    </html>
  )
}
