'use client'

import { useState } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { CheckoutAddress } from '@/actions/checkout'
import type { SavedAddress } from '@/actions/address'
import Field from './Field'

// ─── delivery type tab ────────────────────────────────────────────────────────

export function DeliveryTypeCard({
  icon: Icon, label, selected, onClick, side,
}: {
  icon: React.ElementType; label: string; selected: boolean; onClick: () => void
  /** Pozycja w parze przełączników — lewy zaokrąglany z lewej, prawy nachodzi na lewy. */
  side: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center cursor-pointer relative h-[55px] ease-in-out duration-500  ${
        selected ? 'bg-main px-7 w-[242px] rounded-full justify-between border-main border-3' : 'border-main border-3 w-[100px] justify-center'} ${
        side === 'left' ? selected == false ? "rounded-l-full":"" : selected == false ? "rounded-r-full right-5":"right-5" }
      `}
    >
      <div className="">
        <Icon size={22} className="text-black" />
      </div>
      <div className={`overflow-hidden duration-200 ease-in-out relative h-full ${
        selected ? "w-full" : "w-0"
      }`}>
        <span className={cn(
          'text-[clamp(14px,1.4vw,16px)] text-black font-medium absolute left-0 top-[50%] translate-y-[-50%] w-[170px]',
          selected ? 'opacity-100 ' : 'opacity-0',
        )}>
          {label}
        </span>
      </div>
    </button>
  )
}

// ─── types ────────────────────────────────────────────────────────────────────

const EMPTY_ADDRESS: CheckoutAddress = {
  firstName: '', lastName: '', email: '', phone: '',
  street: '', city: '', postalCode: '', country: 'PL',
}

export interface Step1Result {
  address:      CheckoutAddress
}

interface Props {
  savedAddress: SavedAddress | null
  onContinue:   (data: Step1Result) => void
  deliveryType: 'kurier' | 'automat'
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Step1Address({ savedAddress, onContinue, deliveryType }: Props) {
  const [address, setAddress]               = useState<CheckoutAddress>(savedAddress ?? EMPTY_ADDRESS)
  const [additionalField, setAdditionalField] = useState(false)
  const [errors, setErrors]                 = useState<Partial<Record<keyof CheckoutAddress, string>>>({})


  function setField<K extends keyof CheckoutAddress>(key: K, val: CheckoutAddress[K]) {
    setAddress(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<Record<keyof CheckoutAddress, string>> = {}
    if (!address.firstName.trim())            e.firstName  = 'Wymagane'
    if (!address.lastName.trim())             e.lastName   = 'Wymagane'
    if (!address.email.includes('@'))         e.email      = 'Nieprawidłowy email'
    if (!address.phone.trim())                e.phone      = 'Wymagane'
    if (deliveryType === 'kurier') {
      if (!address.street.trim())             e.street     = 'Wymagane'
      if (!address.city.trim())               e.city       = 'Wymagane'
      if (!/^\d{2}-\d{3}$/.test(address.postalCode)) e.postalCode = 'Format: XX-XXX'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleContinue() {
    if (!validate()) return
    onContinue({address})
  }

  return (
    <div className="flex flex-col w-full">

      {/* address form */}
      <div className="border border-black/40 rounded-[28px] sm:px-6 px-4 py-5 mt-5 space-y-4 relative">
        <Field label="E-mail" type="email" placeholder="jankowalski@gmail.com"
          value={address.email} onChange={e => setField('email', e.target.value)} error={errors.email} />

        <div className="grid grid-cols-2 gap-4">
          <Field label="Imię" placeholder="Jan"
            value={address.firstName} onChange={e => setField('firstName', e.target.value)} error={errors.firstName} />
          <Field label="Nazwisko" placeholder="Kowalski"
            value={address.lastName} onChange={e => setField('lastName', e.target.value)} error={errors.lastName} />
        </div>

        {/* kurier-only: full address */}
        <div className={cn(
          "grid transition-all duration-300",
          deliveryType === 'kurier' ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden space-y-4">
            <Field label="Adres" placeholder="Mickiewicza 99"
              value={address.street} onChange={e => setField('street', e.target.value)} error={errors.street} />
            <div className="grid 3xs:grid-cols-3 grid-cols-[auto_33%] gap-4">
              <Field label="Miejscowość" placeholder="Tarnów"
                value={address.city} onChange={e => setField('city', e.target.value)} error={errors.city} />
              <Field label="Kod pocztowy" placeholder="33-100" maxLength={6}
                value={address.postalCode} onChange={e => setField('postalCode', e.target.value)} error={errors.postalCode} />              
              <Field label="Kraj/region" placeholder="Polska" value="Polska" readOnly
                className="bg-[#F9F9F9] cursor-default" />
            </div>
          </div>
        </div>

        <Field label="Telefon" type="tel" placeholder="848037241" className='w-fit'
          value={address.phone} onChange={e => setField('phone', e.target.value)} error={errors.phone} />

        {/* kurier-only: optional apartment */}
        {deliveryType === 'kurier' && !additionalField && (
          <div onClick={() => setAdditionalField(true)} className="text-[clamp(14px,1.4vw,15px)] cursor-pointer flex items-center text-black max-lg:pb-7">
            <Plus size={18} className="mr-2" />
            <p>mieszkanie / apartament / lokal</p>
          </div>
        )}
        <div className={cn(
          "grid transition-all duration-300",
          deliveryType === 'kurier' && additionalField ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}>
          <div className="overflow-hidden">
            <Field label="mieszkanie / apartament / lokal" placeholder="13"
              value={address.apartment_number || ''} onChange={e => setField('apartment_number', e.target.value)} />
          </div>
        </div>

        <Button type="button" onClick={handleContinue}
          className={`w-fit rounded-full font-bold bg-fancy-black text-white text-[clamp(14px,1.4vw,15px)] lg:py-6 py-5.5 px-6 hover:bg-fancy-black/90 transition-colors ${
            deliveryType === 'kurier' && additionalField ? "relative left-[calc(100%-200px)]" : deliveryType === 'kurier' ? "absolute bottom-5 right-6" : "lg:absolute lg:bottom-5 lg:right-6 max-lg:relative max-lg:left-[calc(100%-200px)]"
          }`}>
          Zapisz i kontynuuj
          <ChevronRight strokeWidth={3} size={18} className="ml-2" />
        </Button>
      </div>

      {/* disabled delivery methods placeholder */}
      <div className="mt-4 h-13 w-full rounded-full bg-fancy-black/[0.03] flex items-center px-6">
        <span className="text-[clamp(14px,1.4vw,15px)] text-[#999] font-medium">Metody dostawy</span>
      </div>
    </div>
  )
}
