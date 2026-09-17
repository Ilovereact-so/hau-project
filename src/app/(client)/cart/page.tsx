// src/app/cart/page.tsx
'use client'

import Container from '@/components/Container'
import PriceFormatter from '@/components/PriceFormatter'
import QuantityButtons from '@/components/QuantityButtons'
import EmptyCart from '@/components/EmptyCart'
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
import { WishlistButton } from '@/components/WishlistButton'
import { useAuthModalStore } from '@/store/authModalStore'
import { effectivePrice } from '@/lib/omnibus'

export default function CartPage() {
  const [isClient, setIsClient] = useState(false)
  const { isSignedIn }          = useAuth()

  // selektywne subskrypcje — każdy selektor re-renderuje tylko gdy jego kawałek się zmieni
  const cartItems      = useStore(s => s.cartItems)
  const resetCart      = useStore(s => s.resetCart)
  const getItemCount   = useStore(s => s.getItemCount)
  const getTotalPrice  = useStore(s => s.getTotalPrice)
  const getSubTotal    = useStore(s => s.getSubTotalPrice)
  const cartReady      = useStore(s => s.cartReady)
  const openModal      = useAuthModalStore(s => s.openModal)

  useEffect(() => { setIsClient(true) }, [])
  // Koszyk działa bez logowania. Czekamy tylko, aż StoreHydration ustali
  // właściciela koszyka (np. scalenie koszyka gościa zaraz po zalogowaniu),
  // żeby nie pokazać na chwilę nieaktualnej zawartości.
  if (!isClient || !cartReady) return <Loading />

  const handleResetCart = () => {
    if (!window.confirm('Czy na pewno chcesz wyczyścić koszyk?')) return
    resetCart()
    toast.success('Koszyk wyczyszczony')
  }

  return (
    <Container className="xl:px-15 lg;px-13 px-6 my-10 font-poppins flex justify-center">
      {cartItems.length ? (
        <>
          

          <div className="flex md:flex-row flex-col relative max-md:w-full max-md:space-y-3">
            {/* ── lista produktów ── */}
            <div className="flex flex-col justify-between xl:min-w-[700px] w-full bg-[#ededed] rounded-[35px] 2md:px-8 px-6 py-3">
              
              {cartItems.map(({ product, variant }) => {
                const count = getItemCount(product._id, variant)
                const variantProps = product.variants?.find(v => v._key === variant)
                // cena wariantu lub fallback na cenę bazową — ta sama reguła co checkout
                const unitPrice = effectivePrice(product, variant) ?? 0

                return (
                  <div
                    key={product._id + variant}
                    className="flex 2md:items-center items-end justify-between py-2"
                  >
                    <div id="cart_container" className="2md:h-41 md:h-auto sm:h-41 h-auto">
                      {product?.images && (
                        <div style={{ gridArea: 'image' }} className="p-0.5 md:p-1 mr-2 rounded-md overflow-hidden group">
                          <Image
                            src={urlFor(product.images[0]).url()}
                            alt="productImage"
                            width={500}
                            height={500}
                            loading="lazy"
                            className="w-30 lg:w-40 2md:h-34 h-25 lg:h-40 object-cover 2md:group-hover:scale-115 group-hover:scale-135 2md:scale-120 scale-140 transition-transform duration-500 brightness-93"
                          />
                        </div>
                      )}
                      <div style={{ gridArea: 'title' }} className="h-full flex flex-1 flex-col mt-2">
                        <div className="flex flex-col">
                          <p className="text-[clamp(14px,1.4vw,16px)] text-black">{product?.brand}</p>
                          <h2 className="text-[clamp(16px,1.4vw,18px)] font-medium text-black line-clamp-1">
                            {product?.title}
                          </h2>
                          <p className="text-[clamp(13px,1.4vw,15px)] text-[#6C6C6C] lg:mt-1">{product?.type?.title}</p>
                        </div>
                        
                      </div>
                      <div style={{gridArea:'variants'}} className="flex flex-col text-[#6C6C6C] text-[clamp(13px,1.4vw,15px)] mb-2">                          
                          {variantProps?.optionValues?.map((item, index) => (
                            <div key={index} className="text-[#6C6C6C] flex space-x-2">
                              <p>{item.name?.label}</p>
                              <p>{item.value?.value}</p>
                            </div>
                          ))}
                        </div>
                    </div>

                    <div className="flex flex-col items-end space-y-3">
                      <PriceFormatter
                        amount={unitPrice * count}
                        className="font-bold text-black text-[clamp(14px,1.4vw,16px)]"
                      />
                      <QuantityButtons product={product} variant={variant} className="text-[clamp(14px,1.4vw,16px)]" />
                      <label className="p-2 rounded-full ease-in-out duration-200 cursor-pointer ">
                        <WishlistButton
                          productId={product._id}
                          product={product}
                          className="cursor-pointer lg:w-6 lg:h-6 w-5  h-5 "
                        />
                      </label>
                    </div>
                  </div>
                )
              })}

              <Button
                onClick={handleResetCart}
                className="mt-3  text-black border-1 border-black rounded-[20px] px-6 py-5 w-fit text-[clamp(14px,1.4vw,16px)] hover:text-red-500 transition-colors duration-300 cursor-pointer"
                variant="destructive"
              >
                Wyczyść koszyk
              </Button>
            </div>

            {/* ── podsumowanie ── */}
            <div className="flex flex-col xl:w-full w-auto xl:max-w-[500px] 2md:min-w-[350px] min-w-[320px] h-auto">
              <div className="flex flex-col w-full 2md:px-6 max-2md:pl-6 max-md:pl-0 sticky 2md:top-4 top-8 ">
                <h2 className="text-[clamp(16px,1.5vw,23px)] text-black font-semibold">
                  Podsumowanie
                </h2>

                {/* kod rabatowy — TODO: podpiąć logikę */}
                <div className="text-black bg-[#E1E1E1] rounded-full flex flex-col py-3 px-6 lg:mt-6 mt-4">
                  <div className="flex justify-between items-center text-black text-[clamp(14px,1.4vw,16px)] font-medium">
                    <p>Masz kod promocyjny?</p>
                    <ChevronDown className="text-black lg:w-6 lg:h-6 w-5 h-5" />
                  </div>
                </div>

                <div className="text-black text-[clamp(14px,1.4vw,16px)] lg:mt-6 mt-4">
                  <div className="flex justify-between">
                    <span>Wartość produktów</span>
                    <PriceFormatter amount={getSubTotal()} className="font-normal" />
                  </div>
                  <div className="flex justify-between">
                    <span>Dostawa od</span>
                    <PriceFormatter amount={10.49} className="font-normal" />
                  </div>

                  <Separator />

                  <div className="flex justify-between font-bold text-[clamp(14px,1.4vw,16px)] lg:my-4 my-3">
                    <p>
                      Do zapłaty{' '}
                      <span className="font-normal">w tym VAT</span>
                    </p>
                    <PriceFormatter
                      amount={getTotalPrice()}
                      className="text-[clamp(14px,1.4vw,18px)] font-bold text-black"
                    />
                  </div>

                  {isSignedIn ? (
                    <Button asChild className="w-auto cursor-pointer rounded-full font-bold tracking-wide bg-fancy-black text-white text-[clamp(14px,1.4vw,16px)] lg:py-6 sm:py-5 py-3 lg:px-8p sm:px-7 px-6">
                      <Link href="/checkout">Przejdź do kasy</Link>
                    </Button>
                  ) : (
                    <>
                      {/* Gość: zamówienie wymaga konta. Po zalogowaniu koszyk jest
                          scalany z kontem, a użytkownik trafia prosto do kasy. */}
                      <Button
                        type="button"
                        onClick={() => openModal('signIn', { redirectTo: '/checkout' })}
                        className="w-auto cursor-pointer rounded-full font-bold tracking-wide bg-fancy-black text-white text-[clamp(14px,1.4vw,16px)] lg:py-6 sm:py-5 py-3 lg:px-8p sm:px-7 px-6"
                      >
                        Zaloguj się i przejdź do kasy
                      </Button>
                      <p className="text-[#6C6C6C] text-[clamp(12px,1.2vw,14px)] mt-2">
                        Produkty w koszyku zostaną zachowane i dodane do Twojego konta.{' '}
                        <button
                          type="button"
                          onClick={() => openModal('signUp', { redirectTo: '/checkout' })}
                          className="text-black underline underline-offset-2 cursor-pointer"
                        >
                          Nie masz konta? Załóż je
                        </button>
                      </p>
                    </>
                  )}

                  <p className="text-black text-[clamp(14px,1.4vw,16px)] lg:mt-4 mt-3 mb-2">Akceptujemy</p>
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