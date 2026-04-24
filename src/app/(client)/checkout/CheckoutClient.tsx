'use client'

import { useState, useEffect, useTransition } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Truck, CreditCard, MapPin, ChevronRight, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import PriceFormatter from '@/components/PriceFormatter'
import Container from '@/components/Container'
import EmptyCart from '@/components/EmptyCart'
import Loading from '@/components/Loading'
import { urlFor } from '@/sanity/lib/image'
import { checkout } from '@/actions/checkout'
import useStore from 'store'
import toast from 'react-hot-toast'
import type { FurgonetkaService } from '@/lib/furgonetka'
import type { CheckoutAddress } from '@/actions/checkout'

// ─── helpers ─────────────────────────────────────────────────────────────────

const PAYMENT_OPTIONS = [
  {
    id:   'przelewy24' as const,
    name: 'Przelewy24',
    desc: 'Przelew online, BLIK, karta',
  },
  {
    id:   'autopay' as const,
    name: 'Autopay',
    desc: 'Szybki przelew, Google Pay, Apple Pay',
  },
  {
    id:   'cod' as const,
    name: 'Za pobraniem',
    desc: 'Płatność przy odbiorze (+5,00 zł)',
  },
]

function buildVariantLabel(product: any, variantKey: string): string {
  const variant = product.variants?.find((v: any) => v._key === variantKey)
  if (!variant?.optionValues?.length) return ''
  return variant.optionValues
    .map((ov: any) => `${ov.name?.label ?? ''}: ${ov.value?.value ?? ''}`)
    .join(', ')
}

// ─── form field component ─────────────────────────────────────────────────────

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

function Field({ label, error, className, ...props }: FieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-[#3D3D3D]">{label}</span>
      <input
        {...props}
        className={cn(
          'w-full border rounded-lg px-4 py-3 text-[15px] font-poppins bg-white',
          'placeholder:text-[#BBBBBB] transition-colors',
          'focus:outline-none focus:border-fancy-black',
          error ? 'border-red-400' : 'border-[#D5D5D5]',
          className,
        )}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  )
}

// ─── section card ─────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-fancy-black flex items-center justify-center flex-shrink-0">
          <Icon size={15} className="text-white" />
        </div>
        <h2 className="text-[17px] font-semibold text-fancy-black">{title}</h2>
      </div>
      {children}
    </div>
  )
}

// ─── radio card ───────────────────────────────────────────────────────────────

