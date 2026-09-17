'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, ChevronDown, Loader2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'autopay' | 'cod'

export interface GatewaySelection {
  method:       PaymentMethod
  gatewayId?:   number
  gatewayName?: string
  saveCard?:    boolean
  /** „Inne metody płatności” — wybór kanału po stronie Autopay. */
  other?:       boolean
  /** BLIK-0 aktywny — kod zbieramy w podsumowaniu zamówienia. */
  blik0?:       boolean
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
  recurringEnabled?: boolean
  blik0Enabled?:     boolean
  cardIframeEnabled?: boolean
}

const CARD_GATEWAY_ID = 1500
const BLIK_GATEWAY_ID = 509

/** Kanały pokazywane zawsze na wierzchu — reszta (banki PBL) chowa się pod rozwijaniem. */
const FEATURED_GATEWAY_IDS = new Set([BLIK_GATEWAY_ID, CARD_GATEWAY_ID, 1512, 1513])

interface Props {
  value:    GatewaySelection
  onChange: (v: GatewaySelection) => void
}

// ─── logo components ──────────────────────────────────────────────────────────

function LogoBlik() {
  return (
    <span className="inline-flex items-center justify-center bg-black text-white text-[11px] font-black tracking-wide px-2.5 py-1 rounded-[6px] leading-none select-none">
      blik
    </span>
  )
}

function LogoCards() {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[11px] font-bold text-[#1A1F71] border border-[#1A1F71] px-1.5 py-0.5 rounded leading-none">VISA</span>
      <span className="inline-flex items-center">
        <span className="w-5 h-5 rounded-full bg-[#EB001B] inline-block -mr-2.5"/>
        <span className="w-5 h-5 rounded-full bg-[#F79E1B] inline-block"/>
      </span>
    </span>
  )
}

function LogoGooglePay() {
  return (
    <span className="flex items-center gap-1">
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 11.5v-3h7.1c.1.5.1 1 .1 1.5 0 4.1-2.8 7-7.2 7-4.1 0-7.5-3.4-7.5-7.5S7.9 4 12 4c2 0 3.7.7 5 1.9l-2.1 2.1C14 7.3 13.1 7 12 7c-2.8 0-5 2.2-5 5s2.2 5 5 5c2.3 0 3.8-1.2 4.3-3H12v-2.5z" fill="#4285F4"/>
      </svg>
      <span className="text-[13px] font-medium tracking-tight">
        <span style={{color:'#4285F4'}}>G</span><span style={{color:'#EA4335'}}>o</span><span style={{color:'#FBBC05'}}>o</span><span style={{color:'#4285F4'}}>g</span><span style={{color:'#34A853'}}>l</span><span style={{color:'#EA4335'}}>e</span>
        <span className="text-black font-medium"> Pay</span>
      </span>
    </span>
  )
}

function LogoApplePay() {
  return (
    <span className="flex items-center gap-1">
      <svg width="13" height="16" viewBox="0 0 814 1000" fill="currentColor" aria-hidden="true">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.8-155.5-127.4C46 790.8.1 693.7.1 601.8c0-159.2 103.7-243.6 205.1-243.6 54.1 0 99.4 35.7 133.5 35.7 32.6 0 84.4-37.8 147-37.8 23.7 0 108.2 2.6 168.1 81.2zm-97.8-187.1c32.1-38.1 55.1-90.9 55.1-143.7 0-7.7-.6-15.4-1.9-21.7-52.5 1.9-114.1 35.1-151.5 79.2-28.9 33.3-56.4 85.4-56.4 139.5 0 8.3 1.3 16.6 1.9 19.1 3.2.6 8.4 1.3 13.5 1.3 47.4 0 105.6-31.9 139.3-73.7z"/>
      </svg>
      <span className="text-[13px] font-medium text-black"> Pay</span>
    </span>
  )
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

function SaveCardCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      className="px-4 py-3 bg-[#FAFAFA] border-t border-[#F0F0F0] flex items-center gap-3 cursor-pointer select-none"
      onClick={() => onChange(!checked)}
    >
      <div className={cn(
        'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
        checked ? 'bg-fancy-black border-fancy-black' : 'border-[#C0C0C0] bg-white',
      )}>
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span className="text-[13px] text-[#3D3D3D]">
        Zapisz kartę do przyszłych płatności
      </span>
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Step2PaymentForm({ value, onChange }: Props) {
  const [gateways,   setGateways]   = useState<AutopayGateway[]>([])
  const [loading,    setLoading]    = useState(true)
  const [isDev,      setIsDev]      = useState(false)
  const [recurring,  setRecurring]  = useState(false)
  const [blik0,      setBlik0]      = useState(false)
  const [showAllBanks, setShowAllBanks] = useState(false)

  useEffect(() => {
    let active = true

    fetch('/api/autopay/gateways')
      .then(r => r.json())
      .then((data: GatewaysResponse) => {
        if (!active) return
        setGateways(data.gateways ?? [])
        setIsDev(!!data.dev)
        setRecurring(!!data.recurringEnabled)
        setBlik0(!!data.blik0Enabled)
      })
      .catch(() => { if (active) setGateways([]) })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  const { featured, banks } = useMemo(() => {
    const featured = gateways.filter(g => FEATURED_GATEWAY_IDS.has(g.gatewayID))
    const banks    = gateways.filter(g => !FEATURED_GATEWAY_IDS.has(g.gatewayID))
    return { featured, banks }
  }, [gateways])

  function selectGateway(gateway: AutopayGateway) {
    onChange({
      method:      'autopay',
      gatewayId:   gateway.gatewayID,
      gatewayName: gateway.gatewayName,
      other:       false,
      blik0:       gateway.gatewayID === BLIK_GATEWAY_ID && blik0,
      saveCard:    gateway.gatewayID === CARD_GATEWAY_ID ? (value.saveCard ?? false) : undefined,
    })
  }

  function selectOther() {
    onChange({
      method:      'autopay',
      gatewayId:   undefined,
      gatewayName: 'Inne metody płatności',
      other:       true,
      blik0:       false,
      saveCard:    undefined,
    })
  }

  function renderGatewayRow(gateway: AutopayGateway) {
    const selected = value.method === 'autopay' && !value.other && value.gatewayId === gateway.gatewayID
    const isCard   = gateway.gatewayID === CARD_GATEWAY_ID

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

        {isCard && selected && recurring && (
          <SaveCardCheckbox
            checked={value.saveCard ?? false}
            onChange={v => onChange({ ...value, saveCard: v })}
          />
        )}
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
      <button
        type="button"
        onClick={() => onChange({ method: 'cod', gatewayId: undefined, gatewayName: undefined, saveCard: undefined, other: false, blik0: false })}
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
    </div>
  )
}
