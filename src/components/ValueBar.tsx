import { Bone, CreditCard, LucideProps, PawPrint, Truck } from 'lucide-react'
import React from 'react'

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
    <div className='bg-main lg:px-15 px-12 py-12 flex justify-center items-center font-poppins lg:space-x-[8%] space-x-[6%] mt-14'>
        {
            Items.map((item,index)=>(
                <div key={index} className='flex space-x-6'>
                    <item.icon className='text-[#3CBCA5] lg:w-[40px] w-[32px] lg:h-[40px] h-[32px]'/>
                    <p className='text-black text-[clamp(13px,1.3vw,16px)]' dangerouslySetInnerHTML={{ __html: item.title }}></p>
                </div>
            ))
        }
    </div>
  )
}

export default ValueBar