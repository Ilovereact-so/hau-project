'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button, ButtonLink } from '@/components/admin/kit/Button'
import { EmptyState } from '@/components/admin/kit/EmptyState'

/** Błąd w treści strony panelu — sidebar i topbar zostają, można nawigować dalej. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin]', error)
  }, [error])

  return (
    <EmptyState icon={<AlertTriangle size={20} strokeWidth={1.5} />} title="Nie udało się wczytać tej strony" className="animate-fade-in">
      Najczęściej to chwilowy brak połączenia z bazą, Redisem albo Sanity — stan połączeń sprawdzisz w zakładce Integracje.
      {error.digest && (
        <>
          <br />
          <code className="font-mono text-[11px]">kod: {error.digest}</code>
        </>
      )}
      <span className="mt-4 flex justify-center gap-2">
        <Button size="sm" onClick={reset}>
          <RefreshCw size={14} strokeWidth={1.5} />
          Spróbuj ponownie
        </Button>
        <ButtonLink href="/admin/settings" size="sm" variant="secondary">
          Integracje
        </ButtonLink>
      </span>
    </EmptyState>
  )
}
