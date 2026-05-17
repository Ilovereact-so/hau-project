'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, MapPin, ChevronRight, Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { openFurgonetkaMap } from '@/components/FurgonetkaMap'
import toast from 'react-hot-toast'
import type { Shipping_methods } from 'sanity.types'
import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import type { SavedAddress } from '@/actions/address'
import Field from './Field'
import Container from '@/components/Container'
import { SHIPPING_ASSETS } from 'shippingConfig'
import PriceFormatter from '@/components/PriceFormatter'
import FurgonetkaTest from '@/components/FurgonetkaTest'

// ─── delivery type card ───────────────────────────────────────────────────────

function DeliveryTypeCard({
  icon: Icon, label, selected, onClick,
}: {
  icon: React.ElementType; label: string; selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center cursor-pointer relative rounded-full h-[55px] transition-all duration-200 flex-1',
        selected ? 'border-black border-2' : 'border-black hover:border-[#BBBBBB] border-1',
      )}
    >
      <div className={`absolute left-6 top-[50%] translate-y-[-50%]`}>
        <Icon size={22} className={`text-black`} />
      </div>
      <span className={cn(
        'text-[16px] font-medium transition-colors',
        selected ? 'text-fancy-black' : 'text-[#6C6C6C]',
      )}>
        {label}
      </span>
    </button>
  )
}

// ─── service radio card ───────────────────────────────────────────────────────

function ServiceCard({
  service, selected, onClick,
}: {
  service: Shipping_methods; selected: boolean; onClick: () => void
}) {
  const shippingAsset = SHIPPING_ASSETS[service.slug?.current as keyof typeof SHIPPING_ASSETS]

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center w-full justify-between px-4 cursor-pointer relative rounded-full h-[55px] transition-all duration-200 flex-1',
        selected ? 'border-black border-2' : 'border-black hover:border-[#BBBBBB] border-1',
      )}
    >
      <div className="flex items-center flex-nowrap space-x-2">
        <img src={shippingAsset?.logo.src} alt={service.name} className="w-[50px]" />
        {shippingAsset?.displayName ?? <p className="text-[16px] text-fancy-black">{service.name}</p>}
      </div>
      <span className="text-[16px] text-fancy-black whitespace-nowrap mr-3">
        <PriceFormatter className='font-normal text-black' amount={service.internal_price ?? 0} />
      </span>
    </button>
  )
}

// ─── step 1 ───────────────────────────────────────────────────────────────────

const EMPTY_ADDRESS: CheckoutAddress = {
  firstName: '', lastName: '', email: '', phone: '',
  street: '', city: '', postalCode: '', country: 'PL',
}

export interface Step1Result {
  address:      CheckoutAddress
  deliveryType: 'kurier' | 'automat'
  serviceCode:  string   // furgonetka_service_id from Sanity
  pickupPoint?: CheckoutPickupPoint
}

interface Props {
  services:     Shipping_methods[]
  savedAddress: SavedAddress | null
  onContinue:   (data: Step1Result) => void
}

