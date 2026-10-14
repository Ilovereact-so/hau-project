'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { submitWithdrawal } from '@/actions/withdrawals'
import {
  WITHDRAWAL_LIMITS, normalizeWithdrawal, validateWithdrawal,
  type WithdrawalErrors, type WithdrawalInput,
} from '@/lib/withdrawals'

/*
 * Dwa kroki, jak wymaga dyrektywa: (1) dane oświadczenia, (2) podgląd
 * i przycisk „Potwierdzam odstąpienie od umowy”. Dopiero drugi krok składa
 * oświadczenie (akcja serwerowa zapisuje je i wysyła potwierdzenie mailem).
 */

type Props = { initialOrderNumber?: string; initialEmail?: string }

const inputClass =
  'w-full rounded-[18px] border border-[#D9D9D9] bg-white px-4 py-3 text-[15px] text-black outline-none transition focus:border-fancy-black focus-visible:ring-2 focus-visible:ring-[#6EB0A6]'

function Field({
  id, label, hint, error, children,
}: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-medium text-black">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-[12px] text-[#6C6C6C]">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-[12px] text-red-600">{error}</p>}
    </div>
  )
}

export default function WithdrawalForm({ initialOrderNumber = '', initialEmail = '' }: Props) {
  const [values, setValues] = useState<WithdrawalInput>({
    name: '',
    email: initialEmail.slice(0, WITHDRAWAL_LIMITS.email),
    orderNumber: initialOrderNumber.slice(0, WITHDRAWAL_LIMITS.orderNumber),
    items: '',
    note: '',
  })
  const [errors, setErrors] = useState<WithdrawalErrors>({})
  const [step, setStep] = useState<'form' | 'review' | 'done'>('form')
  const [serverError, setServerError] = useState<string | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof WithdrawalInput) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((current) => ({ ...current, [key]: event.target.value }))

  const toReview = (event: React.FormEvent) => {
    event.preventDefault()
    const normalized = normalizeWithdrawal(values)
    const found = validateWithdrawal(normalized)
    setErrors(found)
    if (Object.keys(found).length) return
    setValues(normalized)
    setServerError(null)
    setStep('review')
  }

  const confirm = () => {
    setServerError(null)
    startTransition(async () => {
      const result = await submitWithdrawal(values)
      if (result.ok) {
        setSubmittedAt(result.submittedAt)
        setStep('done')
        return
      }
      setServerError(result.error)
      if (result.fieldErrors) {
        setErrors(result.fieldErrors)
        setStep('form')
      }
    })
  }

  if (step === 'done') {
    const when = submittedAt
      ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'Europe/Warsaw' }).format(new Date(submittedAt))
      : ''
    return (
      <div role="status" className="mt-8 rounded-[30px] border border-[#E8E8E8] bg-white p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-7 text-[#6EB0A6]" aria-hidden />
          <h2 className="text-[clamp(18px,2vw,22px)] font-medium text-black">Oświadczenie złożone</h2>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-[#3D3D3D]">
          Przyjęliśmy Twoje oświadczenie o odstąpieniu od umowy (zamówienie #{values.orderNumber}){when ? `, złożone ${when}` : ''}.
          Potwierdzenie z jego treścią wysłaliśmy na adres <strong>{values.email}</strong>. Jeśli nie widzisz maila, sprawdź folder spam.
        </p>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="mt-8 rounded-[30px] border border-[#E8E8E8] bg-white p-6 sm:p-8">
        <h2 className="text-[clamp(18px,2vw,22px)] font-medium text-black">Sprawdź i potwierdź</h2>
        <div className="mt-4 rounded-[20px] bg-[#f7f7f7] p-5 text-[15px] leading-relaxed text-[#3D3D3D]">
          <p>
            Ja, <strong>{values.name}</strong>, niniejszym informuję o moim odstąpieniu od umowy sprzedaży{' '}
            {values.items ? <>następujących rzeczy: <strong>{values.items}</strong></> : 'wszystkich rzeczy z zamówienia'}{' '}
            (zamówienie <strong>#{values.orderNumber}</strong>).
          </p>
          {values.note && <p className="mt-2 text-[14px] text-[#6C6C6C]">Uwagi: {values.note}</p>}
          <p className="mt-2 text-[14px] text-[#6C6C6C]">Potwierdzenie wyślemy na: {values.email}</p>
        </div>
        {serverError && <p role="alert" className="mt-4 text-[14px] text-red-600">{serverError}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="rounded-full bg-fancy-black px-7 py-3 text-[15px] font-medium text-white transition-colors hover:bg-fancy-black/90 disabled:opacity-60"
          >
            {pending ? 'Wysyłam…' : 'Potwierdzam odstąpienie od umowy'}
          </button>
          <button
            type="button"
            onClick={() => setStep('form')}
            disabled={pending}
            className="rounded-full bg-[#EDEDED] px-6 py-3 text-[15px] font-medium text-fancy-black hover:bg-[#e2e2e2]"
          >
            Popraw dane
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={toReview} noValidate className="mt-8 flex flex-col gap-5 rounded-[30px] border border-[#E8E8E8] bg-white p-6 sm:p-8">
      <Field id="wd-name" label="Imię i nazwisko" error={errors.name}>
        <input id="wd-name" name="name" autoComplete="name" required maxLength={WITHDRAWAL_LIMITS.name}
          value={values.name} onChange={set('name')} className={inputClass}
          aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'wd-name-error' : undefined} />
      </Field>
      <Field id="wd-email" label="Adres e-mail" hint="Ten sam, którego użyłeś przy zamówieniu — wyślemy na niego potwierdzenie." error={errors.email}>
        <input id="wd-email" name="email" type="email" autoComplete="email" required maxLength={WITHDRAWAL_LIMITS.email}
          value={values.email} onChange={set('email')} className={inputClass}
          aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'wd-email-error' : 'wd-email-hint'} />
      </Field>
      <Field id="wd-order" label="Numer zamówienia" hint="Znajdziesz go w mailu z potwierdzeniem zamówienia, np. 3F2A9C1B." error={errors.orderNumber}>
        <input id="wd-order" name="orderNumber" required maxLength={WITHDRAWAL_LIMITS.orderNumber}
          value={values.orderNumber} onChange={set('orderNumber')} className={inputClass}
          aria-invalid={Boolean(errors.orderNumber)} aria-describedby={errors.orderNumber ? 'wd-order-error' : 'wd-order-hint'} />
      </Field>
      <Field id="wd-items" label="Których produktów dotyczy? (opcjonalnie)" hint="Zostaw puste, jeśli odstępujesz od umowy dla całego zamówienia.">
        <textarea id="wd-items" name="items" rows={3} maxLength={WITHDRAWAL_LIMITS.items}
          value={values.items} onChange={set('items')} className={inputClass} aria-describedby="wd-items-hint" />
      </Field>
      <Field id="wd-note" label="Uwagi (opcjonalnie)" hint="Nie musisz podawać przyczyny odstąpienia.">
        <textarea id="wd-note" name="note" rows={3} maxLength={WITHDRAWAL_LIMITS.note}
          value={values.note} onChange={set('note')} className={inputClass} aria-describedby="wd-note-hint" />
      </Field>
      {serverError && <p role="alert" className="text-[14px] text-red-600">{serverError}</p>}
      <button type="submit" className="w-fit rounded-full bg-fancy-black px-7 py-3 text-[15px] font-medium text-white transition-colors hover:bg-fancy-black/90">
        Dalej — sprawdź oświadczenie
      </button>
    </form>
  )
}
