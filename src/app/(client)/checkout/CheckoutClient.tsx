'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Truck } from 'lucide-react'
import Container from '@/components/Container'
import EmptyCart from '@/components/EmptyCart'
import Loading from '@/components/Loading'
import FurgonetkaMap from '@/components/FurgonetkaMap'
import { urlFor } from '@/sanity/lib/image'
import { checkout } from '@/actions/checkout'
import useStore from 'store'
import toast from 'react-hot-toast'
import type {
  CheckoutAddress, CheckoutPickupPoint, AutopayFormPayload, AutopayInlinePayload,
} from '@/actions/checkout'
import { upsertSavedAddress, type SavedAddress } from '@/actions/address'
import type { Shipping_methods } from 'sanity.types'

import CheckoutNavbar from '@/components/CheckoutNavbar'
import OrderSummary from './_components/OrderSummary'
import Step1Address, { DeliveryTypeCard, type Step1Result } from './_components/Step1Address'
import Step2DeliveryPayment, { type Step2Result } from './_components/Step2DeliveryPayment'
import Step3SummaryCards from './_components/Step3SummaryCards'
import AutopayInlinePayment from './_components/AutopayInlinePayment'
import { buildVariantLabel, type Step } from './_components/utils'
import type { PaymentMethod } from './_components/Step2PaymentForm'
import { useDiscountPreview } from '@/hooks/useDiscountPreview'
import { useDiscountStore } from '@/store/discountStore'

/**
 * Autopay wymaga startu transakcji POST-em (application/x-www-form-urlencoded),
 * więc budujemy ukryty formularz i wysyłamy go z przeglądarki.
 */
