"use client";
import Container from '@/components/Container';
import Loading from '@/components/Loading';
import PriceFormatter from '@/components/PriceFormatter';
import { urlFor } from '@/sanity/lib/image';
import { Edit, Heart } from 'lucide-react';
import Image from 'next/image';
import React, { useEffect, useState } from 'react'
import useCartStore, { useWishListStore } from 'store'

const page = () => {
    const {addItem} = useWishListStore()
     const addCardItem = useCartStore().addItem;
     const groupedItems = useWishListStore((state) => state.getGroupedItems());
    const [isClient, setIsClient] = useState(false);
      
      useEffect(() => {
        setIsClient(true);
      }, []);

    //   if (!isClient) {
    //     return <Loading />;
    //   }
  return (
    <div className=''>
        <Container className="px-15 my-14 font-poppins flex flex-col">
            <h1 className='text-[20px] text-black font-medium mb-5'>Ububione</h1>
            {groupedItems &&
            <div className='mt-4 grid 2.5xl:grid-cols-4 grid-cols-3 gap-x-[18px] gap-y-[75px]'>
                {groupedItems?.map(({ product, variant }) => {
                    const variantsProperties = product.variants?.find(v => v._key === variant);
                    return (
                    <div key={product._id + variant} className='flex flex-col w-full relative'>
                        {product?.images&&
                            <Image
                                src={urlFor(product.images[0]).url()}
                                alt="Product Image"
                                className="min-w-[290px] w-[clamp(290px,100%,500px)] h-auto min-h-[290px] brightness-90"
                                width={290}
                                height={290}
                            />
                        }
                        <div className='text-black mt-4'>
                            <p className='text-[16px]'>{product.brand}</p>
                            <h1 className='text-[18px] font-semibold line-clamp-2'>{product.title}</h1>
                        </div>
                        <div className='flex justify-between mt-2 w-full'>
                            <div className='text-[#6C6C6C] text-[16px]'>
                                <p className='mb-2'>{product.type?.title}</p>
                                {variantsProperties?.optionValues?.map((item, index) => (
                                    <div key={index} className=' flex space-x-1'> 
                                        <p>{item.name?.label}</p>
                                        <p>{item.value?.value}</p>
                                    </div>
                                ))}
                            </div>
                            <div className='flex flex-col justify-between items-end'>
                                <PriceFormatter
                                    amount={(product?.price as number)}
                                    className=" text-black text-[15px] font-normal"
                                />
                                <Edit className='text-black w-[20px] h-[20px]'/>
                            </div>
                        </div>
                        <div onClick={()=>addCardItem(product,variant)} className='w-full border-1 border-black flex justify-center items-center text-black text-[16px] rounded-full py-3 mt-6 font-medium cursor-pointer'>
                            Dodaj do koszyka
                        </div>
                        <div onClick={()=>addItem(product,variant)} className='absolute top-4 left-4 cursor-pointer'>
                            <Image src="/heart.svg" width={22} height={22} alt='Heart icon'/>
                        </div>
                    </div>
                    )
                })}
            </div>
            }
        </Container>
    </div>
  )
}

export default page