'use client'

import { Heart } from 'lucide-react'
import Link from 'next/link'
import useStore from 'store'
import Container from './Container'
import WishlistProduct from './WishlistProduct'
import { WishlistCardSkeleton } from './ui/Skeleton'
import { useAuthModalStore } from '@/store/authModalStore'

function GuestWishlistNotice({ hasItems }: { hasItems: boolean }) {
  const openModal = useAuthModalStore(s => s.openModal)
  return (
    <div className='flex max-sm:flex-col sm:items-center justify-between gap-3 rounded-[24px] bg-[#ededed] px-6 py-4 mb-8 text-black'>
      <p className='text-[clamp(13px,1.2vw,15px)]'>
        {hasItems
          ? 'Polubione zapisaliśmy na tym urządzeniu. Zaloguj się, a przeniesiemy je na Twoje konto.'
          : 'Polubione produkty zapiszemy na tym urządzeniu — po zalogowaniu trafią na Twoje konto.'}
      </p>
      <button
        type='button'
        onClick={() => openModal('signIn')}
        className='shrink-0 rounded-full bg-fancy-black text-white font-medium px-6 py-2.5 text-[14px] cursor-pointer hover:bg-black transition-colors'
      >
        Zaloguj się
      </button>
    </div>
  )
}

export function WishlistPageClient() {
  const wishlistProducts = useStore(s => s.wishlistProducts)
  const wishlistReady    = useStore(s => s.wishlistReady)
  const isGuest          = useStore(s => s.session.status === 'guest')

  const notice = isGuest ? <GuestWishlistNotice hasItems={wishlistProducts.length > 0} /> : null

  if (!wishlistReady) {
    // Szkielety kart zamiast samego napisu — grid o tym samym układzie co lista
    // poniżej, więc po dociągnięciu danych z Sanity nic się nie przeskoczy.
    return (
      <Container className="w-full font-poppins flex flex-col">
        <div className="mt-4 grid 3xl:grid-cols-4 2lg:grid-cols-3 3md:grid-cols-2 1md:grid-cols-3 grid-cols-2 max-3xl:gap-x-[25px] max-2xl:gap-x-[18px] max-sm:gap-x-[10px] gap-x-[25px] gap-y-[75px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <WishlistCardSkeleton key={i} />
          ))}
        </div>
      </Container>
    )
  }

  if (!wishlistProducts.length) {
    return (
      <Container className="w-full font-poppins flex flex-col mt-2">
        {notice}
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
          <Heart className="text-[#afafaf] w-6 h-6" aria-hidden />
          <p className="text-[#6C6C6C] text-[16px]">Nie masz jeszcze polubionych produktów.</p>
          <p className="text-[#afafaf] text-[14px]">Kliknij serce przy produkcie, żeby zapisać go na później.</p>
          <Link href="/" className="mt-2 rounded-full border border-fancy-black text-black px-6 py-2.5 text-[14px] font-medium hover:bg-fancy-black hover:text-white transition-colors">
            Przeglądaj produkty
          </Link>
        </div>
      </Container>
    )
  }

  return (
    <Container className="w-full font-poppins flex flex-col">
      {notice}
      <div className="mt-4 grid 3xl:grid-cols-4 2lg:grid-cols-3 3md:grid-cols-2 1md:grid-cols-3 grid-cols-2 max-3xl:gap-x-[25px] max-2xl:gap-x-[18px] max-sm:gap-x-[10px] gap-x-[25px] gap-y-[75px]">
        {wishlistProducts.map(product => (
          <WishlistProduct product={product} key={product._id} />
        ))}
      </div>
    </Container>
  )
}
