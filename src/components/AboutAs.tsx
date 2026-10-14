import Image from 'next/image'
import React from 'react'
import Container from './Container'

const AboutAs = () => {
  return (
    <div className='w-full h-auto min-h-[500px] pt-10 bg-[#edece5] '>
        
        <div className='relative w-full flex justify-center pt-12'>
            <Image src="/about-as.png" alt="About Us" className='w-[clamp(300px,20vw,450px)] relative z-[2]' width={450} height={315}/>
            <p className='absolute bottom-1/2 left-1/2 transform -translate-x-1/2 translate-y-1/2 text-fancy-black font-bold font-poppins text-[clamp(50px,8vw,180px)] w-full text-center z-[3]'>Hau sklep</p>
            <div className='absolute bg-main rounded-t-[100%] h-full w-full bottom-0 left-0 z-[1] footer_shadow'></div>
           
        </div>
        <div className='bg-main pb-10 w-full h-auto'>
            <Container>
                <div className='border-1 border-black border-dashed font-poppins sm:mx-12 mx-7 p-10 rounded-[80px] '>
                    <div className='space-y-6'>
                        <p className='text-black text-[clamp(14px,1.5vw,20px)]'>
                            <span className='text-[#6eb0a6]'>HAU sklep powstał z bezgranicznej miłości do psów!</span> Sami mamy psiaki i szukając smaczków, zabawek czy innych akcesoriów dla naszych pupili byliśmy czasem przerażeni, jak wiele złych i szkodliwych produktów dla zwierząt znajduje się na rynku oraz jak wiele fałszywych informacji i mitów jest wciąż powielanych. Postanowiliśmy więc coś z tym zrobić!
                        </p>
                        <p className='text-black text-[clamp(14px,1.5vw,20px)]'>
                            <span className='text-[#6eb0a6]'>Skupiamy się na sprawdzonych markach i świetnej jakości.</span> Wspieramy polskich przedsiębiorców, a szczególnie rękodzielników i firmy z pasją. Odwiedzając więc nasz sklep nie musisz mieć ogromnej wiedzy i zastanawiać się, który produkt kupić, analizując skrupulatnie składy czy metki, <span className='text-[#6eb0a6]'>bo nie mamy po prostu złych towarów!</span> {/** Chcemy, abyś Ty i Twój pies byliście zadowoleni z zakupów i wracali do nas po więcej!*/}
                        </p>
                    </div>
                    
                </div>
            </Container>
        </div>
    </div>
  )
}

export default AboutAs