function submitAutopayForm({ url, fields }: AutopayFormPayload) {
  const form = document.createElement('form')
  form.method         = 'POST'
  form.action         = url
  form.acceptCharset  = 'UTF-8'
  form.style.display  = 'none'

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input')
    input.type  = 'hidden'
    input.name  = name
    input.value = value
    form.appendChild(input)
  }

  document.body.appendChild(form)
  form.submit()
}

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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('autopay')
  const [gatewayId, setGatewayId]         = useState<number | undefined>()
  const [gatewayName, setGatewayName]     = useState<string | undefined>()
  const [saveCard, setSaveCard]           = useState(false)
  const [blik0, setBlik0]                 = useState(false)
  const [blikCode, setBlikCode]           = useState('')
  const [inlinePayment, setInlinePayment] = useState<AutopayInlinePayload | null>(null)

  const cartItems = useStore(s => s.cartItems)
  const cartReady = useStore(s => s.cartReady)
  const resetCart = useStore(s => s.resetCart)
  const discountCode    = useDiscountStore(s => s.code)
  const setDiscountCode = useDiscountStore(s => s.setCode)
  const discount        = useDiscountPreview()

  useEffect(() => {
    setServiceCode('')
  },[deliveryType])

  useEffect(() => { 
    try{
      // Krok adresu pomijamy tylko przy KOMPLETNYCH danych — z profilu da się
      // zapisać same dane odbiorcy bez adresu; wtedy tylko wypełniają formularz.
      const a = savedAddress
      if(a && a.firstName && a.lastName && a.email && a.phone && a.street && a.city && a.postalCode){
        setAddress(a)
        setStep(1)
      }
    }finally{
      setIsClient(true)  
    }
    }, [savedAddress])

  // cartReady: po zalogowaniu z koszyka gościa trwa scalanie z kontem —
  // bez tego kasa mogłaby pokazać pusty/niepełny koszyk.
  if (!isClient || !cartReady) return <Loading />
  // Koszyk jest już wyczyszczony, gdy trwa płatność BLIK-0 / kartą w ramce —
  // bez tego wyjątku panel płatności zniknąłby razem z koszykiem.
  if (!cartItems.length && !inlinePayment) return <EmptyCart />

  const selectedService = services.find(s => s.furgonetka_service_id === serviceCode) ?? null
  const shippingCents   = Math.round((selectedService?.internal_price ?? 0) * 100)

  async function handleStep1Continue(data: Step1Result) {
    setAddress(data.address)
    await upsertSavedAddress(data.address)
    setPickupPoint(undefined)
    setStep(1)
  }

  function handleStep2Continue(data: Step2Result) {
    setServiceCode(data.serviceCode)
    setPickupPoint(data.pickupPoint)
    setPaymentMethod(data.paymentMethod)
    setGatewayId(data.gatewayId)
    setGatewayName(data.gatewayName)
    setSaveCard(data.saveCard ?? false)
    setBlik0(data.blik0 ?? false)
    setBlikCode('')
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
        gatewayId,
        saveCard:  saveCard ? true : undefined,
        blikCode:  blik0 ? blikCode.replace(/\D/g, '') : undefined,
        discountCode: discountCode ?? undefined,
      })

      if (!result.ok) {
        // Kod przestał działać między koszykiem a zamówieniem — zdejmujemy go,
        // podsumowanie przelicza się bez rabatu, klient decyduje, czy zamawia.
        if (result.discountRejected) {
          setDiscountCode(null)
          toast.error(`${result.error} Sprawdź podsumowanie i złóż zamówienie bez kodu.`, { duration: 6000 })
          return
        }
        toast.error(result.error)
        return
      }
      resetCart()
      setDiscountCode(null)

      // BLIK-0 i formularz karty w ramce zostają na tej stronie.
      if (result.autopayInline) {
        setInlinePayment(result.autopayInline)
        return
      }

      if (result.autopayForm) {
        submitAutopayForm(result.autopayForm)
        return
      }

      window.location.href = result.redirectUrl
    })
  }
  const handleDeliveryClick = (type:string)=>{
    setDeliveryType(type as 'kurier' | 'automat')
  }

  return (
    <>
      <CheckoutNavbar step={step} userSlot={userSlot} />
      <FurgonetkaMap />
      <Container className="px-6 sm:px-8 lg:px-15 mb-10 font-poppins max-w-[1500px] flex lg:gap-8 gap-4 md:justify-between md:flex-row flex-col">
          <div className='flex flex-col max-w-[700px] w-full'>
            {step < 2 && (
            <>
              <h2 className="text-[clamp(16px,1.5vw,20px)] font-medium text-black my-4">Dostawa</h2>
              {/* delivery type tabs */}
              <div className="flex my-2">
                <DeliveryTypeCard icon={Truck}  label="Dostawa kurierem"  selected={deliveryType === 'kurier'}  onClick={() => handleDeliveryClick('kurier')} />
                <DeliveryTypeCard icon={MapPin} label="Dostawa do punktu" selected={deliveryType === 'automat'} onClick={() => handleDeliveryClick('automat')} />
              </div>
            </>
            )}
          <AnimatePresence mode="wait">

            {/* ── step 0: adres ─────────────────────────────────────────────── */}
            {step === 0 && (
              <motion.div key="step-0" {...motionProps}>
                <div className="flex w-full">
                    <Step1Address
                      savedAddress={address || savedAddress}
                      deliveryType={deliveryType}
                      onContinue={handleStep1Continue}
                    />
                </div>
              </motion.div>
            )}

            {/* ── step 1: dostawa + płatność ────────────────────────────────── */}
            {step === 1 && address && (
              <motion.div key="step-1" {...motionProps}>
                <div className="flex w-full">
                    <Step2DeliveryPayment
                      address={address}
                      deliveryType={deliveryType}
                      services={services}
                      onEdit={() => setStep(0)}
                      onContinue={handleStep2Continue}
                      dynamicService={setServiceCode}
                    />
                </div>
              </motion.div>
            )}
            {step === 2 && address && (
            <motion.div key="step-2" {...motionProps}>
              <div className="flex w-full">
                  <Step3SummaryCards
                    address={address}
                    deliveryType={deliveryType}
                    serviceName={selectedService?.name ?? serviceCode}
                    paymentMethod={paymentMethod}
                    gatewayId={gatewayId}
                    gatewayName={gatewayName}
                    pickupPoint={pickupPoint}
                    blik0={blik0}
                    blikCode={blikCode}
                    onBlikCode={setBlikCode}
                    onEdit={() => setStep(1)}
                    handleSubmit={handleSubmit}
                    isPending={isPending}
                  />
                </div>
            </motion.div>
            )}
          </AnimatePresence>
          </div>
          <div className="top-10 sticky">
            <OrderSummary
              shippingCents={shippingCents}
              deliveryName={selectedService?.name ?? null}
              discount={discount.state.status === 'ready' ? discount.state.preview : null}
              discountLoading={discount.state.status === 'loading'}
            />
          </div>

      </Container>

      {inlinePayment && (
        <AutopayInlinePayment
          payload={inlinePayment}
          onClose={() => setInlinePayment(null)}
        />
      )}
    </>
  )
}
