'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Check, Mail } from 'lucide-react'
import { confirmNewsletter, unsubscribeNewsletter } from '@/actions/newsletter'

/*
 * Karta na stronach z linków w mailu. Akcja wymaga KLIKNIĘCIA przycisku —
 * samo wejście w link nic nie zmienia, bo skanery poczty (Outlook, Gmail)
 * potrafią „otwierać” linki z wiadomości za użytkownika.
 */
export default function NewsletterActionCard({ mode, token }: { mode: 'confirm' | 'unsubscribe'; token: string }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

  const run = () =>
    startTransition(async () => {
      if (mode === 'confirm') {
        const res = await confirmNewsletter(token)
        setResult(
          res.ok
            ? {
                ok: true,
                message: res.alreadyConfirmed
                  ? `Adres ${res.email} był już potwierdzony — jesteś na liście.`
                  : res.mailSent
                    ? `Gotowe! Kod −10% na pierwsze zamówienie wysłaliśmy na ${res.email}.`
                    : `Zapis potwierdzony. Nie udało się teraz wysłać maila z kodem — napisz do nas, a prześlemy go ręcznie.`,
              }
            : { ok: false, message: res.error },
        )
      } else {
        const res = await unsubscribeNewsletter(token)
        setResult(
          res.ok
            ? { ok: true, message: `Adres ${res.email} został wypisany z newslettera. Przykro nam, że odchodzisz!` }
            : { ok: false, message: res.error },
        )
      }
    })

  const title = mode === 'confirm' ? 'Potwierdź zapis do newslettera' : 'Wypisz się z newslettera'
  const lead =
    mode === 'confirm'
      ? 'Kliknij przycisk, żeby dokończyć zapis. Zaraz potem dostaniesz maila z kodem −10%.'
      : 'Po wypisaniu nie będziemy wysyłać Ci newslettera. W każdej chwili możesz zapisać się ponownie.'

  return (
    <div className="w-full max-w-[560px] rounded-[30px] border border-[#E8E8E8] bg-white px-7 py-9 sm:px-10">
      <span className="grid size-11 place-items-center rounded-full bg-[#e2f3f0] text-[#6EB0A6]">
        {result?.ok ? <Check size={20} strokeWidth={2.5} /> : <Mail size={20} strokeWidth={1.75} />}
      </span>
      <h1 className="mt-4 text-black font-medium text-[clamp(20px,2vw,26px)]">{result?.ok ? (mode === 'confirm' ? 'Dziękujemy!' : 'Wypisano') : title}</h1>
      <p className="mt-2 text-[#4A4A4A] text-[clamp(14px,1.3vw,16px)] leading-relaxed" role="status" aria-live="polite">
        {result ? result.message : lead}
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        {!result?.ok && (
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="rounded-full bg-fancy-black px-7 py-3 text-white font-medium text-[15px] cursor-pointer hover:opacity-90 disabled:opacity-60"
          >
            {pending ? 'Chwileczkę…' : mode === 'confirm' ? 'Potwierdzam zapis' : 'Wypisz mnie'}
          </button>
        )}
        <Link href="/" className="text-black text-[14px] underline underline-offset-4">
          Przejdź do sklepu
        </Link>
      </div>
    </div>
  )
}