export default function Step1Address({ services, savedAddress, onContinue }: Props) {
  const [address, setAddress]                 = useState<CheckoutAddress>(savedAddress ?? EMPTY_ADDRESS)
  const [deliveryType, setDeliveryType]       = useState<'kurier' | 'automat'>('kurier')
  const [serviceCode, setServiceCode]         = useState('')
  const [additionalField, setAdditionalField] = useState(false)
  const [pickupPoint, setPickupPoint]         = useState<CheckoutPickupPoint | null>(null)
  const [errors, setErrors]                   = useState<Partial<Record<keyof CheckoutAddress, string>>>({})

  const activeServices    = services.filter(s => s.active !== false)
  const kurierServices    = activeServices.filter(s => s.type === 'kurier')
  const paczkomatServices = activeServices.filter(s => s.type === 'automat')
  const visibleServices   = deliveryType === 'kurier' ? kurierServices : paczkomatServices
  const selectedService   = visibleServices.find(s => s.furgonetka_service_id === serviceCode) ?? null

  function switchType(t: 'kurier' | 'automat') {
    setDeliveryType(t)
    setServiceCode('')
    setPickupPoint(null)
  }


  function selectPaczkomat(s: Shipping_methods) {
    if (!s.furgonetka_service_id) return
    setServiceCode(s.furgonetka_service_id)
    setPickupPoint(null)
    // Re-open map filtered to this provider only
    openFurgonetkaMap({
      courierServices: [s.furgonetka_service_id],
      onSelect: point => setPickupPoint(point),
    })
  }

  function setField<K extends keyof CheckoutAddress>(key: K, val: CheckoutAddress[K]) {
    setAddress(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof CheckoutAddress, string>> = {}
    if (!address.firstName.trim())                          e.firstName  = 'Wymagane'
    if (!address.lastName.trim())                           e.lastName   = 'Wymagane'
    if (!address.email.includes('@'))                       e.email      = 'Nieprawidłowy email'
    if (!address.phone.trim())                              e.phone      = 'Wymagane'
    if (deliveryType === 'kurier') {
      if (!address.street.trim())                           e.street     = 'Wymagane'
      if (!address.city.trim())                             e.city       = 'Wymagane'
      if (!/^\d{2}-\d{3}$/.test(address.postalCode))       e.postalCode = 'Format: XX-XXX'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleContinue() {
    if (!validate())                                       { toast.error('Uzupełnij wymagane pola');  return }
    if (!serviceCode)                                      { toast.error('Wybierz metodę dostawy');    return }
    if (deliveryType === 'automat' && !pickupPoint)        { toast.error('Wybierz punkt odbioru');     return }
    onContinue({ address, deliveryType, serviceCode, pickupPoint: pickupPoint ?? undefined })
  }

  function handleReopenMap() {
    const code = selectedService?.furgonetka_service_id
    if (!code) return
    openFurgonetkaMap({
      courierServices: [code],
      onSelect: point => setPickupPoint(point),
    })
  }

  return (
    <div className='flex space-x-15'>
    <div className="flex flex-col w-[60%]">
      <h2 className="text-[20px] font-medium text-black my-4">Wybierz metodę dostawy:</h2>

      <div className="flex gap-4 my-2">
        <DeliveryTypeCard icon={Truck}  label="Wysyłka" selected={deliveryType === 'kurier'}  onClick={() => switchType('kurier')} />
        <DeliveryTypeCard icon={MapPin} label="Odbiór"  selected={deliveryType === 'automat'} onClick={() => switchType('automat')} />
      </div>

      <div className="space-y-5 mt-5">
        <div className="space-y-4">
          <Field label="E-mail" type="email" placeholder="jankowalski@gmail.com"
            value={address.email} onChange={e => setField('email', e.target.value)} error={errors.email} />

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Imię" placeholder="Jan"
              value={address.firstName} onChange={e => setField('firstName', e.target.value)} error={errors.firstName} />
            <Field label="Nazwisko" placeholder="Kowalski"
              value={address.lastName} onChange={e => setField('lastName', e.target.value)} error={errors.lastName} />
          </div>

          <AnimatePresence>
            {deliveryType === 'kurier' && (
              <motion.div key="addr" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-4">
                <Field label="Adres" placeholder="Mieszkowica 98"
                  value={address.street} onChange={e => setField('street', e.target.value)} error={errors.street} />
                <div className="grid sm:grid-cols-3 gap-4">
                  <Field label="Kod pocztowy" placeholder="31-100" maxLength={6}
                    value={address.postalCode} onChange={e => setField('postalCode', e.target.value)} error={errors.postalCode} />
                  <Field label="Miejscowość" placeholder="Tarnów"
                    value={address.city} onChange={e => setField('city', e.target.value)} error={errors.city} />
                  <Field label="Kraj/region" placeholder="Polska" value="Polska" readOnly
                    className="bg-[#F9F9F9] cursor-default" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Field label="Telefon" type="tel" placeholder="848037241"
            value={address.phone} onChange={e => setField('phone', e.target.value)} error={errors.phone} />

          <AnimatePresence mode="wait">
            {!additionalField ? (
              <div onClick={() => setAdditionalField(true)} className="text-[16px] cursor-pointer flex items-center text-black">
                <Plus size={18} className="text-black mr-2" />
                <p>mieszkanie / apartament / lokal</p>
              </div>
            ) : (
              <motion.div key="addr2" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                <Field label="mieszkanie / apartament / lokal" placeholder="13"
                  value={address.apartment_number || ''} onChange={e => setField('apartment_number', e.target.value)} error={errors.apartment_number} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

    {/* delivery method */}
      <div className="flex flex-col w-[40%] justify-between items-end">
        <div className='flex flex-col w-full'>
        <h2 className="text-[20px] font-medium text-black my-4">Oferowane formy dostawy:</h2>
          
          <AnimatePresence mode="wait">
            <motion.div key={deliveryType} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-3 mt-6">
              {visibleServices.length === 0 ? (
                <p className="text-[16px] text-[#6C6C6C]">Brak dostępnych metod dostawy.</p>
              ) : (
                visibleServices.map(s => (
                  <ServiceCard
                    key={s._id}
                    service={s}
                    selected={serviceCode === s.furgonetka_service_id}
                    onClick={() => {
                      if (deliveryType === 'automat') {
                        selectPaczkomat(s)
                      } else {
                        setServiceCode(s.furgonetka_service_id ?? '')
                      }
                    }}
                  />
                ))
              )}
            </motion.div>
          </AnimatePresence>

          {/* pickup point display — automat only */}
          <AnimatePresence>
            {deliveryType === 'automat' && serviceCode && (
              <motion.div key="pickup" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                {pickupPoint ? (
                  <div className="border border-[#E8E8E8] rounded-xl p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-fancy-black flex items-center justify-center flex-shrink-0">
                      <Check size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-fancy-black">{pickupPoint.name}</p>
                      <p className="text-[12px] text-[#6C6C6C]">{pickupPoint.code}</p>
                    </div>
                    <button type="button" onClick={handleReopenMap}
                      className="text-[12px] text-fancy-black underline underline-offset-2 whitespace-nowrap">
                      Zmień
                    </button>
                  </div>
                ) : (
                  <Button type="button" onClick={handleReopenMap} variant="outline"
                    className="w-full rounded-xl border-2 border-fancy-black bg-white text-fancy-black font-semibold text-[14px] py-3 hover:bg-fancy-black/5 transition-colors">
                    <MapPin size={15} className="mr-2" />
                    Wybierz punkt odbioru
                  </Button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Button type="button" onClick={handleContinue}
          className="w-fit rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 px-6 hover:bg-fancy-black/90 transition-colors">
          Zapisz i kontynuj
          <ChevronRight size={16} className="ml-2" />
        </Button>
      </div>
    </div>
  )
}
