'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Container from '@/components/Container'
import EmptyCart from '@/components/EmptyCart'
import Loading from '@/components/Loading'
import FurgonetkaMap from '@/components/FurgonetkaMap'
import { urlFor } from '@/sanity/lib/image'
import { checkout } from '@/actions/checkout'
import useStore from 'store'
import toast from 'react-hot-toast'
import type { DeliveryService } from '@/actions/deliveryServices'
import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import type { SavedAddress } from '@/actions/address'

import Breadcrumb from './_components/Breadcrumb'
import OrderSummary from './_components/OrderSummary'
import Step1Address, { type Step1Result } from './_components/Step1Address'
import Step2PaymentForm, { type PaymentMethod } from './_components/Step2PaymentForm'
import Step3SummaryCards from './_components/Step3SummaryCards'
import { buildVariantLabel, type Step } from './_components/utils'

interface Props {
  services:     DeliveryService[]
  savedAddress: SavedAddress | null
}

export default function CheckoutClient({ services, savedAddress }: Props) {
  const [isClient, setIsClient]      = useState(false)
  const [step, setStep]              = useState<Step>(0)
  const [isPending, startTransition] = useTransition()

  const [address, setAddress]           = useState<CheckoutAddress | null>(null)
  const [deliveryType, setDeliveryType] = useState<'kurier' | 'paczkomat'>('kurier')
  const [serviceCode, setServiceCode]   = useState('')
  const [pickupPoint, setPickupPoint]   = useState<CheckoutPickupPoint | undefined>()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('przelewy24')

  const cartItems  = useStore(s => s.cartItems)
  const resetCart  = useStore(s => s.resetCart)

  useEffect(() => { setIsClient(true) }, [])

  if (!isClient) return <Loading />
  if (!cartItems.length) return <EmptyCart />

  const selectedService = services.find(s => s.serviceCode === serviceCode) ?? null
  const shippingCents   = selectedService?.priceCents ?? 0

  function handleStep1Continue(data: Step1Result) {
    setAddress(data.address)
    setDeliveryType(data.deliveryType)
    setServiceCode(data.serviceCode)
    setPickupPoint(data.pickupPoint)
    setStep(1)
  }

  function handleSubmit() {
    if (!address) return
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
        items, address, paymentMethod,
        shippingMethod: serviceCode,
        deliveryType,   pickupPoint,
      })

      if (!result.ok) { toast.error(result.error); return }
      resetCart()
      window.location.href = result.redirectUrl
    })
  }

  const motionProps = {
    initial:    { opacity: 0, x: 20 },
    animate:    { opacity: 1, x: 0 },
    exit:       { opacity: 0, x: -20 },
    transition: { duration: 0.2 },
  }

  return (
    <Container className="px-4 sm:px-8 lg:px-15 my-10 font-poppins">
      {/* loads Furgonetka map script once for the whole checkout page */}
      <FurgonetkaMap apiKey={process.env.NEXT_PUBLIC_FURGONETKA_MAP_API_KEY!} onSelect={() => {}} />

      <Breadcrumb step={step} />

      <AnimatePresence mode="wait">

        {step === 0 && (
          <motion.div key="step-0" {...motionProps}>
            <Step1Address
              services={services}
              savedAddress={savedAddress}
              onContinue={handleStep1Continue}
            />
          </motion.div>
        )}

        {step === 1 && (
          <motion.div key="step-1" {...motionProps}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Step2PaymentForm value={paymentMethod} onChange={setPaymentMethod} />
              </div>
              <div className="lg:col-span-1 space-y-4">
                <OrderSummary shippingCents={shippingCents} deliveryName={selectedService?.name ?? null} />
                <Button type="button" onClick={() => setStep(2)}
                  className="w-full rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 hover:bg-fancy-black/90 transition-colors">
                  Dalej <ChevronRight size={16} className="ml-2" />
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep(0)}
                  className="w-full rounded-full text-[14px] text-[#6C6C6C] py-5">
                  <ChevronLeft size={14} className="mr-1" /> Wstecz
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 2 && address && (
          <motion.div key="step-2" {...motionProps}>
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Step3SummaryCards
                  address={address}
                  deliveryType={deliveryType}
                  serviceName={selectedService?.name ?? serviceCode}
                  paymentMethod={paymentMethod}
                  pickupPoint={pickupPoint}
                />
              </div>
              <div className="lg:col-span-1 space-y-4">
                <OrderSummary shippingCents={shippingCents} deliveryName={selectedService?.name ?? null} />
                <Button type="button" onClick={handleSubmit} disabled={isPending}
                  className="w-full rounded-full font-bold bg-fancy-black text-white text-[15px] py-6 hover:bg-fancy-black/90 transition-colors disabled:opacity-60">
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Przetwarzam…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">Zamawiam i płacę <ChevronRight size={16} /></span>
                  )}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep(1)} disabled={isPending}
                  className="w-full rounded-full text-[14px] text-[#6C6C6C] py-5">
                  <ChevronLeft size={14} className="mr-1" /> Wstecz
                </Button>
                <p className="text-[11px] text-[#6C6C6C] text-center leading-relaxed">
                  Klikając „Zamawiam i płacę" akceptujesz{' '}
                  <span className="underline cursor-pointer">regulamin</span> i{' '}
                  <span className="underline cursor-pointer">politykę prywatności</span>.
                </p>
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </Container>
  )
}
