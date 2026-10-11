'use client'

import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import { SquarePen, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import BlikCodeInput from './BlikCodeInput'
import { getAssetForCarrier } from './Step2DeliveryPayment'
import Image from 'next/image'

const BLIK_GATEWAY_ID = 509
const CARD_GATEWAY_ID = 1500

// ─── props ────────────────────────────────────────────────────────────────────

interface Props {
  address:       CheckoutAddress
  deliveryType:  'kurier' | 'automat'
  serviceName:   string
  paymentMethod: string
  gatewayId?:    number
  gatewayName?:  string
  pickupPoint?:  CheckoutPickupPoint
  /** BLIK-0 aktywny — zbieramy kod tutaj, tuż przed wysłaniem. */
  blik0?:        boolean
  blikCode:      string
  onBlikCode:    (code: string) => void
  onEdit:        () => void
  handleSubmit:  () => void
  isPending:     boolean
  submitError?:  string | null
}

// ─── component ────────────────────────────────────────────────────────────────

/**
 * Podsumowanie zamówienia.
 *
 * Danych karty ani kodu BLIK nie zbieramy u siebie — pełne dane płatnicze
 * klient podaje na stronie Autopay. To upraszcza flow i trzyma sklep poza
 * zakresem PCI DSS.
 */
export default function Step3SummaryCards({
  address, deliveryType, serviceName: _serviceName, paymentMethod,
  gatewayId, gatewayName, pickupPoint,
  blik0, blikCode, onBlikCode,
  onEdit, handleSubmit, isPending, submitError,
}: Props) {
  const isAutopay    = paymentMethod === 'autopay'
  const paymentLabel = isAutopay ? (gatewayName ?? 'Autopay') : 'Za pobraniem'

  const isBlik0 = isAutopay && blik0 === true && gatewayId === BLIK_GATEWAY_ID
  const isCard  = isAutopay && gatewayId === CARD_GATEWAY_ID

  // Kod BLIK żyje ~2 minuty, więc zbieramy go dopiero tutaj — tuż przed wysłaniem.
  const blikReady   = !isBlik0 || blikCode.replace(/\D/g, '').length === 6
  const submitBlocked = isPending || !blikReady
  const asset = getAssetForCarrier(pickupPoint?.carrier ? pickupPoint?.carrier: "")
  return (
    <div className="space-y-5 flex flex-col w-full">
      <h2 className="text-[clamp(16px,1.5vw,20px)] font-medium text-black my-4 max-3xs:mt-5">
        Dostawa {deliveryType === 'kurier' ? 'kurierem' : 'do punktu'}
      </h2>

      {/* ── dane adresata ──────────────────────────────────────────── */}
      <div className="bg-fancy-black/[0.03] rounded-[28px] p-5 relative w-full">
        <button
          type="button"
          onClick={onEdit}
          className="absolute right-4 top-4 text-black cursor-pointer"
          aria-label="Edytuj dane adresata"
        >
          <SquarePen size={20} />
        </button>
        {asset?.logo && <Image width={500} height={500} src={asset.logo.src} alt={pickupPoint?.carrier ?? ''} className="h-[25px] w-auto absolute right-4 bottom-4" />}
        <p className="text-[clamp(15px,1.8vw,16px)] font-medium text-black mb-2">Dane adresata</p>
        <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">{address.firstName} {address.lastName}</p>
        <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">{address.email}</p>
        <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">+48 {address.phone}</p>

        {deliveryType === 'automat' && pickupPoint && (
          <div className="mt-3 pt-3 border-t border-[#F0F0F0]">
            <p className="text-[clamp(15px,1.8vw,16px)] font-medium text-black mb-2">Dostawa</p>
            <p className="text-[clamp(13px,1.8vw,15px)] font-medium text-[#3D3D3D]">{pickupPoint.name}</p>
            <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">ul.{pickupPoint.street}</p>
            <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">{pickupPoint.postcode} {pickupPoint.city}</p>
          </div>
        )}
        {deliveryType === 'kurier' && address.street && (
          <div className="mt-3 pt-3">
            <p className="text-[clamp(15px,1.8vw,16px)] font-medium text-black mb-2">Dostawa</p>
            <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">
              {address.street}{address.apartment_number ? ` / ${address.apartment_number}` : ''}
            </p>
            <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">{address.postalCode} {address.city}</p>
          </div>
        )}
      </div>

      {/* ── podsumowanie dostawy i płatności ───────────────────────── */}
      <div className="bg-fancy-black/[0.03] rounded-2xl p-5 flex flex-col">
        <div className="flex justify-between mb-2">
          <span className="text-[clamp(15px,1.8vw,16px)] font-medium text-black ">Płatność</span>
          <span className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">{paymentLabel}</span>
        </div>
      

      {/* ── BLIK-0: kod z aplikacji banku ──────────────────────────── */}
      {isBlik0 && (
        <div className="border border-[#E0E0E0] rounded-2xl p-5">
          <p className="text-[16px] font-semibold text-fancy-black">
            Płatność{' '}
            <span className="inline-flex items-center justify-center bg-black text-white text-[11px] font-black tracking-wide px-2.5 py-1 rounded-[6px] leading-none ml-1 translate-y-[-1px]">
              blik
            </span>
          </p>
          <p className="text-[13px] text-[#6C6C6C] mt-1">
            Wpisz 6-cyfrowy kod z aplikacji bankowej, a potem potwierdź płatność w aplikacji.
          </p>
          <BlikCodeInput value={blikCode} onChange={onBlikCode} />
        </div>
      )}

      {/* ── informacja o tym, co się stanie po kliknięciu ──────────── */}
      {isAutopay && !isBlik0 && (
        <div className="flex items-start gap-3 rounded-2xl py-3">
          <ShieldCheck size={18} className="text-[#6C6C6C] mt-[2px] flex-shrink-0" />
          <p className="text-[14px] text-[#3D3D3D] leading-relaxed">
            {isCard
              ? 'Formularz karty otworzy się na tej stronie — obsługuje go Autopay, więc dane karty nie trafiają na serwer sklepu.'
              : 'Po kliknięciu „Zamawiam i płacę” przejdziesz na bezpieczną stronę Autopay, gdzie dokończysz płatność.'}
          </p>
        </div>
      )}
      </div>

      <div className="flex flex-col w-full items-start">
        {submitError && <p role="alert" className="mb-3 text-[13px] text-red-400">{submitError}</p>}
        <Button type="button" onClick={handleSubmit} disabled={submitBlocked}
          className="w-fit rounded-full font-medium bg-fancy-black text-white text-[clamp(14px,1.4vw,16px)] lg:py-6 py-5.5 lg:px-8 px-6 hover:bg-fancy-black/90 transition-colors disabled:opacity-60">
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Przetwarzam…
            </span>
          ) : (
            <span className="flex items-center gap-2">Zamawiam i płacę</span>
          )}
        </Button>
        <p className="text-[11px] text-[#6C6C6C] text-left leading-relaxed mt-2">
          Klikając „Zamawiam i płacę&rdquo; akceptujesz{' '}
          <span className="underline cursor-pointer">regulamin</span> i{' '}
          <span className="underline cursor-pointer">politykę prywatności</span>.
        </p>
      </div>
    </div>
  )
}
