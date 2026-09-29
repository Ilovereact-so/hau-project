'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Check, Loader2, Map, SquarePen, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { openFurgonetkaMap } from '@/components/FurgonetkaMap'
import toast from 'react-hot-toast'
import type { Shipping_methods } from 'sanity.types'
import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import { SHIPPING_ASSETS } from 'shippingConfig'
import PriceFormatter from '@/components/PriceFormatter'
import Field from './Field'
import Step2PaymentForm, { type PaymentMethod, type GatewaySelection } from './Step2PaymentForm'
import Image from 'next/image'


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
  gatewayId?:    number
  gatewayName?:  string
  saveCard?:     boolean
  /** „Inne metody płatności” — kanał wybierany po stronie Autopay. */
  other?:        boolean
  /** BLIK-0 aktywny — kod zbieramy w podsumowaniu zamówienia. */
  blik0?:        boolean
}

interface Props {
  address:      CheckoutAddress
  deliveryType: 'kurier' | 'automat'
  services:     Shipping_methods[]
  onEdit:       () => void
  onContinue:   (data: Step2Result) => void
  dynamicService: (serviceCode: string) => void
}

// ─── carrier → asset key ──────────────────────────────────────────────────────

const CARRIER_ASSET_MAP: Record<string, string> = {
  inpost: 'inpost-automat',
  dpd:    'dpd-automat',
  dhl:    'dpd-automat', // fallback
}

