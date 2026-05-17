'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Container from '@/components/Container'
import EmptyCart from '@/components/EmptyCart'
import Loading from '@/components/Loading'
import FurgonetkaMap from '@/components/FurgonetkaMap'
import { urlFor } from '@/sanity/lib/image'
import { checkout } from '@/actions/checkout'
import useStore from 'store'
import toast from 'react-hot-toast'
import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'
import { upsertSavedAddress, type SavedAddress } from '@/actions/address'
import type { Shipping_methods } from 'sanity.types'

import CheckoutNavbar from '@/components/CheckoutNavbar'
import OrderSummary from './_components/OrderSummary'
import Step1Address, { type Step1Result } from './_components/Step1Address'
import Step2DeliveryPayment, { type Step2Result } from './_components/Step2DeliveryPayment'
import Step3SummaryCards from './_components/Step3SummaryCards'
import { buildVariantLabel, type Step } from './_components/utils'
import type { PaymentMethod } from './_components/Step2PaymentForm'

interface Props {
  services:     Shipping_methods[]
  savedAddress: SavedAddress | null
  userSlot:     React.ReactNode
}

const motionProps = {
  initial:    { opacity: 0, x: 20 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

export default function CheckoutClient({ services, savedAddress, userSlot }: Props) {
  const [isClient, setIsClient]      = useState(false)
  const [step, setStep]              = useState<Step>(0)
  const [isPending, startTransition] = useTransition()

  const [address, setAddress]             = useState<CheckoutAddress | null>(null)
  const [deliveryType, setDeliveryType]   = useState<'kurier' | 'automat'>('kurier')
  const [serviceCode, setServiceCode]     = useState('')
  const [pickupPoint, setPickupPoint]     = useState<CheckoutPickupPoint | undefined>()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('przelewy24')

  const cartItems = useStore(s => s.cartItems)
  const resetCart = useStore(s => s.resetCart)

  useEffect(() => { 
    try{
      if(savedAddress){
        setAddress(savedAddress)
        setStep(1)
      }
    }finally{
      setIsClient(true)  
    }
     }, [])

  if (!isClient) return <Loading />
  if (!cartItems.length) return <EmptyCart />

  const selectedService = services.find(s => s.furgonetka_service_id === serviceCode) ?? null
  const shippingCents   = Math.round((selectedService?.internal_price ?? 0) * 100)

  async function handleStep1Continue(data: Step1Result) {
    setAddress(data.address)
    await upsertSavedAddress(data.address)
    setDeliveryType(data.deliveryType)
    setServiceCode('')
    setPickupPoint(undefined)
    setStep(1)
  }

  function handleStep2Continue(data: Step2Result) {
    setServiceCode(data.serviceCode)
    setPickupPoint(data.pickupPoint)
    setPaymentMethod(data.paymentMethod)
    setStep(2)
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

  return (
    <>
      <CheckoutNavbar step={step} userSlot={userSlot} />
      <FurgonetkaMap />
      <Container className="px-4 sm:px-8 lg:px-15 mb-10 font-poppins max-w-[1500px]">
        <AnimatePresence mode="wait">

          {/* ── step 0: adres ─────────────────────────────────────────────── */}
          {step === 0 && (
            <motion.div key="step-0" {...motionProps}>
              <div className="flex gap-8 items-start justify-between">
                <div className="max-w-[700px] w-full">
                  <Step1Address
                    savedAddress={savedAddress}
                    onContinue={handleStep1Continue}
                  />
                </div>
                <div className=" ">
                  <OrderSummary shippingCents={0} deliveryName={null} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── step 1: dostawa + płatność ────────────────────────────────── */}
          {step === 1 && address && (
            <motion.div key="step-1" {...motionProps}>
              <div className="flex gap-8 items-start justify-between">
                <div className="max-w-[700px] w-full">
                  <Step2DeliveryPayment
                    address={address}
                    deliveryType={deliveryType}
                    services={services}
                    onEdit={() => setStep(0)}
                    onContinue={handleStep2Continue}
                  />
                </div>
                <div className="top-10 sticky">
                  <OrderSummary shippingCents={shippingCents} deliveryName={selectedService?.name ?? null} />
                </div>
              </div>
            </motion.div>
          )}

          {/* ── step 2: finalizacja ───────────────────────────────────────── */}
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
                      <span className="flex items-center gap-2">Zamawiam i płacę</span>
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
    </>
  )
}
