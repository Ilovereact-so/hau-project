'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import PriceFormatter from '@/components/PriceFormatter'
import { getPendingPaymentOrder, type PendingPaymentOrder } from '@/actions/orders'
import { formatPaymentDeadline } from '@/lib/paymentDeadline'

/**
 * „Masz nieopłacone zamówienie” — w pustym koszyku i pustej kasie. Klient,
 * który zamknął okno płatności, wrócił z banku przyciskiem „wstecz” albo
 * przerwał płatność, nie zostaje z pustym koszykiem, tylko widzi swoje
 * zamówienie z przyciskiem „Zapłać” (jak Allegro / empik).
 */
export default function PendingPaymentNotice({ className = '' }: { className?: string }) {
  const [order, setOrder] = useState<PendingPaymentOrder | null>(null)

  useEffect(() => {
    let active = true
    getPendingPaymentOrder()
      .then((result) => { if (active) setOrder(result) })
      .catch(() => { if (active) setOrder(null) })
    return () => { active = false }
  }, [])

  if (!order) return null

  return (
    <div className={`w-full max-w-[560px] mx-auto rounded-[24px] bg-[#e2f3f0] px-5 py-4 text-left font-poppins ${className}`}>
      <p className="text-[clamp(14px,1.6vw,16px)] font-medium text-black">Masz nieopłacone zamówienie #{order.number}</p>
      <p className="text-[13px] text-[#3A3A3A] mt-1">
        Płatność nie została dokończona. Zamówienie czeka — możesz je opłacić bez ponownego dodawania produktów.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          href={order.href}
          className="inline-flex items-center gap-2 rounded-full bg-fancy-black text-white px-5 py-2 text-[14px] font-medium hover:bg-fancy-black/90 transition-colors"
        >
          Zapłać <PriceFormatter amount={order.totalCents / 100} className="font-medium text-white" />
        </Link>
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#3A3A3A]">
          <Clock size={13} aria-hidden="true" />
          do {formatPaymentDeadline(order.deadline)}
        </span>
      </div>
    </div>
  )
}
