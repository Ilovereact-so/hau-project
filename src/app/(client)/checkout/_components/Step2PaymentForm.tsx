'use client'

import { useEffect, useMemo, useState } from 'react'
import { Banknote, Check, ChevronDown, Loader2, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CardBrandMark, LogoApplePay, LogoBlik, LogoCards, LogoGooglePay } from '@/components/payment/PaymentLogos'
import { getCheckoutSavedCards } from '@/actions/savedCards'
import {
  ONECLICK_GATEWAY_ID,
  SAVE_CARD_AGREEMENT,
  cardBrandLabel,
  cardExpiryLabel,
  cardMaskLabel,
  cardShortLabel,
  isCardExpired,
  type SavedCardView,
} from '@/lib/savedCardsShared'

// ─── types ────────────────────────────────────────────────────────────────────

export type PaymentMethod = 'autopay' | 'cod'

export interface GatewaySelection {
  method:       PaymentMethod
  gatewayId?:   number
  gatewayName?: string
  saveCard?:    boolean
  /** Płatność zapisaną kartą — `id` karty z konta (token zostaje na serwerze). */
  savedCardId?: string
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
  /** Zapamiętanie karty wymaga konta — gość go nie widzi. */
  allowSaveCard?: boolean
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

/**
 * Zgoda na zapis karty (Autopay One Click). Zaznaczenie = `RecurringAcceptanceState
 * =ACCEPTED` w transakcji, więc pod checkboksem stoi pełna treść zgody.
 */
function SaveCardCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="ml-[38px] mr-2 mb-2 mt-1 px-4 py-3 rounded-[16px] bg-[#FAFAFA] border border-[#F0F0F0] flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.target.checked)}
        className="sr-only peer"
      />
      <span
        aria-hidden="true"
        className={cn(
          'mt-[1px] w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-black/30',
          checked ? 'bg-fancy-black border-fancy-black' : 'border-[#C0C0C0] bg-white',
        )}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[#3D3D3D]">
          Zapamiętaj kartę do kolejnych zakupów
        </span>
        <span className="block text-[11px] leading-snug text-[#8E8E8E] mt-1">
          {SAVE_CARD_AGREEMENT}
        </span>
      </span>
    </label>
  )
}

/** Wiersz zapisanej karty — jak kanał płatności, ale z danymi karty. */
function SavedCardRow({ card, selected, onSelect }: { card: SavedCardView; selected: boolean; onSelect: () => void }) {
  const expired = isCardExpired(card.expiryMonth, card.expiryYear)
  const expiry = cardExpiryLabel(card.expiryMonth, card.expiryYear)
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={expired}
      aria-pressed={selected}
      className={cn(
        'w-full text-left h-17 flex items-center pl-2 pr-4 gap-4 transition-colors rounded-[20px]',
        selected ? 'bg-fancy-black/[0.03]' : 'bg-transparent',
        expired && 'opacity-50 cursor-not-allowed',
      )}
    >
      <Radio selected={selected} />
      <div className="flex-1 min-w-0">
        <p className="text-[clamp(13px,1.4vw,15px)] font-medium text-fancy-black leading-tight">
          {cardBrandLabel(card.cardBrand)}
          {cardMaskLabel(card.maskedNumber) && (
            <span className="font-normal text-[#6C6C6C] ml-2 tracking-wide">{cardMaskLabel(card.maskedNumber)}</span>
          )}
        </p>
        <p className={cn('text-[clamp(11px,1.4vw,12px)] mt-0.5', expired ? 'text-[#DE3232]' : 'text-[#6C6C6C]')}>
          {expired ? 'Karta wygasła — zapłać inną metodą' : `Zapisana karta${expiry ? ` · ważna do ${expiry}` : ''}`}
        </p>
      </div>
      <div className="flex-shrink-0 flex items-center justify-end min-w-[60px]">
        <CardBrandMark brand={card.cardBrand} />
      </div>
    </button>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Step2PaymentForm({ value, onChange, allowSaveCard = true }: Props) {
  const [gateways,   setGateways]   = useState<AutopayGateway[]>([])
  const [loading,    setLoading]    = useState(true)
  const [isDev,      setIsDev]      = useState(false)
  const [recurring,  setRecurring]  = useState(false)
  const [blik0,      setBlik0]      = useState(false)
  const [showAllBanks, setShowAllBanks] = useState(false)
  const [savedCards, setSavedCards] = useState<SavedCardView[]>([])

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

  // Zapisane karty — tylko dla zalogowanych i przy włączonych płatnościach
  // zapisaną kartą (serwer zwraca pustą listę, gdy usługa jest wyłączona).
  useEffect(() => {
    if (!allowSaveCard || !recurring) { setSavedCards([]); return }
    let active = true
    getCheckoutSavedCards()
      .then(cards => { if (active) setSavedCards(cards) })
      .catch(() => { if (active) setSavedCards([]) })
    return () => { active = false }
  }, [allowSaveCard, recurring])

  const { featured, banks } = useMemo(() => {
    // „Płatność kartą One Click” (1503) nie jest osobną metodą do wyboru —
    // obsługują ją zgoda „Zapamiętaj kartę” i wiersze zapisanych kart.
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
      blik0:       gateway.gatewayID === BLIK_GATEWAY_ID && blik0,
      saveCard:    gateway.gatewayID === CARD_GATEWAY_ID ? (value.saveCard ?? false) : undefined,
      savedCardId: undefined,
    })
  }

  function selectSavedCard(card: SavedCardView) {
    onChange({
      method:      'autopay',
      gatewayId:   ONECLICK_GATEWAY_ID,
      gatewayName: cardShortLabel(card),
      savedCardId: card.id,
      other:       false,
      blik0:       false,
      saveCard:    undefined,
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
      savedCardId: undefined,
    })
  }

  function renderGatewayRow(gateway: AutopayGateway) {
    const selected = value.method === 'autopay' && !value.other && !value.savedCardId && value.gatewayId === gateway.gatewayID
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

        {isCard && selected && recurring && allowSaveCard && (
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
            {savedCards.length > 0 && (
              <div className="mb-2 pb-2 border-b border-[#F0F0F0]">
                <p className="pl-2 pt-1 pb-1 text-[clamp(11px,1.4vw,12px)] font-medium uppercase tracking-[0.06em] text-[#8E8E8E]">
                  Twoje zapisane karty
                </p>
                {savedCards.map(card => (
                  <SavedCardRow
                    key={card.id}
                    card={card}
                    selected={value.method === 'autopay' && value.savedCardId === card.id}
                    onSelect={() => selectSavedCard(card)}
                  />
                ))}
              </div>
            )}

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
        onClick={() => onChange({ method: 'cod', gatewayId: undefined, gatewayName: undefined, saveCard: undefined, savedCardId: undefined, other: false, blik0: false })}
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
