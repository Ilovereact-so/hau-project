import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import React from 'react'

const AboutAs = () => {
  return (
    <div className='w-full h-auto min-h-[500px] mt-10 '>
        
        <div className='relative w-full flex justify-center pt-12'>
            <Image src="/about-as.png" alt="About Us" className='w-[clamp(300px,20vw,450px)] relative z-[2]' width={450} height={315}/>
            <h1 className='absolute bottom-1/2 left-1/2 transform -translate-x-1/2 translate-y-1/2 text-fancy-black font-bold text-[clamp(50px,8vw,180px)] w-full text-center z-[3]'>Hau sklep</h1>
            <div className='absolute bg-main rounded-t-[100%] h-full w-full bottom-0 left-0 z-[1]'></div>
        </div>
        <div className='bg-main pb-10 w-full h-auto'>
            <div className='border-1 border-black sm:mx-12 mx-7 p-10 rounded-[80px] '>
                <div className='space-y-6'>
                    <p className='text-black text-[clamp(14px,1.5vw,20px)] italic'>
                        <span className='font-bold'>HAU sklep powstał z bezgranicznej miłości do psów!</span> Sami mamy psiaki i szukając smaczków, zabawek czy innych akcesoriów dla naszych pupili byliśmy czasem przerażeni, jak wiele złych i szkodliwych produktów dla zwierząt znajduje się na rynku oraz jak wiele fałszywych informacji i mitów jest wciąż powielanych. Postanowiliśmy więc coś z tym zrobić!
                    </p>
                    <p className='text-black text-[clamp(14px,1.5vw,20px)] italic'>
                        <span className='font-bold'>Skupiamy się na sprawdzonych markach i świetnej jakości.</span> Wspieramy polskich przedsiębiorców, a szczególnie rękodzielników i firmy z pasją. Odwiedzając więc nasz sklep nie musisz mieć ogromnej wiedzy i zastanawiać się, który produkt kupić, analizując skrupulatnie składy czy metki, <span className='font-bold'>bo nie mamy po prostu złych towarów!</span> {/** Chcemy, abyś Ty i Twój pies byliście zadowoleni z zakupów i wracali do nas po więcej!*/}
                    </p>
                </div>
                <div className='w-full flex justify-end mt-3'>
                    <div className='inline-flex h-fit mr-3 justify-center items-start space-x-2 3xs:px56 px-4 lg:py-3 py-2 bg-black rounded-[15px] '>
                        <p className='text-white text-[clamp(14px,1.3vw,20px)] font-bold'>Czytaj Dalej</p>
                        <ArrowRight className='text-white lg:w-[24px] w-[20px] lg:h-[24px] h-[20px]'/>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}

export default AboutAs