import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Package, ChevronRight, ShoppingBag } from 'lucide-react'
import Container from '@/components/Container'
import PriceFormatter from '@/components/PriceFormatter'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { Button } from '@/components/ui/button'
import { getMyOrders } from '@/actions/orders'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

export const dynamic = 'force-dynamic'

const PAYMENT_LABEL: Record<string, string> = {
  przelewy24: 'Przelewy24',
  autopay:    'Autopay',
  cod:        'Za pobraniem',
}

export default async function OrdersPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in?redirect_url=/orders')

  const orders = await getMyOrders()

  if (!orders.length) {
    return (
      <Container className="px-4 sm:px-8 lg:px-15 my-10 font-poppins">
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-[#F4F4F4] flex items-center justify-center">
            <Package size={36} className="text-[#BBBBBB]" />
          </div>
          <h2 className="text-[22px] font-semibold text-fancy-black">
            Brak zamówień
          </h2>
          <p className="text-[#6C6C6C] text-[15px] max-w-sm">
            Nie złożyłeś jeszcze żadnego zamówienia. Zacznij zakupy, a Twoje zamówienia pojawią się tutaj.
          </p>
          <Button asChild className="rounded-full bg-fancy-black text-white font-bold px-8 py-5 hover:bg-fancy-black/90">
            <Link href="/">
              <ShoppingBag size={16} className="mr-2" />
              Przejdź do sklepu
            </Link>
          </Button>
        </div>
      </Container>
    )
  }

  return (
    <Container className="px-4 sm:px-8 lg:px-15 my-10 font-poppins">
      <h1 className="text-[clamp(18px,1.8vw,26px)] font-semibold text-fancy-black mb-8">
        Moje zamówienia
      </h1>

      <div className="space-y-4">
        {orders.map(order => (
          <Link
            key={order.id}
            href={`/orders/${order.id}`}
            className="group block bg-white border border-[#E8E8E8] rounded-2xl p-5 hover:border-fancy-black transition-colors"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

              {/* left */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <p className="text-[13px] font-mono text-[#6C6C6C]">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-[15px] font-semibold text-fancy-black">
                  <PriceFormatter amount={order.totalCents / 100} className="text-[15px] font-semibold text-fancy-black" />
                </p>
                <p className="text-[13px] text-[#6C6C6C]">
                  {PAYMENT_LABEL[order.paymentMethod]} ·{' '}
                  {order.createdAt
                    ? format(new Date(order.createdAt), 'd MMM yyyy', { locale: pl })
                    : '—'}
                </p>
              </div>

              {/* right */}
              <div className="flex items-center gap-2 text-[#6C6C6C] group-hover:text-fancy-black transition-colors">
                <span className="text-[14px] font-medium">Szczegóły</span>
                <ChevronRight size={16} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Container>
  )
}
