'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Check, MapPin, Loader2, Map, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { openFurgonetkaMap } from '@/components/FurgonetkaMap'
import toast from 'react-hot-toast'
import type { Shipping_methods } from 'sanity.types'
import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import { SHIPPING_ASSETS } from 'shippingConfig'
import PriceFormatter from '@/components/PriceFormatter'
import Field from './Field'
import Step2PaymentForm, { type PaymentMethod } from './Step2PaymentForm'

// ─── types ────────────────────────────────────────────────────────────────────

interface PickupCandidate {
  code:     string
  name:     string
  carrier:  string
  distance: number | null
  street:   string
  city:     string
  postcode: string
}

export interface Step2Result {
  serviceCode:   string
  pickupPoint?:  CheckoutPickupPoint
  paymentMethod: PaymentMethod
}

interface Props {
  address:      CheckoutAddress
  deliveryType: 'kurier' | 'automat'
  services:     Shipping_methods[]
  onEdit:       () => void
  onContinue:   (data: Step2Result) => void
}

// ─── carrier → asset key ──────────────────────────────────────────────────────

const CARRIER_ASSET_MAP: Record<string, string> = {
  inpost: 'inpost-automat',
  dpd:    'dpd-automat',
  dhl:    'dpd-automat', // fallback
}

function getAssetForCarrier(carrier: string) {
  const key = CARRIER_ASSET_MAP[carrier.toLowerCase()] ?? carrier.toLowerCase()
  return SHIPPING_ASSETS[key] ?? null
}

function getServiceForCarrier(services: Shipping_methods[], carrier: string): Shipping_methods | null {
  const c = carrier.toLowerCase()
  return services.find(s =>
    s.type === 'automat' &&
    (s.furgonetka_service_id?.toLowerCase() === c ||
     s.furgonetka_service_id?.toLowerCase().includes(c) ||
     c.includes(s.furgonetka_service_id?.toLowerCase() ?? '__'))
  ) ?? null
}

// ─── service card (kurier) ────────────────────────────────────────────────────

function ServiceCard({
  service, selected, onClick,
}: {
  service: Shipping_methods; selected: boolean; onClick: () => void
}) {
  const asset = SHIPPING_ASSETS[service.slug?.current as keyof typeof SHIPPING_ASSETS]
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center w-full justify-between px-4 cursor-pointer relative rounded-full h-[55px] transition-all duration-200',
        selected ? 'border-black border-2' : 'border-black hover:border-[#BBBBBB] border',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
          selected ? 'border-black bg-black' : 'border-[#BBBBBB]',
        )}>
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>
        {asset?.logo && <img src={asset.logo.src} alt={service.name ?? ''} className="w-[50px]" />}
        {!asset && <p className="text-[16px] text-fancy-black">{service.name}</p>}
      </div>
      <PriceFormatter className="font-normal text-black text-[15px]" amount={service.internal_price ?? 0} />
    </button>
  )
}

// ─── pickup point card (automat) ─────────────────────────────────────────────

