'use client'

import { useState, useEffect, useTransition } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Truck } from 'lucide-react'
import Container from '@/components/Container'
import EmptyCart from '@/components/EmptyCart'
import Loading from '@/components/Loading'
import FurgonetkaMap from '@/components/FurgonetkaMap'
import { urlFor } from '@/sanity/lib/image'
import { primaryImageForVariant } from '@/lib/variantImages'
import { checkout } from '@/actions/checkout'
import useStore from 'store'
import type {
  CheckoutAddress, CheckoutPickupPoint, AutopayInlinePayload,
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
import { useShopSettings } from '@/hooks/useShopSettings'
import { qualifiesForFreeShipping } from '@/lib/shopSettings'
import { useAuthModalStore } from '@/store/authModalStore'
import { submitAutopayForm } from '@/lib/autopayForm'

interface Props {
  services:     Shipping_methods[]
  savedAddress: SavedAddress | null
  userSlot:     React.ReactNode
  /** Zakup bez logowania. */
  isGuest?:     boolean
}

const motionProps = {
  initial:    { opacity: 0, x: 20 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
}

export default function CheckoutClient({ services, savedAddress, userSlot, isGuest = false }: Props) {
  const [isClient, setIsClient]      = useState(false)
  const [step, setStep]              = useState<Step>(0)
  const [isPending, startTransition] = useTransition()

  const [address, setAddress]             = useState<CheckoutAddress | null>(null)
  // Dostawa do punktu jest pierwsza i domyślna (większość klientów wybiera
  // paczkomat / punkt) — kurier tylko, gdy żadna metoda „do punktu” nie jest aktywna.
  const [deliveryType, setDeliveryType]   = useState<'kurier' | 'automat'>(
    () => (services.some(s => s.active === true && s.type === 'automat') ? 'automat' : 'kurier'),
  )
  const [serviceCode, setServiceCode]     = useState('')
  const [pickupPoint, setPickupPoint]     = useState<CheckoutPickupPoint | undefined>()
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('autopay')
  const [gatewayId, setGatewayId]         = useState<number | undefined>()
  const [gatewayName, setGatewayName]     = useState<string | undefined>()
  const [otherPayment, setOtherPayment]   = useState(false)
  const [cardIframe, setCardIframe]       = useState(false)
  const [inlinePayment, setInlinePayment] = useState<AutopayInlinePayload | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const cartItems = useStore(s => s.cartItems)
  const cartReady = useStore(s => s.cartReady)
  const resetCart = useStore(s => s.resetCart)
  const discountCode    = useDiscountStore(s => s.code)
  const setDiscountCode = useDiscountStore(s => s.setCode)
  const discount        = useDiscountPreview()
  const shopSettings    = useShopSettings()
  const getSubTotal     = useStore(s => s.getSubTotalPrice)
  const openModal       = useAuthModalStore(s => s.openModal)

  useEffect(() => {
    setServiceCode('')
    setPickupPoint(undefined)
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
  // Koszyk jest już wyczyszczony, gdy trwa płatność kartą w ramce —
  // bez tego wyjątku panel płatności zniknąłby razem z koszykiem.
  if (!cartItems.length && !inlinePayment) return <EmptyCart />

  const selectedService = services.find(s => s.furgonetka_service_id === serviceCode) ?? null
  // Darmowa dostawa od progu (panel → Dostawy) — ta sama reguła co serwer.
  const freeShipping    = shopSettings ? qualifiesForFreeShipping(shopSettings, Math.round(getSubTotal() * 100)) : false
  const shippingCents   = freeShipping ? 0 : Math.round((selectedService?.internal_price ?? 0) * 100)

  async function handleStep1Continue(data: Step1Result) {
    setAddress(data.address)
    if (!isGuest) await upsertSavedAddress(data.address)
    setStep(1)
  }

  function handleStep2Continue(data: Step2Result) {
    setServiceCode(data.serviceCode)
    setPickupPoint(data.pickupPoint)
    setPaymentMethod(data.paymentMethod)
    setGatewayId(data.gatewayId)
    setGatewayName(data.gatewayName)
    setOtherPayment(data.other ?? false)
    setCardIframe(data.cardIframe ?? false)
    setStep(2)
  }

  function handleSubmit() {
    if (!address) return

    setSubmitError(null)
    startTransition(async () => {
      const items = cartItems.map(({ product, variant, quantity }) => ({
        productId:    product._id,
        variantId:    variant,
        qty:          quantity,
        name:         product.title ?? '',
        variantLabel: buildVariantLabel(product, variant),
        imageUrl:     product.images?.[0] ? urlFor(primaryImageForVariant(product.images, variant) ?? product.images[0]).width(200).url() : '',
      }))

      const result = await checkout({
        items, address, paymentMethod,
        shippingMethod: serviceCode,
        deliveryType,   pickupPoint,
        gatewayId,
        discountCode: discountCode ?? undefined,
      })

      if (!result.ok) {
        // Kod przestał działać między koszykiem a zamówieniem — zdejmujemy go,
        // podsumowanie przelicza się bez rabatu, klient decyduje, czy zamawia.
        if (result.discountRejected) {
          setDiscountCode(null)
          setSubmitError(`${result.error} Sprawdź podsumowanie i złóż zamówienie bez kodu.`)
          return
        }
        setSubmitError(result.error)
        return
      }
      resetCart()
      setDiscountCode(null)

      // Formularz karty w ramce (jeśli włączony) zostaje na tej stronie;
      // wszystko inne — BLIK, karta, przelew — przekierowanie na Autopay.
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

  function handleStepClick(targetStep: Step) {
    if (targetStep < step) setStep(targetStep)
  }

  return (
    <>
      <CheckoutNavbar step={step} userSlot={userSlot} onStepClick={handleStepClick} />
      <FurgonetkaMap />
      <Container className="px-6 sm:px-8 lg:px-15 mb-10 font-poppins max-w-[1500px] flex lg:gap-8 gap-4 md:justify-between md:flex-row flex-col">
          <div className='flex flex-col max-w-[700px] w-full'>
            {isGuest && step === 0 && (
              <div className="mt-4 rounded-[20px] bg-[#EDEDED] px-5 py-3 text-[clamp(13px,1.3vw,15px)] text-black">
                Kupujesz bez logowania — wystarczą dane do wysyłki.{' '}
                <button
                  type="button"
                  onClick={() => openModal('signIn', { redirectTo: '/checkout' })}
                  className="underline underline-offset-2 cursor-pointer"
                >
                  Masz konto? Zaloguj się
                </button>
              </div>
            )}
            {step < 2 && (
            <>
              <h2 className="text-[clamp(16px,1.5vw,20px)] font-medium text-black my-4">Dostawa</h2>
              {/* delivery type tabs */}
              <div className="flex my-2">
                <DeliveryTypeCard side="left"  icon={MapPin} label="Dostawa do punktu" selected={deliveryType === 'automat'} onClick={() => handleDeliveryClick('automat')} />
                <DeliveryTypeCard side="right" icon={Truck}  label="Dostawa kurierem"  selected={deliveryType === 'kurier'}  onClick={() => handleDeliveryClick('kurier')} />
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
                      initialServiceCode={serviceCode}
                      initialPickupPoint={pickupPoint}
                      initialPayment={{
                        method: paymentMethod,
                        gatewayId,
                        gatewayName,
                        other: otherPayment,
                        cardIframe,
                      }}
                      freeShipping={freeShipping}
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
                    cardIframe={cardIframe}
                    pickupPoint={pickupPoint}
                    submitError={submitError}
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
              freeShipping={freeShipping}
              deliveryName={selectedService?.name ?? null}
              discount={discount.state.status === 'ready' ? discount.state.preview : null}
              discountLoading={discount.state.status === 'loading'}
            />
          </div>

      </Container>

      {inlinePayment && (
        <AutopayInlinePayment
          payload={inlinePayment}
          // Koszyk jest już pusty (produkty są w zamówieniu), więc zamknięcie
          // okna płatności prowadzi do zamówienia z przyciskiem „Zapłać” —
          // nie do pustej kasy.
          onClose={() => { window.location.href = `/orders/${inlinePayment.orderId}?payment=unpaid#platnosc` }}
        />
      )}
    </>
  )
}
