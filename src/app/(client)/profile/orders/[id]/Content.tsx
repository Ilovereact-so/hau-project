import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import ProfileMenu from '@/components/ProfileMenu'
import PriceFormatter from '@/components/PriceFormatter'
import type { getOrderDetail } from '@/actions/orders'
import PayOrderPanel from '@/components/orders/PayOrderPanel'
import { WITHDRAWAL_PATH } from '@/lib/withdrawals'
import { ORDER_STATUS_LABEL, isPaidOrderStatus } from '@/lib/orderStatus'

type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>

const PAYMENT_LABEL: Record<string, string> = {
  przelewy24: 'Przelewy24',
  autopay: 'Autopay',
  cod: 'Za pobraniem',
}

// Te same etykiety stanów co na liście zamówień (../Content.tsx) — w profilu
// status pokazujemy tekstem ("Stan zamówienia: Opłacone"), bez kolorowych badge,
// żeby szczegóły wyglądały jak rozwinęcie wiersza z listy.
const STATUS_LABEL = ORDER_STATUS_LABEL

const SHIPMENT_STATUS_LABEL: Record<string, string> = {
  created: 'Przesyłka utworzona',
  picked_up: 'Odebrana przez kuriera',
  in_transit: 'W drodze',
  out_for_delivery: 'W doręczeniu',
  delivered: 'Dostarczona',
  failed: 'Nieudane dostarczenie',
  returned: 'Zwrócona',
}

/**
 * Komunikat po powrocie z płatności (`?payment=success|pending|cod|error|unpaid`).
 * Przy zamówieniu, które wciąż czeka na płatność, szczegóły i przycisk „Zapłać”
 * pokazuje panel płatności — tu tylko krótka informacja.
 */
function PaymentBanner({ payment, status }: { payment?: string | null; status: string }) {
  if (!payment) return null
  const paid = isPaidOrderStatus(status)
  if (status === 'awaiting_payment' && (payment === 'unpaid' || payment === 'error' || payment === 'failed')) return null
  const text =
    payment === 'cod'
      ? 'Zamówienie przyjęte — zapłacisz przy odbiorze.'
      : paid
        ? 'Płatność przyjęta — dziękujemy! Zamówienie jest w realizacji.'
        : status === 'cancelled'
          ? 'To zamówienie zostało anulowane.'
          : payment === 'error' || payment === 'failed'
            ? 'Płatność nie doszła do skutku. Spróbuj ponownie albo skontaktuj się z nami.'
            : 'Czekamy na potwierdzenie płatności od operatora — status odświeży się za chwilę. Jeśli płatność się nie uda, możesz zapłacić ponownie poniżej.'
  const tone = (payment === 'error' || payment === 'failed') && !paid ? 'bg-[#fcefec] text-[#8A2E1C]' : 'bg-[#EDEDED] text-black'
  return <p className={`mt-5 rounded-[20px] px-5 py-3 text-[clamp(13px,1.6vw,15px)] ${tone}`}>{text}</p>
}

/** Linia "Etykieta: wartość" — szara etykieta, czarna wartość
 *  (wzór: "Zamówienie: #XXX" z listy zamówień). */
function InfoLine({ label, value, className = '' }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <p className={`2xl:text-[15px] text-[clamp(13px,1.8vw,14px)] text-black ${className}`}>
      <span className='text-[#6C6C6C]'>{label}: </span>
      {value}
    </p>
  )
}

/** Sekcja bez kart — szary tytuł + linie tekstu. Kolumny rozdziela pionowa
 *  czarna kreska (ten sam motyw co między produktami na liście zamówień). */
function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col md:min-w-[220px]'>
      <h3 className='text-black 2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] mb-2'>{title}</h3>
      <div className='flex flex-col space-y-1.5'>{children}</div>
    </div>
  )
}

