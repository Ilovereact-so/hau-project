import { Bone, CreditCard, LucideProps, PawPrint, Truck } from 'lucide-react'
import React from 'react'
import {motion} from "framer-motion"
import { ProductCarousel } from '@/hooks/ProductCarousel'

const ValueBar = () => {
    type Elements = {
        title : string;
        icon : React.ComponentType<{ className?: string }>
    }
    const Items:Elements[] = [
        {
            title: "Ekspresowa <br/> dostawa 24h",
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
    <motion.div initial={{x:0}} animate={{x:[0, ]}} className='bg-main lg:px-15 1md:px-8 px-4 py-12 flex lg:justify-center items-center font-poppins lg:space-x-[8%] justify-evenly mt-14 w-full'>
        <ProductCarousel duration={25}>
        {
            Items.map((item,index)=>(
                <div key={index} className='flex justify-center 1md:space-x-6 space-x-3 min-w-[150px]'>
                    <item.icon className='text-[#3CBCA5] lg:w-[40px] w-[32px] lg:h-[40px] h-[32px]'/>
                    <p className='text-black 1md:text-[clamp(13px,1.3vw,16px)] text-[clamp(10px,1.5vw,13px)] inline h-min w-fit' dangerouslySetInnerHTML={{ __html: item.title }}></p>
                </div>
            ))
        }
        </ProductCarousel>
    </motion.div>
  )
}

export default ValueBar