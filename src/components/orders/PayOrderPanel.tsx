'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Loader2, ShieldCheck } from 'lucide-react'
import PriceFormatter from '@/components/PriceFormatter'
import Step2PaymentForm, { type GatewaySelection } from '@/app/(client)/checkout/_components/Step2PaymentForm'
import AutopayInlinePayment from '@/app/(client)/checkout/_components/AutopayInlinePayment'
import { payExistingOrder, type AutopayInlinePayload } from '@/actions/checkout'
import { submitAutopayForm } from '@/lib/autopayForm'
import { formatPaymentDeadline, timeLeftLabel } from '@/lib/paymentDeadline'

interface Props {
  orderId:      string
  totalCents:   number
  /** Termin płatności (ISO) — po nim zamówienie się anuluje. */
  deadline:     string
  /** Podpisany token zamówienia gościa (strona otwarta z linku w mailu). */
  accessToken?: string | null
  /** Klient wrócił z bramki bez płatności / płatność się nie udała — mocniejszy komunikat. */
  highlight?:   boolean
}

/**
 * „Zapłać ponownie” dla zamówienia, które czeka na płatność — jak w dużych
 * sklepach: zamówienie zostaje, klient wybiera metodę jeszcze raz (BLIK,
 * karta, przelew, inne metody na stronie Autopay). Ten sam tryb co w kasie:
 * przekierowanie na Autopay (karta w ramce tylko przy włączonej fladze).
 */
export default function PayOrderPanel({ orderId, totalCents, deadline, accessToken, highlight = false }: Props) {
  const router = useRouter()
  const [selection, setSelection] = useState<GatewaySelection>({ method: 'autopay', gatewayId: undefined })
  const [error, setError] = useState<string | null>(null)
  const [inline, setInline] = useState<AutopayInlinePayload | null>(null)
  const [isPending, startTransition] = useTransition()
  // „Zostało …” liczymy dopiero w przeglądarce (czas serwera ≠ czas klienta).
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    const update = () => setTimeLeft(timeLeftLabel(deadline))
    update()
    const timer = setInterval(update, 60_000)
    return () => clearInterval(timer)
  }, [deadline])

  const hasMethod = Boolean(selection.gatewayId || selection.other)
  const canPay = hasMethod && !isPending

  function pay() {
    setError(null)
    startTransition(async () => {
      const result = await payExistingOrder(
        orderId,
        { gatewayId: selection.other ? undefined : selection.gatewayId },
        accessToken ?? undefined,
      )
      if (!result.ok) {
        setError(result.error)
        // Zamówienie mogło się w międzyczasie zmienić (opłacone / anulowane).
        router.refresh()
        return
      }
      if (result.autopayInline) { setInline(result.autopayInline); return }
      if (result.autopayForm) { submitAutopayForm(result.autopayForm); return }
      window.location.href = result.redirectUrl
    })
  }

  return (
    <section id="platnosc" className="mt-6 scroll-mt-24 rounded-[28px] border border-[#E8E8E8] overflow-hidden bg-white">
      <div className={highlight ? 'bg-[#fcefec] px-5 sm:px-7 py-5' : 'bg-[#e2f3f0] px-5 sm:px-7 py-5'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[clamp(16px,1.8vw,20px)] font-medium text-black">
              {highlight ? 'Płatność nie została dokończona' : 'Zamówienie czeka na płatność'}
            </h2>
            <p className="text-[clamp(13px,1.5vw,15px)] text-[#3A3A3A] mt-1">
              Zamówienie jest zapisane — nie musisz składać go od nowa. Wybierz metodę i zapłać.
            </p>
          </div>
          <PriceFormatter amount={totalCents / 100} className="text-[clamp(18px,2vw,22px)] font-medium text-black" />
        </div>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-[13px] text-black">
          <Clock size={14} aria-hidden="true" />
          Opłać do {formatPaymentDeadline(deadline)}
          {timeLeft && <span className="text-[#6C6C6C]">· zostało {timeLeft}</span>}
        </p>
        <p className="text-[12px] text-[#6C6C6C] mt-2">Po tym terminie zamówienie zostanie automatycznie anulowane.</p>
      </div>

      <div className="px-3 sm:px-5 py-5">
        <Step2PaymentForm value={selection} onChange={(value) => { setSelection(value); setError(null) }} allowCod={false} />

        {error && <p role="alert" className="mt-4 mx-2 text-[13px] text-[#DE3232]">{error}</p>}

        <div className="mt-5 mx-2 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            type="button"
            onClick={pay}
            disabled={!canPay}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-fancy-black text-white font-bold text-[15px] px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:bg-fancy-black/90 transition-colors"
          >
            {isPending && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {isPending ? 'Uruchamiam płatność…' : <>Zapłać <PriceFormatter amount={totalCents / 100} className="font-bold text-white" /></>}
          </button>
          {!hasMethod && <p className="text-[13px] text-[#6C6C6C]">Wybierz metodę płatności powyżej.</p>}
        </div>

        <p className="mt-4 mx-2 text-[12px] text-[#6C6C6C] flex items-start gap-2 leading-relaxed">
          <ShieldCheck size={14} className="mt-[2px] flex-shrink-0" aria-hidden="true" />
          Płatność obsługuje Autopay — kod BLIK albo dane karty podasz na jego stronie, nie trafiają na serwer sklepu.
        </p>
      </div>

      {inline && (
        <AutopayInlinePayment
          payload={inline}
          onClose={() => { setInline(null); router.refresh() }}
          onChooseAnother={() => {
            setInline(null)
            router.refresh()
            document.getElementById('platnosc')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
        />
      )}
    </section>
  )
}