function RadioCard({
  selected,
  onClick,
  title,
  desc,
  badge,
}: {
  selected: boolean
  onClick: () => void
  title: string
  desc: string
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left border-2 rounded-xl p-4 transition-all duration-200 flex items-center gap-4',
        selected
          ? 'border-fancy-black bg-fancy-black/[0.03]'
          : 'border-[#E8E8E8] hover:border-[#BBBBBB]',
      )}
    >
      <div
        className={cn(
          'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center',
          selected ? 'border-fancy-black' : 'border-[#BBBBBB]',
        )}
      >
        {selected && <div className="w-2.5 h-2.5 rounded-full bg-fancy-black" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-fancy-black">{title}</p>
        <p className="text-[13px] text-[#6C6C6C] mt-0.5">{desc}</p>
      </div>
      {badge && (
        <span className="text-[13px] font-semibold text-fancy-black whitespace-nowrap">
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  shippingServices: FurgonetkaService[]
}

const EMPTY_ADDRESS: CheckoutAddress = {
  firstName:  '',
  lastName:   '',
  email:      '',
  phone:      '',
  street:     '',
  city:       '',
  postalCode: '',
  country:    'PL',
}

export default function CheckoutClient({ shippingServices }: Props) {
  const [isClient, setIsClient]         = useState(false)
  const [address, setAddress]           = useState<CheckoutAddress>(EMPTY_ADDRESS)
  const [shippingMethod, setShipping]   = useState(shippingServices[0]?.code ?? '')
  const [paymentMethod, setPayment]     = useState<'przelewy24' | 'autopay' | 'cod'>('przelewy24')
  const [notes, setNotes]               = useState('')
  const [errors, setErrors]             = useState<Partial<CheckoutAddress>>({})
  const [isPending, startTransition]    = useTransition()

  const cartItems     = useStore(s => s.cartItems)
  const getTotalPrice = useStore(s => s.getTotalPrice)
  const resetCart     = useStore(s => s.resetCart)

  useEffect(() => { setIsClient(true) }, [])

  if (!isClient) return <Loading />
  if (!cartItems.length) return <EmptyCart />

  const selectedService = shippingServices.find(s => s.code === shippingMethod)
  const shippingCents   = selectedService?.priceCents ?? 0
  const codSurcharge    = paymentMethod === 'cod' ? 500 : 0
  const subtotalPLN     = getTotalPrice()
  const subtotalCents   = Math.round(subtotalPLN * 100)
  const totalCents      = subtotalCents + shippingCents + codSurcharge

  function setField<K extends keyof CheckoutAddress>(key: K, val: CheckoutAddress[K]) {
    setAddress(prev => ({ ...prev, [key]: val }))
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const e: Partial<CheckoutAddress> = {}
    if (!address.firstName.trim()) e.firstName = 'Wymagane'
    if (!address.lastName.trim())  e.lastName  = 'Wymagane'
    if (!address.email.includes('@')) e.email  = 'Nieprawidłowy email'
    if (!address.phone.trim())     e.phone     = 'Wymagane'
    if (!address.street.trim())    e.street    = 'Wymagane'
    if (!address.city.trim())      e.city      = 'Wymagane'
    if (!/^\d{2}-\d{3}$/.test(address.postalCode)) e.postalCode = 'Format: XX-XXX'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) {
      toast.error('Uzupełnij wymagane pola')
      return
    }

    startTransition(async () => {
      const items = cartItems.map(({ product, variant, quantity }) => ({
        productId:    product._id,
        variantId:    variant,
        qty:          quantity,
        name:         product.title ?? '',
        variantLabel: buildVariantLabel(product, variant),
        imageUrl:     product.images?.[0] ? urlFor(product.images[0]).width(200).url() : '',
      }))

      const result = await checkout({
        items,
        address,
        paymentMethod,
        shippingMethod,
        notes: notes.trim() || undefined,
      })

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      resetCart()
      window.location.href = result.redirectUrl
    })
  }

  return (
    <Container className="px-4 sm:px-8 lg:px-15 my-10 font-poppins">
      <h1 className="text-[clamp(18px,1.8vw,26px)] font-semibold text-fancy-black mb-8">
        Finalizacja zamówienia
      </h1>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── left column ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* address */}
            <Section icon={MapPin} title="Dane dostawy">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Imię"
                  placeholder="Jan"
                  value={address.firstName}
                  onChange={e => setField('firstName', e.target.value)}
                  error={errors.firstName}
                />
                <Field
                  label="Nazwisko"
                  placeholder="Kowalski"
                  value={address.lastName}
                  onChange={e => setField('lastName', e.target.value)}
                  error={errors.lastName}
                />
                <Field
                  label="Email"
                  type="email"
                  placeholder="jan@example.com"
                  value={address.email}
                  onChange={e => setField('email', e.target.value)}
                  error={errors.email}
                />
                <Field
                  label="Telefon"
                  type="tel"
                  placeholder="+48 500 000 000"
                  value={address.phone}
                  onChange={e => setField('phone', e.target.value)}
                  error={errors.phone}
                />
                <Field
                  label="Ulica i numer"
                  placeholder="ul. Marszałkowska 1/2"
                  className="sm:col-span-2"
                  value={address.street}
                  onChange={e => setField('street', e.target.value)}
                  error={errors.street}
                />
                <Field
                  label="Miasto"
                  placeholder="Warszawa"
                  value={address.city}
                  onChange={e => setField('city', e.target.value)}
                  error={errors.city}
                />
                <Field
                  label="Kod pocztowy"
                  placeholder="00-001"
                  value={address.postalCode}
                  onChange={e => setField('postalCode', e.target.value)}
                  error={errors.postalCode}
                  maxLength={6}
                />
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-[#3D3D3D]">Uwagi do zamówienia (opcjonalne)</span>
                <textarea
                  rows={3}
                  placeholder="Dodatkowe informacje dla kuriera lub sprzedawcy…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full border border-[#D5D5D5] rounded-lg px-4 py-3 text-[15px] font-poppins bg-white placeholder:text-[#BBBBBB] focus:outline-none focus:border-fancy-black transition-colors resize-none"
                />
              </label>
            </Section>

            {/* shipping */}
            <Section icon={Truck} title="Sposób dostawy">
              {shippingServices.length === 0 ? (
                <div className="flex items-center gap-3 text-[#6C6C6C] text-[14px]">
                  <AlertCircle size={16} />
                  <span>Nie można załadować opcji dostawy. Spróbuj ponownie.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {shippingServices.map(service => (
                    <RadioCard
                      key={service.code}
                      selected={shippingMethod === service.code}
                      onClick={() => setShipping(service.code)}
                      title={service.name}
                      desc={service.code.toUpperCase()}
                      badge={service.priceCents != null ? `${(service.priceCents / 100).toFixed(2)} zł` : undefined}
                    />
                  ))}
                </div>
              )}
            </Section>

            {/* payment */}
            <Section icon={CreditCard} title="Metoda płatności">
              <div className="space-y-3">
                {PAYMENT_OPTIONS.map(opt => (
                  <RadioCard
                    key={opt.id}
                    selected={paymentMethod === opt.id}
                    onClick={() => setPayment(opt.id)}
                    title={opt.name}
                    desc={opt.desc}
                  />
                ))}
              </div>
            </Section>
          </div>

          {/* ── right column: order summary ──────────────────────────────── */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-white rounded-2xl border border-[#E8E8E8] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#F0F0F0]">
                <h2 className="text-[17px] font-semibold text-fancy-black">
                  Twoje zamówienie
                </h2>
              </div>

              {/* items */}
              <div className="px-6 py-4 space-y-4 max-h-80 overflow-y-auto">
                <AnimatePresence initial={false}>
                  {cartItems.map(({ product, variant, quantity }) => {
                    const variantProps = product.variants?.find(v => v._key === variant)
                    const price = (variantProps?.price ?? product.price ?? 0) * quantity
                    return (
                      <motion.div
                        key={product._id + variant}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="flex gap-3 items-start"
                      >
                        {product.images?.[0] && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-[#F0F0F0]">
                            <Image
                              src={urlFor(product.images[0]).width(96).url()}
                              alt={product.title ?? ''}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-fancy-black line-clamp-1">
                            {product.title}
                          </p>
                          <p className="text-[12px] text-[#6C6C6C] line-clamp-1">
                            {buildVariantLabel(product, variant) || `Ilość: ${quantity}`}
                          </p>
                          {quantity > 1 && (
                            <p className="text-[12px] text-[#6C6C6C]">× {quantity}</p>
                          )}
                        </div>
                        <PriceFormatter
                          amount={price}
                          className="text-[13px] font-semibold text-fancy-black flex-shrink-0"
                        />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>

              <Separator />

              {/* totals */}
              <div className="px-6 py-5 space-y-3 text-[14px]">
                <div className="flex justify-between text-[#6C6C6C]">
                  <span>Produkty</span>
                  <PriceFormatter amount={subtotalPLN} className="font-normal text-[#6C6C6C]" />
                </div>
                <div className="flex justify-between text-[#6C6C6C]">
                  <span>Dostawa</span>
                  {selectedService ? (
                    <PriceFormatter amount={shippingCents / 100} className="font-normal text-[#6C6C6C]" />
                  ) : (
                    <span>—</span>
                  )}
                </div>
                {codSurcharge > 0 && (
                  <div className="flex justify-between text-[#6C6C6C]">
                    <span>Dopłata za pobraniem</span>
                    <PriceFormatter amount={codSurcharge / 100} className="font-normal text-[#6C6C6C]" />
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-bold text-[16px] text-fancy-black">
                  <span>Do zapłaty</span>
                  <PriceFormatter amount={totalCents / 100} className="text-[17px] font-bold text-fancy-black" />
                </div>

                <Button
                  type="submit"
                  disabled={isPending || shippingServices.length === 0}
                  className="w-full mt-2 rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 hover:bg-fancy-black/90 transition-colors disabled:opacity-60"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Przetwarzam…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Zamawiam i płacę
                      <ChevronRight size={16} />
                    </span>
                  )}
                </Button>

                <p className="text-[11px] text-[#6C6C6C] text-center leading-relaxed">
                  Klikając &bdquo;Zamawiam i płacę&rdquo; akceptujesz{' '}
                  <span className="underline cursor-pointer">regulamin</span> i{' '}
                  <span className="underline cursor-pointer">politykę prywatności</span>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </Container>
  )
}
