'use client'
import { Bone, CreditCard, PawPrint, RotateCcw, Truck } from 'lucide-react'
import { RETURN_WINDOW_DAYS } from '@/lib/site'
import React from 'react'
import {motion} from "framer-motion"
import { ProductCarousel } from '@/hooks/ProductCarousel'

const ValueBar = () => {
    type Elements = {
        title : string;
        icon : React.ComponentType<{ className?: string }>
    }
    const Items:Elements[] = [
        // {
        //     title: `${RETURN_WINDOW_DAYS} dni <br/> na zwrot`,
        //     icon: RotateCcw
        // },
        {
            title: "Ekspresowa <br/> wysyłka 24h",
            icon: Truck
        },
        
        {
            title: "Bezpieczne i trwałe <br/> produkty",
            icon: Bone
        },
        {
            title: "Proste i szybkie <br/> zakupy online",
            icon: CreditCard
        },
        {
            title: "Z miłości <br/> do psów",
            icon: PawPrint
        },
    ]
    return (
    <motion.div initial={{x:0}} animate={{x:[0, ]}} className='bg-main lg:px-15 1md:px-8 px-4 py-12 flex lg:justify-center items-center font-poppins lg:space-x-[8%] justify-evenly mt-2 w-full'>
        <ProductCarousel duration={12}>
        {
            Items.map((item,index)=>(
                <div key={index} className='flex justify-center 1md:space-x-6 space-x-3 lg:min-w-[200px] min-w-[200px]'>
                    <div className='p-3 rounded-full bg-[#94cdc3]'>
                        <item.icon className='text-black lg:w-[30px] w-[22px] lg:h-[30px] h-[22px]'/>
                    </div>
                    <p className='text-black text-[clamp(13px,1.3vw,16px)]  inline h-min w-fit' dangerouslySetInnerHTML={{ __html: item.title }}></p>
                </div>
            ))
        }
        </ProductCarousel>
    </motion.div>
  )
}

export default ValueBar
