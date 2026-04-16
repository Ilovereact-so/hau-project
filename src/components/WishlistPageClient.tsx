'use client'

import useStore from 'store'
import Container from './Container'
import WishlistProduct from './WishlistProduct'

export function WishlistPageClient() {
  const wishlistProducts = useStore(s => s.wishlistProducts)
  const wishlistReady    = useStore(s => s.wishlistReady)

  if (!wishlistReady) {
    return (
      <Container className="px-15 my-14 font-poppins">
        <div className="animate-pulse text-[16px] text-[#6C6C6C]">
          Ładowanie polubionych...
        </div>
      </Container>
    )
  }

  if (!wishlistProducts.length) {
    return (
      <Container className="px-15 my-14 font-poppins">
        <p className="text-black text-[16px]">
          Nie masz jeszcze polubionych produktów.
        </p>
      </Container>
    )
  }

  return (
    <Container className="px-15 my-14 font-poppins flex flex-col">
      <h1 className="text-[20px] text-black font-medium mb-5">Ulubione</h1>
      <div className="mt-4 grid 2.5xl:grid-cols-4 grid-cols-3 gap-x-[18px] gap-y-[75px]">
        {wishlistProducts.map(product => (
          <WishlistProduct product={product} key={product._id} />
        ))}
      </div>
    </Container>
  )
}