function PickupCard({
  point, selected, price, onClick,
}: {
  point: PickupCandidate; selected: boolean; price: number | null; onClick: () => void
}) {
  const asset = getAssetForCarrier(point.carrier)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full border rounded-2xl px-4 py-3 text-left transition-colors',
        selected ? 'border-black bg-[#F9F9F9]' : 'border-[#D9D9D9] bg-white hover:border-black',
      )}
    >
      <div className="flex items-start gap-3">
        {/* radio indicator */}
        <div className={cn(
          'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center',
          selected ? 'border-black bg-black' : 'border-[#BBBBBB]',
        )}>
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>

        {/* point info */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-black">{point.name}</p>
          {point.street && <p className="text-[12px] text-[#5B5B5B]">{point.street}</p>}
          {(point.postcode || point.city) && (
            <p className="text-[12px] text-[#5B5B5B]">{point.postcode} {point.city}</p>
          )}
        </div>

        {/* distance + logo + price */}
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
          {point.distance !== null && (
            <p className="text-[12px] text-black">{point.distance.toFixed(1)}km</p>
          )}
          {asset?.logo && <img src={asset.logo.src} alt={point.carrier} className="w-[40px]" />}
          {price !== null && (
            <p className="text-[13px] font-medium text-black">{price.toFixed(2).replace('.', ',')} zł</p>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Step2DeliveryPayment({ address, deliveryType, services, onEdit, onContinue }: Props) {
  const kurierServices    = services.filter(s => s.active !== false && s.type === 'kurier')
  const paczkomatServices = services.filter(s => s.active !== false && s.type === 'automat')

  const [serviceCode, setServiceCode]   = useState('')
  const [pickupPoint, setPickupPoint]   = useState<CheckoutPickupPoint | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('przelewy24')

  // kurier: billing address
  const [billingSame, setBillingSame]   = useState(true)
  const [billingFirstName, setBillingFirstName] = useState('')
  const [billingLastName, setBillingLastName]   = useState('')
  const [billingStreet, setBillingStreet]       = useState('')
  const [billingPostal, setBillingPostal]       = useState('')
  const [billingCity, setBillingCity]           = useState('')

  // automat: pickup point search
  const [pickupSearch, setPickupSearch]           = useState('')
  const [pointCandidates, setPointCandidates]     = useState<PickupCandidate[]>([])
  const [isSearching, setIsSearching]             = useState(false)
  const [searchError, setSearchError]             = useState<string | null>(null)

  function normalizePostcode(val: string): string {
    const digits = val.replace(/\D/g, '')
    if (digits.length !== 5) return val.trim()
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }

  async function searchPickupPoints() {
    const q = pickupSearch.trim()
    if (!q) { toast.error('Wpisz kod pocztowy lub adres'); return }

    setIsSearching(true)
    setSearchError(null)
    setPickupPoint(null)

    try {
      const params = new URLSearchParams({ query: q, limit: '20' })
      const res = await fetch(`/api/furgonetka/points/search?${params}`)

      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        const text = await res.text().catch(() => '')
        console.error('Unexpected response:', text.slice(0, 500))
        setSearchError('Nie udało się pobrać punktów — spróbuj ponownie')
        setPointCandidates([])
        return
      }

      const data = await res.json() as { points?: PickupCandidate[]; error?: string }
      const points = data.points ?? []
      setPointCandidates(points)
      if (!points.length) setSearchError('Brak punktów dla podanej lokalizacji')
    } catch (err) {
      console.error('searchPickupPoints error', err)
      setSearchError('Wyszukiwanie nie powiodło się')
      setPointCandidates([])
    } finally {
      setIsSearching(false)
    }
  }

  function selectPickupPoint(point: PickupCandidate) {
    const svc = getServiceForCarrier(services, point.carrier)
    setPickupPoint({ code: point.code, name: point.name, carrier: point.carrier })
    setServiceCode(svc?.furgonetka_service_id ?? point.carrier)
  }

  function handleOpenMap() {
    const q = pickupSearch.trim()
    const location = q
      ? { postcode: normalizePostcode(q) }
      : undefined

    openFurgonetkaMap({
      location,
      onSelect: point => {
        const candidate: PickupCandidate = {
          code:     point.code,
          name:     point.name,
          carrier:  point.carrier,
          distance: null,
          street:   '',
          city:     '',
          postcode: '',
        }
        setPointCandidates(prev =>
          prev.some(p => p.code === point.code) ? prev : [candidate, ...prev],
        )
        selectPickupPoint(candidate)
      },
    })
  }

  function handleContinue() {
    if (!serviceCode) {
      toast.error(deliveryType === 'automat' ? 'Wybierz punkt odbioru' : 'Wybierz metodę dostawy')
      return
    }
    if (deliveryType === 'automat' && !pickupPoint) {
      toast.error('Wybierz punkt odbioru')
      return
    }
    onContinue({
      serviceCode,
      pickupPoint: pickupPoint ?? undefined,
      paymentMethod,
    })
  }

  const formattedAddress = [address.postalCode, address.city, address.street].filter(Boolean).join('  ')

  return (
    <div className="flex flex-col gap-5">
      {/* header */}
      <h2 className="text-[20px] font-medium text-black">
        Dostawa {deliveryType === 'kurier' ? 'kurierem' : 'do punktu'}
      </h2>

      {/* address summary card */}
      <div className="border border-black rounded-[28px] p-5 relative">
        <button
          type="button"
          onClick={onEdit}
          className="absolute right-4 top-4 text-black"
          aria-label="Edytuj dane adresata"
        >
          <Pencil size={16} />
        </button>
        <p className="text-[15px] font-medium text-black mb-2">
          {deliveryType === 'kurier' ? 'Dane adresata' : 'Dane adresata'}
        </p>
        <p className="text-[14px] text-[#3D3D3D]">{address.firstName} {address.lastName}</p>
        {deliveryType === 'kurier' && formattedAddress && (
          <p className="text-[14px] text-[#3D3D3D]">{formattedAddress}</p>
        )}
        {deliveryType === 'automat' && (
          <p className="text-[14px] text-[#3D3D3D]">{address.email}</p>
        )}
        <p className="text-[14px] text-[#3D3D3D]">+48 {address.phone}</p>
      </div>

      {/* billing address toggle (kurier only) */}
      <AnimatePresence>
        {deliveryType === 'kurier' && (
          <motion.div key="billing"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">

            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setBillingSame(v => !v)}
                className={cn(
                  'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  billingSame ? 'bg-black border-black' : 'border-[#BBBBBB]',
                )}
              >
                {billingSame && <Check size={11} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-[15px] text-black">Adres do faktury jest taki sam jak adres wysyłki</span>
            </label>

            <AnimatePresence>
              {!billingSame && (
                <motion.div key="billing-form"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Imię" placeholder="Jan" value={billingFirstName} onChange={e => setBillingFirstName(e.target.value)} />
                    <Field label="Nazwisko" placeholder="Kowalski" value={billingLastName} onChange={e => setBillingLastName(e.target.value)} />
                  </div>
                  <Field label="Adres" placeholder="Mickiewicza 99" value={billingStreet} onChange={e => setBillingStreet(e.target.value)} />
                  <div className="grid sm:grid-cols-3 gap-4">
                    <Field label="Kod pocztowy" placeholder="33-100" maxLength={6} value={billingPostal} onChange={e => setBillingPostal(e.target.value)} />
                    <Field label="Miejscowość" placeholder="Tarnów" value={billingCity} onChange={e => setBillingCity(e.target.value)} />
                    <Field label="Kraj/region" placeholder="Polska" value="Polska" readOnly className="bg-[#F9F9F9] cursor-default" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* delivery methods */}
      <div className="space-y-3">
        <h3 className="text-[18px] font-medium text-black">Metody dostawy</h3>

        {deliveryType === 'automat' ? (
          <>
            {/* postal code / address search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[15px] text-black">Kod pocztowy / Miejscowość</p>
                <button
                  type="button"
                  onClick={handleOpenMap}
                  className="text-black hover:opacity-70 transition-opacity"
                  aria-label="Otwórz mapę"
                >
                  <Map size={18} />
                </button>
              </div>

              <div className="relative">
                <input
                  value={pickupSearch}
                  onChange={e => { setPickupSearch(e.target.value); setSearchError(null) }}
                  onKeyDown={e => e.key === 'Enter' && searchPickupPoints()}
                  placeholder="33-205"
                  className="w-full border border-black rounded-full px-4 py-3 text-[15px] pr-12 focus:outline-none placeholder:text-[#BBBBBB]"
                />
                <button
                  type="button"
                  onClick={searchPickupPoints}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:opacity-70"
                  aria-label="Szukaj punktów"
                >
                  {isSearching
                    ? <Loader2 size={16} className="animate-spin" />
                    : <MapPin size={16} />
                  }
                </button>
              </div>

              {searchError && <p className="text-[13px] text-[#6C6C6C]">{searchError}</p>}
            </div>

            {/* pickup point list */}
            {pointCandidates.length > 0 && (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {pointCandidates.map(point => {
                  const svc = getServiceForCarrier(paczkomatServices, point.carrier)
                  return (
                    <PickupCard
                      key={point.code}
                      point={point}
                      selected={pickupPoint?.code === point.code}
                      price={svc?.internal_price ?? null}
                      onClick={() => selectPickupPoint(point)}
                    />
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* kurier service radio buttons */
          <div className="space-y-3">
            {kurierServices.length === 0 ? (
              <p className="text-[15px] text-[#6C6C6C]">Brak dostępnych metod dostawy.</p>
            ) : (
              kurierServices.map(s => (
                <ServiceCard
                  key={s._id}
                  service={s}
                  selected={serviceCode === s.furgonetka_service_id}
                  onClick={() => setServiceCode(s.furgonetka_service_id ?? '')}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* payment */}
      <div className="space-y-3">
        <h3 className="text-[18px] font-medium text-black">Płatność</h3>
        <Step2PaymentForm value={paymentMethod} onChange={setPaymentMethod} />
      </div>

      {/* continue */}
      <Button
        type="button"
        onClick={handleContinue}
        className="w-fit rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 px-8 hover:bg-fancy-black/90 transition-colors"
      >
        Przejdź do podsumowania
        <ChevronRight size={16} className="ml-2" />
      </Button>

      {/* disabled Finalizacja placeholder */}
      <div className="h-13 w-full rounded-full bg-linear-to-b from-[#F7F7F7] to-[#CFCFCF] opacity-70 flex items-center px-6">
        <span className="text-[16px] text-[#999] font-medium">Finalizacja</span>
      </div>
    </div>
  )
}