export function getAssetForCarrier(carrier: string) {
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
const EDGE_FADE_SIZE = 40; // px
const maskImage = `linear-gradient(to bottom, transparent 0, black ${EDGE_FADE_SIZE}px, black calc(100% - ${EDGE_FADE_SIZE}px), transparent 100%)`

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
      className={`flex items-center w-auto space-x-20 cursor-pointer relative h-[46px] pl-2 pr-4 rounded-[20px] transition-all duration-200 ${selected ? "bg-fancy-black/[0.03]": ""}`}
      
    >
      <div className="flex items-center space-x-4">
        <div className={cn(
          'w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0',
          selected ? 'border-black bg-black' : 'border-black',
        )}>
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>
        <PriceFormatter className="font-normal text-fancy-black font-medium text-[clamp(14px,1.4vw,15px)]" amount={service.internal_price ?? 0} />
      </div>
      
      {asset?.logo && <Image width={500} height={500} src={asset.logo.src} alt={service.name ?? ''} className="h-[25px] w-[60px]" />}
        {!asset && <p className="text-[clamp(14px,1.4vw,16px)] text-fancy-black">{service.name}</p>}
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
        'w-full pr-4 py-3 text-left'
      )}
    >
      <div className="flex items-start h-auto space-x-3">
        {/* radio indicator */}
        <div className={cn(
          'w-[22px] h-[22px] rounded-full border-2 border-black flex items-center mt-1 justify-center ease-in-out duration-200',
          selected ? ' bg-black' : '',
        )}>
          {selected && <Check size={11} className="text-white" strokeWidth={3} />}
        </div>

        {/* point info */}
        <div className="flex-1">
          <p className="text-[clamp(14px,1.4vw,16px)] font-medium text-black">{point.name}</p>
          {point.street && <p className="text-[clamp(12px,1.4vw,14px)] text-black">{point.street}</p>}
          {(point.postcode || point.city) && (
            <p className="text-[clamp(12px,1.4vw,14px)] text-black">{point.postcode} {point.city}</p>
          )}
        </div>

        {/* distance + logo + price */}
        <div className="text-right flex flex-col h-[69px] justify-between items-end flex-1">
          {point.distance !== null && (
            <p className="text-[clamp(13px,1.4vw,15px)] font-medium text-black">{point.distance.toFixed(1)}km</p>
          )}
          <div className="flex space-x-2 items-center">
            {asset?.logo && <Image width={500} height={500} src={asset.logo.src} alt={point.carrier} className="h-[25px] w-max" />}
            {price !== null && ( 
              <p className="text-[clamp(13px,1.4vw,14px)] text-black">{price.toFixed(2).replace('.', ',')} zł</p>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Step2DeliveryPayment({ address, deliveryType, services, onEdit, onContinue, dynamicService }: Props) {
  // Tylko metody jawnie aktywne — serwer (checkout.ts → fetchShippingPriceCents)
  // przyjmuje wyłącznie `active == true`, więc metoda z nieustawionym polem
  // była widoczna, ale zamówienie z nią kończyło się błędem.
  const kurierServices    = services.filter(s => s.active === true && s.type === 'kurier')
  const paczkomatServices = services.filter(s => s.active === true && s.type === 'automat')

  const [serviceCode, setServiceCode]   = useState('')
  const [pickupPoint, setPickupPoint]   = useState<CheckoutPickupPoint | null>(null)
  const [payment, setPayment] = useState<GatewaySelection>({ method: 'autopay', gatewayId: undefined })

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

  useEffect(()=>{
    dynamicService(serviceCode)
  },[serviceCode, dynamicService])

  const handleOnEdit = ()=>{
    setServiceCode('')
    setPickupPoint(null)
    onEdit()
  }
  async function searchPickupPoints() {
    const q = pickupSearch.trim()
    if (!q) { toast.error('Wpisz kod pocztowy lub adres'); return }

    setIsSearching(true)
    setSearchError(null)
    setPickupPoint(null)

    try {
      const params = new URLSearchParams({ query: q, limit: '20' })
      paczkomatServices.forEach(s => {
        if (s.furgonetka_service_id) params.append('services', s.furgonetka_service_id)
      })
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
    setPickupPoint({ code: point.code, name: point.name, carrier: point.carrier, street: point.street, city: point.city, postcode: point.postcode })
    setServiceCode(svc?.furgonetka_service_id ?? point.carrier)
    setPointCandidates([point])
  }

  function handleOpenMap() {
    const q = pickupSearch.trim()
    const location = q
      ? q : undefined

    const opened = openFurgonetkaMap({
      courierServices: paczkomatServices.map(s => s.furgonetka_service_id ?? '').filter(Boolean),
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
    if (!opened) toast.error('Mapa punktów jest chwilowo niedostępna — wyszukaj punkt po kodzie pocztowym.')
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
    if (payment.method === 'autopay' && !payment.gatewayId && !payment.other) {
      toast.error('Wybierz metodę płatności')
      return
    }
    onContinue({
      serviceCode,
      pickupPoint:   pickupPoint ?? undefined,
      paymentMethod: payment.method,
      gatewayId:     payment.gatewayId,
      gatewayName:   payment.gatewayName,
      saveCard:      payment.saveCard,
      other:         payment.other,
      blik0:         payment.blik0,
    })
  }

  const formattedAddress = [address.postalCode, address.city, address.street].filter(Boolean).join('  ')

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* address summary card */}
      <div className=" bg-fancy-black/[0.03] rounded-[28px] p-5 relative mt-2">
        <button
          type="button"
          onClick={handleOnEdit}
          className="absolute right-4 top-4 text-black cursor-pointer"
          aria-label="Edytuj dane adresata"
        >
          <SquarePen size={20} className="text-fancy-black" />
        </button>
        <p className="text-[clamp(15px,1.8vw,16px)] font-medium text-black mb-2">
          {deliveryType === 'kurier' ? 'Dane adresata' : 'Dane adresata'}
        </p>
        <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D] mb-[1px]">{address.firstName} {address.lastName}</p>
        {deliveryType === 'kurier' && formattedAddress && (
          <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D] mb-[1px]">{formattedAddress}</p>
        )}
        {deliveryType === 'automat' && (
          <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D] mb-[1px]">{address.email}</p>
        )}
        <p className="text-[clamp(13px,1.8vw,15px)] text-[#3D3D3D]">+48 {address.phone}</p>
      </div>

      {/* billing address toggle (kurier only) */}
      <div className={cn(
        "grid transition-all duration-300",
        deliveryType === 'kurier' ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      )}>
        <div className="overflow-hidden space-y-4">
          <label onClick={() => setBillingSame(v => !v)} className="flex items-center gap-3 cursor-pointer">
            <div              
              className={cn(
                'w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                billingSame ? 'bg-black border-black' : 'border-black',
              )}
            >
              {billingSame && <Check size={11} className="text-white" strokeWidth={3} />}
            </div>
            <span className="text-[clamp(13px,1.5vw,15px)] text-black">Adres do faktury jest taki sam jak adres wysyłki</span>
          </label>

          <div className={cn(
            "grid transition-all duration-300",
            !billingSame ? "grid-rows-[1fr] opacity-100 pt-2" : "grid-rows-[0fr] opacity-0"
          )}>
            <div className="overflow-hidden space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Imię" placeholder="Jan" value={billingFirstName} onChange={e => setBillingFirstName(e.target.value)} />
                <Field label="Nazwisko" placeholder="Kowalski" value={billingLastName} onChange={e => setBillingLastName(e.target.value)} />
              </div>
              <Field label="Adres" placeholder="Mickiewicza 99" value={billingStreet} onChange={e => setBillingStreet(e.target.value)} />
              <div className="grid 3xs:grid-cols-3 grid-cols-[auto_33%] gap-4">
                <Field label="Miejscowość" placeholder="Tarnów" value={billingCity} onChange={e => setBillingCity(e.target.value)} />
                <Field label="Kod pocztowy" placeholder="33-100" maxLength={6} value={billingPostal} onChange={e => setBillingPostal(e.target.value)} />                
                <Field label="Kraj/region" placeholder="Polska" value="Polska" readOnly className="bg-[#F9F9F9] cursor-default" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* delivery methods */}
      <div className="space-y-3">
        <h3 className="text-[clamp(15px,1.3vw,18px)] font-medium text-black">Metody dostawy</h3>

        {deliveryType === 'automat' ? (
          <>
            {/* postal code / address search */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[clamp(13px,1.4vw,15px)] text-black">Kod pocztowy / Miejscowość</p>
                <button
                  type="button"
                  onClick={handleOpenMap}
                  className="text-black hover:opacity-70 transition-opacity text-[clamp(13px,1.4vw,15px)]"
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
                  placeholder={address.postalCode ? `${address.postalCode} ${address.city}` : 'np. 33-100 Tarnów'}
                  className="w-full border border-black text-black rounded-full px-4 py-3 text-[clamp(13px,1.4vw,15px)] pr-12 focus:outline-none placeholder:text-[#BBBBBB]"
                />
                <button
                  type="button"
                  onClick={searchPickupPoints}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black hover:opacity-70"
                  aria-label="Szukaj punktów"
                >
                  {isSearching
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Search size={16} />
                  }
                </button>
              </div>

              {searchError && <p className="text-[13px] text-[#6C6C6C]">{searchError}</p>}
            </div>

            {/* pickup point list */}
            {pointCandidates.length > 0 && (
              <div id='deliveryScroll' style={!pickupPoint ? {WebkitMaskImage: maskImage, maskImage } : {}} className="space-y-2 max-h-[320px] ease-in-out duration-200 overflow-y-auto pr-1">
                {pointCandidates.map((point,i) => {
                  const svc = getServiceForCarrier(paczkomatServices, point.carrier)
                  return (
                    <div key={point.code} className='flex flex-col'>
                      <PickupCard
                        key={point.code}
                        point={point}
                        selected={pickupPoint?.code === point.code}
                        price={svc?.internal_price ?? null}
                        onClick={() => selectPickupPoint(point)}
                      />
                      {pointCandidates.length -1 > i &&
                      <hr className='from-black/62 to-50% from-0% border-0 to-transparent bg-gradient-to-l h-[1px]'/>
                      }
                    </div>
                  )
                })}
              </div>
            )}
          </>
        ) : (
          /* kurier service radio buttons */
          <div className="fle flex-col">
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
        <h3 className="text-[clamp(15px,1.4vw,18px)] font-medium text-black">Płatność</h3>
        <Step2PaymentForm value={payment} onChange={setPayment} />
      </div>

      {/* continue */}
      <Button
        type="button"
        onClick={handleContinue}
        className="w-fit rounded-full font-medium bg-fancy-black text-white text-[clamp(14px,1.4vw,16px)] lg:py-6 py-5.5 lg:px-8 px-6 hover:bg-fancy-black/90 transition-colors"
      >
        Przejdź do podsumowania
        <ChevronRight size={18} strokeWidth={3} className="ml-2" />
      </Button>

      {/* disabled Finalizacja placeholder */}
      <div className="h-13 w-full rounded-full bg-fancy-black/[0.03] flex items-center px-6">
        <span className="text-[clamp(14px,1.4vw,15px)] text-[#999] font-medium">Finalizacja</span>
      </div>
    </div>
  )
}
