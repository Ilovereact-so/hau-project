'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AutopayInlinePayload } from '@/actions/checkout'

interface Props {
  payload: AutopayInlinePayload
  /** Zamknięcie panelu — zamówienie zostaje w stanie „oczekuje na płatność”. */
  onClose: () => void
  /**
   * „Wybierz inną metodę płatności” po nieudanej płatności. Domyślnie strona
   * zamówienia z sekcją „Zapłać” (tak samo jak zamknięcie okna w kasie).
   */
  onChooseAnother?: () => void
}

interface StatusResponse {
  status?:  string
  settled?: boolean
  failed?:  boolean
}

const POLL_INTERVAL_MS = 2500
const POLL_TIMEOUT_MS  = 5 * 60 * 1000

/**
 * Płatność kartą w ramce na stronie sklepu (tylko przy
 * AUTOPAY_CARD_IFRAME_ENABLED=true — domyślnie karta idzie przekierowaniem).
 *
 * Ramka nie przekierowuje przeglądarki, więc jedynym sygnałem o wyniku
 * płatności jest ITN zapisany przez webhook — odpytujemy więc status
 * zamówienia, dopóki się nie rozstrzygnie.
 */
export default function AutopayInlinePayment({ payload, onClose, onChooseAnother }: Props) {
  const current = payload
  const [failed,  setFailed]  = useState(false)
  const [expired, setExpired] = useState(false)

  const startedAt = useRef(Date.now())

  useEffect(() => {
    startedAt.current = Date.now()
    setFailed(false)
    setExpired(false)
  }, [current.url])

  useEffect(() => {
    if (failed || expired) return

    let active = true
    let timer: ReturnType<typeof setTimeout>

    const poll = async () => {
      if (!active) return

      try {
        const query = current.accessToken ? `?t=${encodeURIComponent(current.accessToken)}` : ''
        const res  = await fetch(`/api/orders/${current.orderId}/status${query}`, { cache: 'no-store' })
        const data = (await res.json()) as StatusResponse

        if (!active) return

        if (data.settled) {
          window.location.href = `/orders/${current.orderId}?payment=success${current.accessToken ? `&t=${encodeURIComponent(current.accessToken)}` : ''}`
          return
        }
        if (data.failed) {
          setFailed(true)
          return
        }
      } catch {
        // przerwa w sieci — kolejna próba za chwilę
      }

      if (Date.now() - startedAt.current > POLL_TIMEOUT_MS) {
        setExpired(true)
        return
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    timer = setTimeout(poll, POLL_INTERVAL_MS)
    return () => { active = false; clearTimeout(timer) }
  }, [current.orderId, current.url, current.accessToken, failed, expired])

  const chooseAnother = onChooseAnother ?? (() => {
    const token = current.accessToken ? `&t=${encodeURIComponent(current.accessToken)}` : ''
    window.location.href = `/orders/${current.orderId}?payment=unpaid${token}#platnosc`
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 font-poppins">
      <div className="bg-white rounded-[28px] w-full max-w-[520px] max-h-[90vh] overflow-y-auto relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-[#6C6C6C] hover:text-fancy-black transition-colors"
          aria-label="Zamknij"
        >
          <X size={20} />
        </button>

        <div className="p-6 sm:p-8">
          <CardPanel url={current.url} failed={failed} expired={expired} onChooseAnother={chooseAnother} />
        </div>
      </div>
    </div>
  )
}

// ─── karta ────────────────────────────────────────────────────────────────────

function CardPanel({ url, failed, expired, onChooseAnother }: { url: string; failed: boolean; expired: boolean; onChooseAnother: () => void }) {
  if (failed || expired) {
    return (
      <div className="space-y-4">
        <h2 className="text-[18px] font-semibold text-fancy-black">
          {failed ? 'Płatność nie doszła do skutku' : 'Czas na płatność minął'}
        </h2>
        <p className="text-[14px] text-[#6C6C6C] leading-relaxed">
          Zamówienie czeka na płatność — nie musisz składać go od nowa.
          Spróbuj jeszcze raz kartą albo wybierz inną metodę.
        </p>
        <Button
          type="button"
          onClick={onChooseAnother}
          className="w-full rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 hover:bg-fancy-black/90 transition-colors"
        >
          Zapłać ponownie
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-[18px] font-semibold text-fancy-black">Płatność kartą</h2>

      <div className="rounded-2xl overflow-hidden border border-[#E8E8E8]">
        <iframe
          src={url}
          title="Formularz płatności kartą"
          className="w-full h-[520px] border-0"
          // Formularz jest hostowany przez Autopay — dane karty nie przechodzą
          // przez nasz serwer, więc sklep zostaje poza zakresem PCI DSS.
          allow="payment"
        />
      </div>

      <p className="text-[12px] text-[#6C6C6C] flex items-start gap-2 leading-relaxed">
        <ShieldCheck size={14} className="mt-[2px] flex-shrink-0" />
        Formularz obsługuje Autopay. Dane karty nie trafiają na serwer sklepu.
      </p>
    </div>
  )
}
