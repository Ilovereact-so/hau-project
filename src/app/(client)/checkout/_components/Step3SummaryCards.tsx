'use client'

import type { CheckoutAddress, CheckoutPickupPoint } from '@/actions/checkout'

const PAYMENT_LABELS: Record<string, string> = {
  przelewy24: 'Przelewy24',
  autopay:    'Autopay',
  cod:        'Za pobraniem',
}

interface Props {
  address:       CheckoutAddress
  deliveryType:  'kurier' | 'paczkomat'
  serviceName:   string
  paymentMethod: string
  pickupPoint?:  CheckoutPickupPoint
}

export default function Step3SummaryCards({
  address, deliveryType, serviceName, paymentMethod, pickupPoint,
}: Props) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-3">
        <h2 className="text-[15px] font-semibold text-fancy-black">Dane dostawy</h2>
        <div className="text-[14px] text-[#3D3D3D] space-y-1">
          <p>{address.firstName} {address.lastName}</p>
          <p>{address.email}</p>
          <p>{address.phone}</p>
          {deliveryType === 'kurier' ? (
            <p>{address.street}, {address.postalCode} {address.city}</p>
          ) : (
            <p className="font-medium">{pickupPoint?.name} ({pickupPoint?.code})</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#E8E8E8] p-6 space-y-3">
        <div className="flex justify-between text-[14px]">
          <span className="text-[#6C6C6C]">Dostawa</span>
          <span className="font-medium text-fancy-black">{serviceName}</span>
        </div>
        <div className="flex justify-between text-[14px]">
          <span className="text-[#6C6C6C]">Płatność</span>
          <span className="font-medium text-fancy-black">{PAYMENT_LABELS[paymentMethod]}</span>
        </div>
      </div>
    </div>
  )
}
