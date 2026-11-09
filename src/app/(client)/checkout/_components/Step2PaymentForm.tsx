'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, ChevronDown, Loader2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LogoApplePay, LogoBlik, LogoCards, LogoGooglePay } from '@/components/payment/PaymentLogos'

// ─── types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'autopay' | 'cod'

export interface GatewaySelection {
  method:       PaymentMethod
  gatewayId?:   number
  gatewayName?: string
  /** „Inne metody płatności” — wybór kanału po stronie Autopay. */
  other?:       boolean
  /**
   * Karta otworzy się w ramce na stronie sklepu (AUTOPAY_CARD_IFRAME_ENABLED).
   * Domyślnie `false` — karta, BLIK i przelew idą przekierowaniem na Autopay.
   */
  cardIframe?:  boolean
}

/** Kanał płatności zwrócony przez Autopay (paywayList). */
export interface AutopayGateway {
  gatewayID:   number
  gatewayName: string
  gatewayType: string
  bankName:    string
  iconURL:     string
}

interface GatewaysResponse {
  gateways?:         AutopayGateway[]
  dev?:              boolean
  stale?:            boolean
  unavailable?:      boolean
  cardIframeEnabled?: boolean
}

const CARD_GATEWAY_ID = 1500
const BLIK_GATEWAY_ID = 509
/** „Płatność kartą One Click” — wymaga zapisanej karty, niedostępna na umowie sklepu. */
const ONECLICK_GATEWAY_ID = 1503

/** Kanały pokazywane zawsze na wierzchu — reszta (banki PBL) chowa się pod rozwijaniem. */
const FEATURED_GATEWAY_IDS = new Set([BLIK_GATEWAY_ID, CARD_GATEWAY_ID, 1512, 1513])

interface Props {
  value:    GatewaySelection
  onChange: (v: GatewaySelection) => void
  /** „Za pobraniem” — w kasie tak, przy „Zapłać ponownie” nie (zamówienie jest już online). */
  allowCod?: boolean
}

function GatewayLogo({ gateway }: { gateway: AutopayGateway }) {
  if (gateway.iconURL) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={gateway.iconURL} alt={gateway.gatewayName} aria-hidden="true" className="h-14 object-contain w-auto mix-blend-multiply" />
  }
  if (gateway.gatewayID === BLIK_GATEWAY_ID) return <LogoBlik />
  if (gateway.gatewayID === CARD_GATEWAY_ID) return <LogoCards />
  if (gateway.gatewayID === 1512)            return <LogoGooglePay />
  if (gateway.gatewayID === 1513)            return <LogoApplePay />
  return null
}

// ─── shared bits ──────────────────────────────────────────────────────────────

