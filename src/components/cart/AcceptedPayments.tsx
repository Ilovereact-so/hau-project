'use client'

import { useEffect, useState } from 'react'
import { Banknote, Landmark } from 'lucide-react'
import { LogoApplePay, LogoBlik, LogoCards, LogoGooglePay } from '@/components/payment/PaymentLogos'

/*
 * „Akceptujemy” w koszyku — lista metod płatności BRANA Z BRAMKI (Autopay
 * paywayList przez /api/autopay/gateways), więc pokazuje to, co klient
 * faktycznie zobaczy w kasie: BLIK, przelewy online, karty, portfele.
 * Gdy lista jest niedostępna, pokazujemy podstawowy zestaw (BLIK, przelew,
 * karta) + płatność przy odbiorze, które kasa zawsze oferuje.
 */

type Gateway = { gatewayID: number; gatewayName: string; gatewayType: string }

const BLIK = 509
const CARD = 1500
const GOOGLE_PAY = 1512
const APPLE_PAY = 1513

let cached: Gateway[] | null = null
let inflight: Promise<Gateway[]> | null = null

function loadGateways(): Promise<Gateway[]> {
  if (cached) return Promise.resolve(cached)
  if (inflight) return inflight
  inflight = fetch('/api/autopay/gateways')
    .then((res) => (res.ok ? res.json() : { gateways: [] }))
    .then((data: { gateways?: Gateway[] }) => {
      cached = Array.isArray(data.gateways) ? data.gateways : []
      return cached
    })
    .catch(() => [])
    .finally(() => {
      inflight = null
    })
  return inflight
}

function Chip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-[#DADADA] bg-white px-2.5 text-[12px] text-black"
    >
      {children}
    </span>
  )
}

export default function AcceptedPayments({ className }: { className?: string }) {
  const [gateways, setGateways] = useState<Gateway[] | null>(cached)

  useEffect(() => {
    let active = true
    void loadGateways().then((list) => active && setGateways(list))
    return () => {
      active = false
    }
  }, [])

  const ids = new Set((gateways ?? []).map((g) => g.gatewayID))
  const known = gateways !== null && gateways.length > 0
  const bankCount = (gateways ?? []).filter((g) => ![BLIK, CARD, GOOGLE_PAY, APPLE_PAY].includes(g.gatewayID)).length
  const showBlik = !known || ids.has(BLIK)
  const showCard = !known || ids.has(CARD)
  const showTransfer = !known || bankCount > 0

  return (
    <div className={className}>
      <p className="text-black text-[clamp(14px,1.4vw,16px)] mb-2">Akceptujemy</p>
      <ul className="flex flex-wrap gap-2 list-none p-0 m-0">
        {showBlik && (
          <li>
            <Chip label="BLIK"><LogoBlik /></Chip>
          </li>
        )}
        {showTransfer && (
          <li>
            <Chip label="Szybki przelew online">
              <Landmark className="w-4 h-4" strokeWidth={1.75} />
              Szybki przelew{bankCount > 1 ? ` (${bankCount} banków)` : ''}
            </Chip>
          </li>
        )}
        {showCard && (
          <li>
            <Chip label="Karta płatnicza Visa / Mastercard"><LogoCards /></Chip>
          </li>
        )}
        {ids.has(GOOGLE_PAY) && (
          <li>
            <Chip label="Google Pay"><LogoGooglePay /></Chip>
          </li>
        )}
        {ids.has(APPLE_PAY) && (
          <li>
            <Chip label="Apple Pay"><LogoApplePay /></Chip>
          </li>
        )}
        <li>
          <Chip label="Płatność przy odbiorze">
            <Banknote className="w-4 h-4" strokeWidth={1.75} />
            Za pobraniem
          </Chip>
        </li>
      </ul>
    </div>
  )
}
