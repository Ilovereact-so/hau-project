'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, MapPin, ChevronRight, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { openFurgonetkaMap } from '@/components/FurgonetkaMap'
import toast from 'react-hot-toast'
import type { DeliveryService } from '@/actions/deliveryServices'
import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import type { SavedAddress } from '@/actions/address'
import Field from './Field'

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
        'flex flex-col items-center justify-center gap-2.5 py-5 px-6 rounded-2xl border-2 transition-all duration-200 flex-1',
        selected ? 'border-fancy-black bg-white' : 'border-[#E8E8E8] bg-white hover:border-[#BBBBBB]',
      )}
    >
      <div className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
        selected ? 'bg-fancy-black' : 'bg-[#F4F4F4]',
      )}>
        <Icon size={22} className={selected ? 'text-white' : 'text-[#6C6C6C]'} />
      </div>
      <span className={cn(
        'text-[14px] font-semibold transition-colors',
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
  service: DeliveryService; selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left border-2 rounded-xl p-4 transition-all duration-200 flex items-center gap-4',
        selected ? 'border-fancy-black bg-fancy-black/[0.03]' : 'border-[#E8E8E8] hover:border-[#BBBBBB]',
      )}
    >
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
        selected ? 'border-fancy-black' : 'border-[#BBBBBB]',
      )}>
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-fancy-black" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-fancy-black">{service.name}</p>
        {service.estimatedDays && (
          <p className="text-[12px] text-[#6C6C6C] mt-0.5">{service.estimatedDays}</p>
        )}
      </div>
      <span className="text-[14px] font-semibold text-fancy-black whitespace-nowrap">
        {(service.priceCents / 100).toFixed(2)} zł
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
  deliveryType: 'kurier' | 'paczkomat'
  serviceCode:  string
  pickupPoint?: CheckoutPickupPoint
}

interface Props {
  services:     DeliveryService[]
  savedAddress: SavedAddress | null
  onContinue:   (data: Step1Result) => void
}

export default function Step1Address({ services, savedAddress, onContinue }: Props) {
  const [address, setAddress]           = useState<CheckoutAddress>(savedAddress ?? EMPTY_ADDRESS)
  const [deliveryType, setDeliveryType] = useState<'kurier' | 'paczkomat'>('kurier')
  const [serviceCode, setServiceCode]   = useState('')
  const [pickupPoint, setPickupPoint]   = useState<CheckoutPickupPoint | null>(null)
  const [errors, setErrors]             = useState<Partial<Record<keyof CheckoutAddress, string>>>({})

  const kurierServices    = services.filter(s => s.deliveryType === 'kurier')
  const paczkomatServices = services.filter(s => s.deliveryType === 'paczkomat')
  const visibleServices   = deliveryType === 'kurier' ? kurierServices : paczkomatServices
  const selectedService   = visibleServices.find(s => s.serviceCode === serviceCode) ?? null

  function switchType(t: 'kurier' | 'paczkomat') {
    setDeliveryType(t)
    setServiceCode('')
    setPickupPoint(null)
  }

  function setField<K extends keyof CheckoutAddress>(key: K, val: CheckoutAddress[K]) {
    setAddress(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof CheckoutAddress, string>> = {}
    if (!address.firstName.trim())         e.firstName = 'Wymagane'
    if (!address.lastName.trim())          e.lastName  = 'Wymagane'
    if (!address.email.includes('@'))      e.email     = 'Nieprawidłowy email'
    if (!address.phone.trim())             e.phone     = 'Wymagane'
    if (deliveryType === 'kurier') {
      if (!address.street.trim())          e.street     = 'Wymagane'
      if (!address.city.trim())            e.city       = 'Wymagane'
      if (!/^\d{2}-\d{3}$/.test(address.postalCode)) e.postalCode = 'Format: XX-XXX'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleContinue() {
    if (!validate())                                    { toast.error('Uzupełnij wymagane pola');    return }
    if (!serviceCode)                                   { toast.error('Wybierz metodę dostawy');      return }
    if (deliveryType === 'paczkomat' && !pickupPoint)   { toast.error('Wybierz punkt odbioru');       return }
    onContinue({ address, deliveryType, serviceCode, pickupPoint: pickupPoint ?? undefined })
  }

  function handleOpenMap() {
    if (!selectedService?.mapServiceCode) return
    openFurgonetkaMap({
      courierServices: [selectedService.mapServiceCode],
      onSelect: point => setPickupPoint(point),
    })
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* left: address form */}
      <div className="lg:col-span-2 space-y-5">
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-4">
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

          <p className="text-[12px] text-[#BBBBBB]">* nazwa firmy / mieszkanie / apartament / lokal</p>
        </div>
      </div>

      {/* right: delivery method */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-5">
          <h2 className="text-[15px] font-semibold text-fancy-black">Wybierz metodę dostawy:</h2>

          <div className="flex gap-3">
            <DeliveryTypeCard icon={Truck} label="Wysyłka" selected={deliveryType === 'kurier'} onClick={() => switchType('kurier')} />
            <DeliveryTypeCard icon={MapPin} label="Odbiór" selected={deliveryType === 'paczkomat'} onClick={() => switchType('paczkomat')} />
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={deliveryType} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.15 }} className="space-y-3">
              {visibleServices.length === 0 ? (
                <p className="text-[13px] text-[#6C6C6C]">Brak dostępnych metod dostawy.</p>
              ) : (
                visibleServices.map(s => (
                  <ServiceCard key={s.serviceCode} service={s} selected={serviceCode === s.serviceCode}
                    onClick={() => { setServiceCode(s.serviceCode); setPickupPoint(null) }} />
                ))
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence>
            {deliveryType === 'paczkomat' && serviceCode && (
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
                    <button type="button" onClick={handleOpenMap}
                      className="text-[12px] text-fancy-black underline underline-offset-2 whitespace-nowrap">
                      Zmień
                    </button>
                  </div>
                ) : (
                  <Button type="button" onClick={handleOpenMap} variant="outline"
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
          className="w-full rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 hover:bg-fancy-black/90 transition-colors">
          Zapisz i kontynuj
          <ChevronRight size={16} className="ml-2" />
        </Button>
      </div>
    </div>
  )
}