/**
 * Szczegóły zamówienia — utrzymane w języku wizualnym /profile:
 * zero białych kart i ramek, otwarty układ, czarne kreski jako separatory,
 * typografia 2xl:text-[16px]/text-[15px] z etykietami #6C6C6C, pigułkowe
 * przyciski. Na mobile menu profilu przechodzi nad treść (poziomy pasek),
 * a kolumny informacyjne układają się jedna pod drugą.
 */
export default function Content({
  data,
  variant = 'profile',
  payment: paymentParam,
  guestLink,
  accessToken,
}: {
  data: OrderDetail
  /** `guest` — zamówienie bez konta: bez menu profilu, z linkiem do zachowania. */
  variant?: 'profile' | 'guest'
  /** `?payment=` z powrotu z bramki — komunikat nad zamówieniem. */
  payment?: string | null
  /** Pełny adres strony zamówienia gościa (z tokenem) — do skopiowania. */
  guestLink?: string | null
  /** Token z linku zamówienia gościa (`?t=`) — do płatności z innego urządzenia. */
  accessToken?: string | null
}) {
  const isGuest = variant === 'guest'
  const { order, items, address, payment, shipment, paymentDeadline } = data
  // Termin minął i zamówienie anulowano bez płatności (wygasła próba płatności).
  const expiredUnpaid = order.status === 'cancelled' && payment?.status === 'expired'
  const createdAt = order.createdAt ? format(new Date(order.createdAt), 'd MMMM yyyy, HH:mm', { locale: pl }) : null
  const updatedAt = order.updatedAt ? format(new Date(order.updatedAt), 'd MMMM yyyy, HH:mm', { locale: pl }) : null

  return (
    <div className='flex flex-col 3md:flex-row w-full pt-10 font-poppins relative'>
      {!isGuest && <ProfileMenu selected={1} />}

      <div className={`w-full min-w-0 flex flex-col mt-4 lg:mt-0 ${isGuest ? '' : '2xl:pl-12'}`}>
        {isGuest ? (
          <Link
            href='/'
            className='w-fit rounded-full font-bold bg-[#EDEDED] text-fancy-black 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] md:py-4 py-3 md:px-6 px-5 hover:bg-[#EDEDED]/40 hover:text-fancy-black transition-colors cursor-pointer flex items-center space-x-2'
          >
            <ArrowLeft size={18} />
            <p>Wróć do sklepu</p>
          </Link>
        ) : (
          <Link
            href='/profile/orders'
            className='w-fit rounded-full font-bold bg-[#EDEDED] text-fancy-black 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] md:py-4 py-3 md:px-6 px-5 hover:bg-[#EDEDED]/40 hover:text-fancy-black transition-colors cursor-pointer flex items-center space-x-2'
          >
            <ArrowLeft size={18} />
            <p>Moje zamówienia</p>
          </Link>
        )}

        <PaymentBanner payment={paymentParam} status={order.status} />

        {paymentDeadline && (
          <PayOrderPanel
            orderId={order.id}
            totalCents={order.totalCents}
            deadline={paymentDeadline}
            accessToken={accessToken}
            highlight={paymentParam === 'unpaid' || paymentParam === 'error' || paymentParam === 'failed' || payment?.status === 'failed'}
          />
        )}

        {expiredUnpaid && (
          <div className='mt-5 rounded-[20px] bg-[#EDEDED] px-5 py-4 text-[clamp(13px,1.6vw,15px)] text-black'>
            <p className='font-medium'>Zamówienie anulowane — minął termin płatności</p>
            <p className='text-[#3A3A3A] mt-1'>
              Nie pobraliśmy żadnej płatności. Jeśli nadal chcesz te produkty, złóż zamówienie ponownie.
            </p>
            <Link href='/' className='mt-3 inline-block rounded-full bg-fancy-black text-white px-5 py-2 text-[14px] font-medium'>
              Wróć do sklepu
            </Link>
          </div>
        )}

        {isGuest && guestLink && (
          <div className='mt-5 rounded-[24px] bg-[#e2f3f0] px-5 py-4 text-[clamp(13px,1.6vw,15px)] text-black'>
            <p className='font-medium'>Dziękujemy za zamówienie!</p>
            <p className='text-[#3A3A3A] mt-1'>
              Zamówienie złożone bez konta. Zachowaj ten link — pod nim zawsze sprawdzisz status zamówienia i przesyłki:
            </p>
            <p className='mt-2 break-all font-mono text-[12px] bg-white/70 rounded-[12px] px-3 py-2 select-all'>{guestLink}</p>
          </div>
        )}

        {/* Nagłówek — ten sam wzór co wiersz zamówienia na liście */}
        <div className='flex flex-col sm:flex-row sm:items-start justify-between gap-3 mt-6'>
          <div className='flex flex-col'>
            <h1 className='text-[16px] text-[#6C6C6C] '>
              Zamówienie: <span className='text-black ml-1'>#{order.id.slice(0, 8).toUpperCase()}</span>
            </h1>
            {createdAt && <p className='2xl:text-[14px] text-[clamp(11px,1.8vw,13px)] text-[#6C6C6C] mt-1'>Złożone {createdAt}</p>}
            {updatedAt && <p className='2xl:text-[14px] text-[clamp(11px,1.8vw,13px)] max-xl:flex max-xl:flex-col max-md:flex-row max-xl:items-end max-md:space-x-3 text-[#6C6C6C]'>ost. aktualizacja: {updatedAt}</p>}
          </div>
          <p className='2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] max-xl:flex max-xl:flex-col max-sm:flex-row max-xl:items-end text-black max-xl:space-x-3 max-sm:space-x-2'>
            <span>Stan zamówienia: </span><span className='font-medium'>{STATUS_LABEL[order.status] ?? order.status}</span>
          </p>
        </div>

        {/* Funkcja odstąpienia od umowy (dyrektywa (UE) 2023/2673) — przy
            opłaconym zamówieniu, z wypełnionym numerem i e-mailem. */}
        {isPaidOrderStatus(order.status) && (
          <Link
            href={`${WITHDRAWAL_PATH}?${new URLSearchParams({ zamowienie: order.id.slice(0, 8).toUpperCase(), ...(address?.email ? { email: address.email } : {}) })}`}
            className='mt-3 w-fit text-[14px] text-[#6C6C6C] underline underline-offset-2 hover:text-black'
          >
            Odstąp od umowy
          </Link>
        )}

        {/* Produkty — otwarte wiersze bez kart, separatory cienką czarną linią */}
        <div className='flex md:flex-row flex-col w-full'>
          <div className='mt-8 flex flex-col md:w-[60%] w-full bg-[#ededed] rounded-[35px] 2md:px-8 px-6 py-3'>
            {items.map((item) => (
              <div key={item.id}>
                <div className='flex items-center gap-4 xl:gap-6 py-2'>
                  {item.imageUrl && (
                    <Image
                      src={item.imageUrl}
                      alt={item.name ?? 'Produkt'}
                      width={120}
                      height={120}
                      className='object-cover rounded-[20px] brightness-93 w-[76px] h-[76px] sm:w-[100px] sm:h-[100px] lg:w-[120px] lg:h-[120px] flex-shrink-0'
                    />
                  )}
                  <div className='flex flex-col min-w-0 flex-1'>
                    {item.brand && <p className='2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] text-[#6C6C6C]'>{item.brand}</p>}
                    <p className='2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] text-black line-clamp-1'>{item.name}</p>
                    {item.variantLabel && <p className='2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] text-[#6C6C6C]'>{item.variantLabel}</p>}
                    <p className='2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] text-[#6C6C6C]'>Ilość: {item.qty}</p>
                  </div>
                  <div className='flex flex-col items-end flex-shrink-0'>
                    <PriceFormatter
                      amount={(item.priceCents * item.qty) / 100}
                      className='2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] font-medium text-black'
                    />
                    <p className='2xl:text-[14px] text-[clamp(11px,1.8vw,13px)] text-[#6C6C6C] mt-0.5'>{(item.priceCents / 100).toFixed(2)} zł / szt.</p>
                  </div>
                </div>
                
              </div>
            ))}
          </div>

          {/* Przesyłka / Płatność / Adres — kolumny tekstu z pionowymi czarnymi
              kreskami (wzór z listy zamówień); na mobile układają się w kolumnę. */}
          <div className='mt-10 md:mt-14 md:flex md:flex-col grid max-md:grid-cols-2 max-sm:grid-cols-[auto_max-content] max-md:px-10 max-sm:px-3 xl:w-[40%] md:w-[30%] w-full md:ml-10 space-y-10'>
            {shipment && (
              <>
                <InfoSection title='Przesyłka'>
                  <InfoLine label='Status' value={SHIPMENT_STATUS_LABEL[shipment.status] ?? shipment.status} />
                  <InfoLine label='Kurier' value={shipment.carrier} />
                  {shipment.trackingNumber && (
                    <InfoLine label='Numer śledzenia' value={<span className='break-all'>{shipment.trackingNumber}</span>} />
                  )}
                  {shipment.labelUrl && (
                    <a
                      href={shipment.labelUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='w-fit rounded-full font-bold bg-fancy-black text-white 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] py-3 px-8 hover:bg-fancy-black/90 transition-colors cursor-pointer mt-3'
                    >
                      Pobierz etykietę
                    </a>
                  )}
                </InfoSection>
                
              </>
            )}
            {address && (
              <InfoSection title='Adres dostawy'>
                <p className='2xl:text-[15px] text-[clamp(13px,1.8vw,14px)] text-black'>
                  {address.firstName} {address.lastName}
                </p>
                {address.pickupPointName ? (
                  <p className='2xl:text-[15px] text-[clamp(13px,1.8vw,14px)] text-black'>{address.pickupPointName}</p>
                ) : (
                  <>
                    <p className='2xl:text-[15px] text-[clamp(13px,1.8vw,14px)] text-black'>{address.street}</p>
                    <p className='2xl:text-[15px] text-[clamp(13px,1.8vw,14px)] text-black'>{address.postalCode} {address.city}</p>
                  </>
                )}
                <InfoLine label='E-mail' value={address.email} />
                <InfoLine label='Telefon' value={address.phone} />
              </InfoSection>
            )}
            {payment && (
              <>
                <InfoSection title='Płatność'>
                  <InfoLine label='Metoda' value={PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod} />
                  <InfoLine
                    label='Status'
                    value={payment.status === 'success' ? 'Opłacona' : payment.status === 'failed' ? 'Nieudana' : payment.status === 'expired' ? 'Wygasła' : 'Oczekująca'}
                  />
                </InfoSection>
                
              </>
            )}
            
            {/* Podsumowanie — kwoty bez karty, "Łącznie" nad czarną kreską */}
            <div className='w-full xl:max-w-[440px] max-md:col-span-2 '>
              <h2 className='2xl:text-[18px] text-[clamp(14px,1.8vw,16px)] font-medium text-black'>Podsumowanie</h2>
              <div className='mt-3 flex flex-col 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)]'>
                <div className='flex justify-between'>
                  <span className='text-[#6C6C6C]'>Produkty</span>
                  <PriceFormatter amount={order.subtotalCents / 100} className='font-normal text-black' />
                </div>
                <div className='flex justify-between'>
                  <span className='text-[#6C6C6C]'>Dostawa</span>
                  <PriceFormatter amount={order.shippingCents / 100} className='font-normal text-black' />
                </div>
                {order.discountCents > 0 && (
                  <div className='flex justify-between'>
                    <span className='text-green-600'>Rabat{order.discountCode ? ` (${order.discountCode})` : ''}</span>
                    <PriceFormatter amount={-order.discountCents / 100} className='font-normal text-green-600' />
                  </div>
                )}
                <div className='flex justify-between mt-2 2xl:text-[17px] text-[clamp(14px,1.8vw,16px)] text-black'>
                  <span>Łącznie</span>
                  <PriceFormatter amount={order.totalCents / 100} className='font-medium text-black' />
                </div>
              </div>
            </div>
          </div>

          
        </div>
      </div>
    </div>
  )
}
