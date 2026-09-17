'use client'

import { useState, useTransition } from 'react'
import { CreditCard, Info, Trash2 } from 'lucide-react'
import ProfileMenu from '@/components/ProfileMenu'
import { removeSavedCard, type SavedCard } from '@/actions/savedCards'
import toast from 'react-hot-toast'

interface Props {
  cards:            SavedCard[]
  recurringEnabled: boolean
}

function brandLabel(brand: string | null): string {
  if (!brand) return 'Karta'
  const normalized = brand.toUpperCase()
  if (normalized.includes('VISA'))       return 'Visa'
  if (normalized.includes('MASTER'))     return 'Mastercard'
  if (normalized.includes('AMEX') || normalized.includes('AMERICAN')) return 'American Express'
  return brand
}

function expiryLabel(month: number | null, year: number | null): string | null {
  if (!month || !year) return null
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`
}

export default function Content({ cards, recurringEnabled }: Props) {
  const [items, setItems] = useState(cards)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleRemove(cardId: string) {
    setPendingId(cardId)
    startTransition(async () => {
      const result = await removeSavedCard(cardId)
      setPendingId(null)
      if (!result.ok) { toast.error(result.error); return }
      setItems(current => current.filter(card => card.id !== cardId))
      toast.success('Karta została usunięta')
    })
  }

  return (
    <div className="flex 3md:flex-row flex-col w-full pt-10 font-poppins relative">
      <ProfileMenu selected={3} />

      <div className="w-full flex flex-col max-w-[700px]">
       
        <p className="sm:text-[15px] text-[14px] text-[#6C6C6C] mt-1">
          Karty zapisane do szybszych zakupów. Pełnego numeru karty ani kodu CVV
          nie przechowujemy — trzymamy wyłącznie token od operatora płatności.
        </p>

        {!recurringEnabled && (
          <div className="flex items-start gap-3 rounded-2xl bg-[#ededed] border border-[#EFEFEF] px-4 py-3 mt-6">
            <Info size={18} className="text-[#6C6C6C] mt-[2px] flex-shrink-0" />
            <p className="sm:text-[14px] text-[13px] text-[#3D3D3D] leading-relaxed">
              Zapisywanie kart jest w trakcie uruchamiania u operatora płatności.
              Do tego czasu każdą płatność potwierdzasz osobno — nic nie tracisz,
              po prostu nie ma jeszcze czego zapisać.
            </p>
          </div>
        )}

        <div className="mt-8 space-y-3">
          {items.length === 0 ? (
            <div className="bg-[#ededed] rounded-2xl px-5 py-10 text-center">
              <CreditCard size={22} className="text-[#BBBBBB] mx-auto" />
              <p className="sm:text-[15px] text-[14px] text-black mt-3">Nie masz zapisanych kart</p>
              <p className="sm:text-[14px] text-[13px] text-[#6C6C6C] mt-1">
                Przy płatności kartą zaznacz „Zapisz kartę do przyszłych płatności”.
              </p>
            </div>
          ) : (
            items.map(card => {
              const expiry = expiryLabel(card.expiryMonth, card.expiryYear)
              return (
                <div
                  key={card.id}
                  className="flex items-center gap-4 border border-[#E8E8E8] rounded-2xl px-5 py-4"
                >
                  <CreditCard size={20} className="text-[#6C6C6C] flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-black">
                      {brandLabel(card.cardBrand)}
                      {card.maskedNumber && (
                        <span className="text-[#6C6C6C] font-normal ml-2">{card.maskedNumber}</span>
                      )}
                    </p>
                    {expiry && (
                      <p className="text-[13px] text-[#6C6C6C] mt-0.5">Ważna do {expiry}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(card.id)}
                    disabled={pendingId === card.id}
                    className="text-[#6C6C6C] hover:text-[#DE3232] transition-colors disabled:opacity-50 cursor-pointer"
                    aria-label="Usuń kartę"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
