// src/app/cart/page.tsx
'use client'

import Container from '@/components/Container'
import PriceFormatter from '@/components/PriceFormatter'
import QuantityButtons from '@/components/QuantityButtons'
import EmptyCart from '@/components/EmptyCart'
import NoAccessToCart from '@/components/NoAccessToCart'
import Loading from '@/components/Loading'
import { urlFor } from '@/sanity/lib/image'
import { useAuth } from '@clerk/nextjs'
import { ChevronDown } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import useStore from 'store'

export default function CartPage() {
  const [isClient, setIsClient] = useState(false)
  const { isSignedIn }          = useAuth()

  // selektywne subskrypcje — każdy selektor re-renderuje tylko gdy jego kawałek się zmieni
  const cartItems      = useStore(s => s.cartItems)
  const deleteItem     = useStore(s => s.deleteItem)
  const resetCart      = useStore(s => s.resetCart)
  const getItemCount   = useStore(s => s.getItemCount)
  const getTotalPrice  = useStore(s => s.getTotalPrice)
  const getSubTotal    = useStore(s => s.getSubTotalPrice)

  useEffect(() => { setIsClient(true) }, [])
  if (!isClient) return <Loading />

  const handleResetCart = () => {
    if (!window.confirm('Czy na pewno chcesz wyczyścić koszyk?')) return
    resetCart()
    toast.success('Koszyk wyczyszczony')
  }

  const handleDeleteProduct = (id: string, variant: string) => {
    deleteItem(id, variant)
    toast.success('Produkt usunięty')
  }

  if (!isSignedIn) return <NoAccessToCart />

  return (
    <Container className="px-15 my-10 font-poppins">
      {cartItems.length ? (
        <>
          <h1 className="text-[clamp(16px,1.5vw,23px)] text-black font-medium">
            Koszyk
          </h1>

          <div className="grid lg:grid-cols-3 md:gap-8">

            {/* ── lista produktów ── */}
            <div className="lg:col-span-2">
              {cartItems.map(({ product, variant }) => {
                const count = getItemCount(product._id, variant)
                const variantProps = product.variants?.find(v => v._key === variant)
                // cena wariantu lub fallback na cenę bazową
                const unitPrice = variantProps?.price ?? product.price ?? 0

                return (
                  <div
                    key={product._id + variant}
                    className="border-b last:border-b-0 border-[#BBBBBB] flex items-center justify-between py-4"
                  >
                    <div className="flex flex-1 items-start gap-2 h-36 md:h-44">
                      {product?.images && (
                        <div className="p-0.5 md:p-1 mr-2 rounded-md overflow-hidden group">
                          <Image
                            src={urlFor(product.images[0]).url()}
                            alt="productImage"
                            width={500}
                            height={500}
                            loading="lazy"
                            className="w-32 md:w-40 h-32 md:h-40 object-cover group-hover:scale-105 transition-transform duration-500 brightness-90"
                          />
                        </div>
                      )}
                      <div className="h-full flex flex-1 flex-col justify-around py-2">
                        <div className="flex flex-col">
                          <p className="text-[18px] text-black">{product?.brand}</p>
                          <h2 className="text-[20px] font-semibold text-black line-clamp-1">
                            {product?.title}
                          </h2>
                        </div>
                        <div className="flex flex-col">
                          {variantProps?.optionValues?.map((item, index) => (
                            <div key={index} className="text-[#6C6C6C] flex space-x-2">
                              <p>{item.name?.label}</p>
                              <p>{item.value?.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end space-y-3">
                      <PriceFormatter
                        amount={unitPrice * count}
                        className="font-bold text-black text-[16px]"
                      />
                      <QuantityButtons product={product} variant={variant} />
                      <button
                        onClick={() => handleDeleteProduct(product._id, variant)}
                        className="text-[13px] text-[#6C6C6C] underline hover:text-black transition-colors"
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                )
              })}

              <Button
                onClick={handleResetCart}
                className="mt-3 font-bold text-white bg-fancy-black rounded-[20px] px-6 py-5"
                variant="destructive"
              >
                Wyczyść koszyk
              </Button>
            </div>

            {/* ── podsumowanie ── */}
            <div className="lg:col-span-1 max-w-[500px]">
              <div className="flex flex-col w-full p-6">
                <h2 className="text-[clamp(16px,1.5vw,23px)] text-black font-semibold">
                  Podsumowanie
                </h2>

                {/* kod rabatowy — TODO: podpiąć logikę */}
                <div className="text-black bg-[#E1E1E1] rounded-full flex flex-col py-3 px-6 mt-6">
                  <div className="flex justify-between items-center text-black text-[16px] font-medium">
                    <p>Masz kod promocyjny?</p>
                    <ChevronDown />
                  </div>
                </div>

                <div className="text-black text-[16px] mt-6">
                  <div className="flex justify-between">
                    <span>Wartość produktów</span>
                    <PriceFormatter amount={getSubTotal()} className="font-normal" />
                  </div>
                  <div className="flex justify-between">
                    <span>Dostawa od</span>
                    <PriceFormatter amount={10.49} className="font-normal" />
                  </div>

                  <Separator />

                  <div className="flex justify-between font-bold text-[16px] my-4">
                    <p>
                      Do zapłaty{' '}
                      <span className="font-normal">w tym VAT</span>
                    </p>
                    <PriceFormatter
                      amount={getTotalPrice()}
                      className="text-lg font-bold text-black"
                    />
                  </div>

                  <Button asChild className="w-auto cursor-pointer rounded-full font-bold tracking-wide bg-fancy-black text-white text-[16px] py-6 px-8">
                    <Link href="/checkout">Przejdź do kasy</Link>
                  </Button>

                  <p className="text-black text-[16px] mt-4 mb-2">Akceptujemy</p>
                  <Image src="/payment.png" width={300} height={30} alt="payment" />
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <EmptyCart />
      )}
    </Container>
  )
}