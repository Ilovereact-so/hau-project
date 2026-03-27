"use client"
import useOnItemAdded from '@/hooks/useLatestCartItem'
import { urlFor } from '@/sanity/lib/image'
import { on } from 'events'
import { Check, ShoppingBagIcon } from 'lucide-react'
import Image from 'next/image'
import React, { useEffect, useState } from 'react'
import useCartStore from 'store'
import { AnimatePresence, motion } from 'framer-motion'

type Props = {
    mode: number
}
const CartIcon = ({mode}:Props) => {
    const {getGroupedItems, getLatestItem} = useCartStore()
    const itemCount = getGroupedItems()
    const latestItem = getLatestItem()
    const [isValid, setValid] = useState(false)
    
    
    const setOnItemAdded = useCartStore((state) => state.setOnItemAdded);

    useEffect(() => {
        setOnItemAdded((item) => {
            setValid(true);
            setTimeout(() => setValid(false), 3000);
        });

        return () => setOnItemAdded(null);
    }, []);
    // useEffect(() => {
    //     setValid(true)
    //     const timer = setTimeout(() => {
    //         setValid(false)
    //     }, 3000);
    //     return () => clearTimeout(timer);
    // },[onItemAdded])


    const variantsProperties = latestItem?.product.variants?.find(v => v._key === latestItem.variant)

    return (
    <div className={`px-1.5 py-2 relative ease-in-out duration-300 ${
        isValid ? "bg-[#2C2C2C] rounded-t-full":""
    }`}>
        <ShoppingBagIcon className={`lg:min-w-[27px] min-w-[25px] lg:h-[27px] h-[25px] stroke-[1.4px] ${
            mode === 1 ? "text-black":"text-white"
          } ${
            isValid ? "text-white":""
          }`}/>
        <AnimatePresence>
            {isValid && 
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{opacity:0}} transition={{duration:0.3, ease:"easeInOut"}} className='absolute top-[100%] left-0 bg-[#2C2C2C] w-full h-[10px]'>
                <div className='absolute w-full h-[20px] left-[-100%] top-[-10px] overflow-hidden'>
                    <div className='absolute top-0 right-0 w-full h-full sh-rounded-product-card rounded-br-[30px]'></div>
                </div>
                <div className='absolute top-[100%] py-3 px-4 space-y-2 right-0 bg-[#2C2C2C] rounded-tl-[30px] rounded-b-[30px] w-auto min-w-[100px] h-auto min-h-[100px] flex flex-col'>
                    <div className='flex p-1'>
                        <Check className='text-white w-[20px] h-[20px]'/>
                        <h1 className='text-white ml-2 text-[clamp(12px,1.3vw,16px)] text-nowrap'>Pomyślnie dodano do koszyka</h1>
                    </div>
                    <div className='flex space-x-3 w-full'>
                        <div className='w-auto'> 
                            {latestItem?.product.images && 
                                <Image src={urlFor(latestItem.product.images[0]).url()} alt="Product Image" className='min-w-[117px] h-[117px]'  width={117} height={117} />
                            }
                        </div>
                        <div className='text-[clamp(12px,1.3vw,16px)] w-auto min-w-[170px]'>
                            <p className='line-clamp-1'>{latestItem?.product.title}</p>
                            {variantsProperties?.optionValues?.map((item, index) => (
                                <div key={index} className='text-[#ABABAB] flex space-x-2'> 
                                    <p>{item.name?.label}</p>
                                    <p>{item.value?.value}</p>
                                </div>
                            ))}
                            <p className='line-clamp-1 text-[clamp(12px,1.3vw,16px)]'>Ilość: {latestItem?.quantity}</p>
                            <p className='line-clamp-1 text-[clamp(12px,1.3vw,16px)]'>{latestItem?.product.price?.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })} {Number(latestItem?.quantity) > 1 && `x ${latestItem?.quantity} = `}{(Number(latestItem?.quantity) * Number(latestItem?.product.price)).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' })}</p>
                        </div>
                    </div>
                    <div className=' bg-fancy-black w-full py-2 flex justify-center rounded-[20px] text-white font-bold text-[clamp(12px,1.3vw,16px)] mt-1'>
                        Przejdź do koszyka
                    </div>
                </div>
            </motion.div>
            }
        </AnimatePresence>
    </div>
  )
}

export default CartIcon