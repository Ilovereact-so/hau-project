import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, MapPin, CreditCard, Truck, Package } from 'lucide-react'
import Container from '@/components/Container'
import PriceFormatter from '@/components/PriceFormatter'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { getOrderDetail } from '@/actions/orders'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const PAYMENT_LABEL: Record<string, string> = {
  przelewy24: 'Przelewy24',
  autopay:    'Autopay',
  cod:        'Za pobraniem',
}

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  created:          'Przesyłka utworzona',
  picked_up:        'Odebrana przez kuriera',
  in_transit:       'W drodze',
  out_for_delivery: 'W doręczeniu',
  delivered:        'Dostarczona',
  failed:           'Nieudane dostarczenie',
  returned:         'Zwrócona',
}

function InfoCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-[#6C6C6C]" />
        <h3 className="text-[14px] font-semibold text-fancy-black">{title}</h3>
      </div>
      {children}
    </div>
  )
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params
  const { userId } = await auth()
  if (!userId) redirect(`/sign-in?redirect_url=/orders/${id}`)

  const data = await getOrderDetail(id)
  if (!data) notFound()

  const { order, items, address, payment, shipment } = data

  return (
    <Container className="px-4 sm:px-8 lg:px-15 my-10 font-poppins">

      {/* breadcrumb */}
      <Link
        href="/orders"
        className="inline-flex items-center gap-2 text-[14px] text-[#6C6C6C] hover:text-fancy-black transition-colors mb-6"
      >
        <ArrowLeft size={15} />
        Moje zamówienia
      </Link>

      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[clamp(18px,1.8vw,24px)] font-semibold text-fancy-black">
            Zamówienie #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          {order.createdAt && (
            <p className="text-[13px] text-[#6C6C6C] mt-1">
              Złożone {format(new Date(order.createdAt), 'd MMMM yyyy, HH:mm', { locale: pl })}
            </p>
          )}
        </div>
        <OrderStatusBadge status={order.status} className="text-[13px] px-4 py-1.5" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">

        {/* ── left: items + shipment ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* items */}
          <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#F0F0F0]">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-[#6C6C6C]" />
                <h3 className="text-[14px] font-semibold text-fancy-black">Produkty</h3>
              </div>
            </div>
            <div className="divide-y divide-[#F5F5F5]">
              {items.map(item => (
                <div key={item.id} className="flex items-start gap-4 px-5 py-4">
                  {item.imageUrl && (
                    <div className="w-14 h-14 rounded-xl overflow-hidden border border-[#F0F0F0] flex-shrink-0">
                      <Image
                        src={item.imageUrl}
                        alt={item.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-fancy-black line-clamp-1">{item.name}</p>
                    {item.variantLabel && (
                      <p className="text-[12px] text-[#6C6C6C] mt-0.5">{item.variantLabel}</p>
                    )}
                    <p className="text-[12px] text-[#6C6C6C] mt-0.5">Ilość: {item.qty}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <PriceFormatter
                      amount={(item.priceCents * item.qty) / 100}
                      className="text-[14px] font-semibold text-fancy-black"
                    />
                    <p className="text-[11px] text-[#BBBBBB] mt-0.5">
                      {(item.priceCents / 100).toFixed(2)} zł / szt.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* shipment tracking */}
          {shipment && (
            <InfoCard icon={Truck} title="Przesyłka">
              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#6C6C6C]">Status</span>
                  <span className="font-medium text-fancy-black">
                    {SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6C6C6C]">Kurier</span>
                  <span className="font-medium text-fancy-black capitalize">{shipment.carrier}</span>
                </div>
                {shipment.trackingNumber && (
                  <div className="flex justify-between">
                    <span className="text-[#6C6C6C]">Numer śledzenia</span>
                    <span className="font-mono text-[13px] text-fancy-black">{shipment.trackingNumber}</span>
                  </div>
                )}
                {shipment.labelUrl && (
                  <a
                    href={shipment.labelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-3 text-center border border-fancy-black rounded-full py-2 text-[13px] font-semibold text-fancy-black hover:bg-fancy-black hover:text-white transition-colors"
                  >
                    Pobierz etykietę
                  </a>
                )}
              </div>
            </InfoCard>
          )}
        </div>

        {/* ── right: summary ───────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* totals */}
          <div className="bg-white border border-[#E8E8E8] rounded-2xl p-5">
            <h3 className="text-[14px] font-semibold text-fancy-black mb-4">Podsumowanie</h3>
            <div className="space-y-2.5 text-[14px]">
              <div className="flex justify-between text-[#6C6C6C]">
                <span>Produkty</span>
                <PriceFormatter amount={order.subtotalCents / 100} className="font-normal text-[#6C6C6C]" />
              </div>
              <div className="flex justify-between text-[#6C6C6C]">
                <span>Dostawa</span>
                <PriceFormatter amount={order.shippingCents / 100} className="font-normal text-[#6C6C6C]" />
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Rabat{order.discountCode ? ` (${order.discountCode})` : ''}</span>
                  <PriceFormatter amount={-order.discountCents / 100} className="font-normal text-green-600" />
                </div>
              )}
              <div className="border-t border-[#F0F0F0] pt-2.5 flex justify-between font-bold text-[15px] text-fancy-black">
                <span>Łącznie</span>
                <PriceFormatter amount={order.totalCents / 100} className="font-bold text-fancy-black" />
              </div>
            </div>
          </div>

          {/* payment */}
          {payment && (
            <InfoCard icon={CreditCard} title="Płatność">
              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#6C6C6C]">Metoda</span>
                  <span className="font-medium text-fancy-black">
                    {PAYMENT_LABEL[order.paymentMethod]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6C6C6C]">Status</span>
                  <span
                    className={
                      payment.status === 'success'
                        ? 'text-green-600 font-medium'
                        : payment.status === 'failed'
                        ? 'text-red-500 font-medium'
                        : 'text-yellow-600 font-medium'
                    }
                  >
                    {payment.status === 'success'
                      ? 'Opłacona'
                      : payment.status === 'failed'
                      ? 'Nieudana'
                      : 'Oczekująca'}
                  </span>
                </div>
              </div>
            </InfoCard>
          )}

          {/* address */}
          {address && (
            <InfoCard icon={MapPin} title="Adres dostawy">
              <div className="text-[14px] text-[#6C6C6C] space-y-0.5">
                <p className="font-semibold text-fancy-black">
                  {address.firstName} {address.lastName}
                </p>
                <p>{address.street}</p>
                <p>{address.postalCode} {address.city}</p>
                <p className="mt-1">{address.email}</p>
                <p>{address.phone}</p>
              </div>
            </InfoCard>
          )}
        </div>
      </div>
    </Container>
  )
}
