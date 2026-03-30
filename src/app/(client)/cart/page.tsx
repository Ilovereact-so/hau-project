"use client";
import Container from "@/components/Container";
import PriceFormatter from "@/components/PriceFormatter";
import QuantityButtons from "@/components/QuantityButtons";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { urlFor } from "@/sanity/lib/image";
import useCartStore from "store";
import { useAuth, useUser } from "@clerk/nextjs";
import { ChevronDown, Heart, ShoppingBag, Trash } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import EmptyCart from "@/components/EmptyCart";
import NoAccessToCart from "@/components/NoAccessToCart";
// import {
//   createCheckoutSession,
//   Metadata,
// } from "@/actions/createCheckoutSession";
import paypalLogo from "@/images/paypalLogo.png";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Loading from "@/components/Loading";

const CartPage = () => {
  const {
    deleteCartProduct,
    getTotalPrice,
    getItemCount,
    getSubTotalPrice,
    resetCart,
  } = useCartStore();
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(false);
  const groupedItems = useCartStore((state) => state.getGroupedItems());
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    setIsClient(true);
  }, []);
  if (!isClient) {
    return <Loading />;
  }

  const handleResetCart = () => {
    const confirmed = window.confirm("Are you sure to reset your Cart?");
    if (confirmed) {
      resetCart();
      toast.success("Your cart reset successfully!");
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    // try {
    //   const metadata: Metadata = {
    //     orderNumber: crypto.randomUUID(),
    //     customerName: user?.fullName ?? "Unknown",
    //     customerEmail: user?.emailAddresses[0]?.emailAddress ?? "Unknown",
    //     clerkUserId: user!.id,
    //   };
    //   const checkoutUrl = await createCheckoutSession(groupedItems, metadata);
    //   if (checkoutUrl) {
    //     window.location.href = checkoutUrl;
    //   }
    // } catch (error) {
    //   console.error("Error creating checkout session:", error);
    // } finally {
    //   setLoading(false);
    // }
  };

  const handleDeleteProduct = (id: string, variant: string) => {
    deleteCartProduct(id, variant);
    toast.success("Product deleted successfully!");
  };

  return (
    <div className="">
      {isSignedIn ? (
        <Container className="px-15 my-10 font-poppins">
          {groupedItems?.length ? (
            <>
              <div className="flex items-center ">
                <h1 className="text-[clamp(16px,1.5vw,23px)] text-black font-medium">Koszyk</h1>
              </div>
              <div className="grid lg:grid-cols-3 md:gap-8">
                {/* Product View start */}
                <div className="lg:col-span-2">
                  <div className="">
                    {groupedItems?.map(({ product, variant }) => {
                      const itemCount = getItemCount(product?._id, variant);
                      const variantsProperties = product.variants?.find(v => v._key === variant);
                      return (
                        <div
                          key={product?._id + variant}
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
                                  className="w-32 md:w-40 h-32 md:h-40 object-cover group-hover:scale-105 overflow-hidden transition-transform duration-500 brightness-90"
                                />
                              </div>
                            )}
                            <div className="h-full flex flex-1 flex-col justify-around py-2">
                              <div className="flex flex-col">
                                <p className="text-[18px] text-black">
                                  {product?.brand}
                                </p>
                                <h2 className="text-[20px] font-semibold text-black line-clamp-1">
                                {product?.title}
                              </h2>
                              </div>
                              <div className="flex flex-col">
                                {variantsProperties?.optionValues?.map((item, index) => (
                                <div key={index} className='text-[#6C6C6C] flex space-x-2'> 
                                    <p>{item.name?.label}</p>
                                    <p>{item.value?.value}</p>
                                </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-3 ">
                            <PriceFormatter
                              amount={(product?.price as number) * itemCount}
                              className="font-bold text-black text-[16px]"
                            />
                            <QuantityButtons product={product} variant={variant} />
                          </div>
                        </div>
                      );
                    })}
                    <Button
                      onClick={handleResetCart}
                      className="mt-3 font-bold text-white bg-fancy-black rounded-[20px] px-6 py-5.5 text-[16px]"
                      variant="destructive"
                    >
                      Wyczyść koszyk
                    </Button>
                  </div>
                </div>

                {/* Product View end */}

                <div className="lg:col-span-1 max-w-[500px]">
                  <div className="flex flex-col w-full p-6">
                    <h2 className="text-[clamp(16px,1.5vw,23px)] text-black font-semibold">
                      Podsumowanie
                    </h2>
                    <div className="text-black bg-[#E1E1E1] rounded-full flex flex-col py-3 px-6 mt-6">
                      <div className="flex justify-between items-center text-black text-[16px] font-medium">
                        <p>Masz kod promocyjny ?</p>
                        <ChevronDown/>
                      </div>
                    </div>
                    <div className="text-black text-[16px] mt-6">
                      <div className="flex justify-between">
                        <span>Wartość produktów</span>
                        <PriceFormatter amount={getSubTotalPrice()} className="font-normal" />
                      </div>
                      <div className="flex justify-between">
                        <span>Dostawa od</span>
                        <PriceFormatter amount={10.49} className="font-normal"/>
                      </div>

                      <Separator />
                      <div className="flex justify-between font-bold text-[16px] my-4">
                        <p>Do zapłaty <span className="font-normal">w tym VAT</span></p>

                        <PriceFormatter
                          amount={useCartStore?.getState().getTotalPrice()}
                          className="text-lg font-bold text-black"
                        />
                      </div>
                      <Button
                        onClick={handleCheckout}
                        disabled={loading}
                        className="w-auto cursor-pointer rounded-full font-bold tracking-wide bg-fancy-black text-white text-[16px] py-6 px-8"
                      >
                        {loading ? "Processing" : "Przejdź do kasy"}
                      </Button>
                      <p className="text-black text-[16px] mt-4 mb-2">Akceptujemy</p>
                      <Image src="/payment.png" width={300} height={30} alt="payment"/>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyCart />
          )}
        </Container>
      ) : (
        <NoAccessToCart />
      )}
    </div>
  );
};

export default CartPage;