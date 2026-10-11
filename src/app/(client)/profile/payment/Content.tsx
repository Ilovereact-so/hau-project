'use client'

import { useState, useTransition } from 'react'
import { CreditCard, Info, Lock, Trash2 } from 'lucide-react'
import ProfileMenu from '@/components/ProfileMenu'
import { CardBrandMark } from '@/components/payment/PaymentLogos'
import { removeSavedCard } from '@/actions/savedCards'
import {
  cardBrandLabel,
  cardExpiryLabel,
  cardLast4,
  isCardExpired,
  isCardExpiringSoon,
  type SavedCardView,
} from '@/lib/savedCardsShared'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  cards:            SavedCardView[]
  /** Płatności zapisaną kartą włączone (AUTOPAY_RECURRING_ENABLED). */
  recurringEnabled: boolean
}

const addedFormatter = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })

function addedLabel(value: SavedCardView['createdAt']): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : `Dodana ${addedFormatter.format(date)}`
}

/**
 * Profil → Płatności: karty zapisane do płatności „jednym kliknięciem”.
 * Kartę przechowuje Autopay — sklep zna tylko wydawcę, 4 ostatnie cyfry
 * i datę ważności (do wyświetlenia) oraz token, który nie opuszcza serwera.
 */
export default function Content({ cards, recurringEnabled }: Props) {
  const [items, setItems] = useState(cards)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleRemove(cardId: string) {
    setPendingId(cardId)
    startTransition(async () => {
      const result = await removeSavedCard(cardId)
      setPendingId(null)
      setConfirmId(null)
      if (!result.ok) { toast.error(result.error); return }
      setItems(current => current.filter(card => card.id !== cardId))
      toast.success('Karta została usunięta z konta')
    })
  }

  return (
    <div className="flex max-3md:flex-col w-full 3md:pt-10 pt-3 relative font-poppins">
      <ProfileMenu selected={3} />

      <div className="w-full lg:w-[calc(100%-300px)] 3md:w-[calc(100%-250px)] flex flex-col mt-2 xl:ml-0 3md:ml-3 max-w-[760px]">
        <h1 className="text-[clamp(18px,2vw,24px)] font-medium text-black">Zapisane karty</h1>
        <p className="sm:text-[15px] text-[14px] text-[#6C6C6C] mt-1 leading-relaxed">
          Płać zapisaną kartą jednym kliknięciem, bez ponownego wpisywania jej danych.
        </p>

        {!recurringEnabled && (
          <div className="flex items-start gap-3 rounded-2xl bg-[#ededed] px-4 py-3 mt-6">
            <Info size={18} className="text-[#6C6C6C] mt-[2px] flex-shrink-0" />
            <p className="sm:text-[14px] text-[13px] text-[#3D3D3D] leading-relaxed">
              Płatności zapisaną kartą są w trakcie uruchamiania u operatora płatności.
              Do tego czasu każdą płatność kartą potwierdzasz osobno.
            </p>
          </div>
        )}

        <div className="mt-8">
          {items.length === 0 ? (
            <div className="bg-[#ededed] rounded-[24px] px-6 py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-[#e2f3f0] flex items-center justify-center mx-auto">
                <CreditCard size={22} className="text-[#6EB0A6]" />
              </div>
              <p className="sm:text-[16px] text-[15px] font-medium text-black mt-4">Nie masz jeszcze zapisanych kart</p>
              <p className="sm:text-[14px] text-[13px] text-[#6C6C6C] mt-1 max-w-[420px] mx-auto leading-relaxed">
                {recurringEnabled
                  ? 'Przy następnej płatności kartą zaznacz „Zapamiętaj kartę do kolejnych zakupów” — po udanej płatności karta pojawi się tutaj.'
                  : 'Gdy płatności zapisaną kartą zostaną uruchomione, kartę zapiszesz przy płatności w kasie.'}
              </p>
            </div>
          ) : (
            <ul className="grid sm:grid-cols-2 gap-4 items-start">
              {items.map(card => {
                const expired  = isCardExpired(card.expiryMonth, card.expiryYear)
                const expiring = isCardExpiringSoon(card.expiryMonth, card.expiryYear)
                const expiry   = cardExpiryLabel(card.expiryMonth, card.expiryYear)
                const last4    = cardLast4(card.maskedNumber)
                const added    = addedLabel(card.createdAt)
                const confirming = confirmId === card.id
                const pending    = pendingId === card.id

                return (
                  <li
                    key={card.id}
                    className={cn(
                      'relative rounded-[24px] border border-[#E8E8E8] bg-white p-5 flex flex-col min-h-[176px]',
                      expired && 'bg-[#FAFAFA]',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <CardBrandMark brand={card.cardBrand} />
                      {expired ? (
                        <span className="text-[11px] font-medium text-[#DE3232] bg-[#DE3232]/10 rounded-full px-2.5 py-1">Wygasła</span>
                      ) : expiring ? (
                        <span className="text-[11px] font-medium text-[#9A6700] bg-[#FFF4D6] rounded-full px-2.5 py-1">Wkrótce wygaśnie</span>
                      ) : null}
                    </div>

                    <p className={cn('mt-5 text-[19px] font-medium tracking-[0.12em]', expired ? 'text-[#8E8E8E]' : 'text-black')}>
                      •••• •••• •••• {last4 ?? '••••'}
                    </p>

                    <div className="mt-auto pt-4 flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[14px] text-black">{cardBrandLabel(card.cardBrand)}</p>
                        <p className="text-[12px] text-[#6C6C6C] mt-0.5">
                          {expiry ? `${expired ? 'Wygasła' : 'Ważna do'} ${expiry}` : 'Data ważności nieznana'}
                          {added ? ` · ${added}` : ''}
                        </p>
                      </div>

                      {!confirming && (
                        <button
                          type="button"
                          onClick={() => setConfirmId(card.id)}
                          className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[#6C6C6C] hover:text-[#DE3232] hover:bg-[#DE3232]/10 transition-colors cursor-pointer"
                          aria-label={`Usuń kartę ${cardBrandLabel(card.cardBrand)} kończącą się na ${last4 ?? ''}`}
                        >
                          <Trash2 size={17} />
                        </button>
                      )}
                    </div>

                    {confirming && (
                      <div className="mt-4 rounded-[16px] bg-[#ededed] px-4 py-3">
                        <p className="text-[13px] text-black">Usunąć tę kartę z konta?</p>
                        <p className="text-[12px] text-[#6C6C6C] mt-0.5">Przy kolejnej płatności wpiszesz dane karty od nowa.</p>
                        <div className="flex gap-2 mt-3">
                          <button
                            type="button"
                            onClick={() => handleRemove(card.id)}
                            disabled={pending}
                            className="rounded-full bg-fancy-black text-white text-[13px] font-medium px-4 py-1.5 disabled:opacity-60 cursor-pointer"
                          >
                            {pending ? 'Usuwam…' : 'Usuń kartę'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            disabled={pending}
                            className="rounded-full text-[13px] text-black px-4 py-1.5 hover:bg-black/5 cursor-pointer"
                          >
                            Anuluj
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex items-start gap-3 mt-8 text-[#6C6C6C]">
          <Lock size={16} className="mt-[2px] flex-shrink-0" />
          <p className="sm:text-[13px] text-[12px] leading-relaxed">
            Dane kart przechowuje Autopay S.A. — krajowa instytucja płatnicza nadzorowana przez KNF.
            Sklep nie zna pełnego numeru karty ani kodu CVV; widzisz tu tylko wydawcę, 4 ostatnie cyfry i datę ważności.
            Każdą płatność zapisaną kartą bank może dodatkowo potwierdzić (3-D Secure).
          </p>
        </div>
      </div>
    </div>
  )
}