function Radio({ selected }: { selected: boolean }) {
  return (
    <div className={cn(
      'w-[22px] h-[22px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors',
      selected ? 'border-fancy-black bg-fancy-black' : 'border-fancy-black',
    )}>
      {selected && (
        <Check size={11} className="text-white" strokeWidth={3} />
      )}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Step2PaymentForm({ value, onChange, allowCod = true }: Props) {
  const [gateways,   setGateways]   = useState<AutopayGateway[]>([])
  const [loading,    setLoading]    = useState(true)
  const [isDev,      setIsDev]      = useState(false)
  const [cardIframe, setCardIframe] = useState(false)
  const [showAllBanks, setShowAllBanks] = useState(false)

  useEffect(() => {
    let active = true

    fetch('/api/autopay/gateways')
      .then(r => r.json())
      .then((data: GatewaysResponse) => {
        if (!active) return
        setGateways(data.gateways ?? [])
        setIsDev(!!data.dev)
        setCardIframe(!!data.cardIframeEnabled)
      })
      .catch(() => { if (active) setGateways([]) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  const { featured, banks } = useMemo(() => {
    // „Płatność kartą One Click” (1503) wymaga zapisanej karty — tej usługi
    // sklep nie ma, więc kanału nie pokazujemy (serwer też go odfiltrowuje).
    const visible  = gateways.filter(g => g.gatewayID !== ONECLICK_GATEWAY_ID)
    const featured = visible.filter(g => FEATURED_GATEWAY_IDS.has(g.gatewayID))
    const banks    = visible.filter(g => !FEATURED_GATEWAY_IDS.has(g.gatewayID))
    return { featured, banks }
  }, [gateways])

  function selectGateway(gateway: AutopayGateway) {
    onChange({
      method:      'autopay',
      gatewayId:   gateway.gatewayID,
      gatewayName: gateway.gatewayName,
      other:       false,
      cardIframe:  gateway.gatewayID === CARD_GATEWAY_ID && cardIframe,
    })
  }

  function selectOther() {
    onChange({
      method:      'autopay',
      gatewayId:   undefined,
      gatewayName: 'Inne metody płatności',
      other:       true,
      cardIframe:  false,
    })
  }

  function renderGatewayRow(gateway: AutopayGateway) {
    const selected = value.method === 'autopay' && !value.other && value.gatewayId === gateway.gatewayID

    return (
      <div key={gateway.gatewayID}>
        <button
          type="button"
          onClick={() => selectGateway(gateway)}
          aria-pressed={selected}
          className={cn(
            'w-full text-left h-17 flex items-center pl-2 pr-4 gap-4 transition-colors rounded-[20px]',
            selected ? 'bg-fancy-black/[0.03]' : 'bg-transparent',
          )}
        >
          <Radio selected={selected} />

          <div className="flex-1 min-w-0">
            <p className="text-[clamp(13px,1.4vw,15px)] font-medium text-fancy-black leading-tight">
              {gateway.gatewayName}
            </p>
            {gateway.gatewayType && (
              <p className="text-[clamp(11px,1.4vw,12px)] text-[#6C6C6C] mt-0.5 truncate">{gateway.gatewayType}</p>
            )}
          </div>

          <div className="flex-shrink-0 flex items-center justify-end min-w-[60px]">
            <GatewayLogo gateway={gateway} />
          </div>
        </button>
      </div>
    )
  }

  const otherSelected = value.method === 'autopay' && !!value.other

  return (
    <div className="space-y-3">
      {/* ── kanały Autopay ───────────────────────────────────────────── */}
      <div className="overflow-hidden">
        {isDev && (
          <div className="px-4 py-2 border-b border-[#F2F2F2] flex justify-end">
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              tryb dev — mock
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-[#BBBBBB]">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[14px]">Ładowanie…</span>
          </div>
        ) : (
          <div className="">
            {featured.map(renderGatewayRow)}

            {banks.length > 0 && (showAllBanks ? banks.map(renderGatewayRow) : (
              <button
                type="button"
                onClick={() => setShowAllBanks(true)}
                className="w-full text-left pl-2 pr-4 py-4 flex items-center gap-4  transition-colors"
              >
                <div className="w-[20px] flex-shrink-0" />
                <span className="flex-1 text-[clamp(13px,1.4vw,14px)] text-[#3D3D3D]">
                  Przelew online — pokaż banki ({banks.length})
                </span>
                <ChevronDown size={18} className="text-[#6C6C6C] flex-shrink-0" />
              </button>
            ))}

            {/* ── inne metody — wybór po stronie Autopay ───────────── */}
            <button
              type="button"
              onClick={selectOther}
              aria-pressed={otherSelected}
              className={cn(
                'w-full text-left pl-2 pr-4 py-4 flex items-center gap-4 transition-colors rounded-[20px]',
                otherSelected ? 'bg-fancy-black/[0.03]' : '',
              )}
            >
              <Radio selected={otherSelected} />
              <div className="flex-1 min-w-0">
                <p className="text-[clamp(13px,1.4vw,15px)] font-medium text-fancy-black leading-tight">Inne metody płatności</p>
                <p className="text-[clamp(11px,1.4vw,12px)] text-[#6C6C6C] mt-0.5">Wybierzesz metodę na stronie Autopay</p>
              </div>
              <Wallet size={25} className="flex-shrink-0 text-[#6C6C6C]" />
            </button>
          </div>
        )}
      </div>

      {/* ── za pobraniem ─────────────────────────────────────────────── */}
      {allowCod && (
      <button
        type="button"
        onClick={() => onChange({ method: 'cod', gatewayId: undefined, gatewayName: undefined, other: false, cardIframe: false })}
        className={cn(
          'w-full text-left rounded-2xl pl-2 pr-4 py-4 flex items-center gap-4 transition-all duration-200',
          value.method === 'cod'
            ? 'bg-fancy-black/[0.03]'
            : '',
        )}
      >
        <Radio selected={value.method === 'cod'} />
        <div className="flex-1">
          <p className="text-[clamp(13px,1.4vw,15px)] font-medium text-fancy-black">Za pobraniem</p>
          <p className="text-[clamp(11px,1.4vw,12px)] text-[#6C6C6C] mt-0.5">Płatność przy odbiorze</p>
        </div>
        <Banknote size={25} className="flex-shrink-0 text-[#6C6C6C]" />
      </button>
      )}
    </div>
  )
}
