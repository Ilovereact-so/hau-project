import { Heart, ShoppingBag } from 'lucide-react'
import React from 'react'
import Container from './Container'

const Footer = () => {
  return (
    <div className='w-full bg-fancy-black '>
        <Container id='footer' className='sm:px-10 px-7 py-8 w-full'>
        <div style={{gridArea:"short-info"}} className='space-y-2 flex flex-col max-1md:flex-row max-sm:flex-col 1md:space-x-0 space-x-8 max-sm:mb-5'>
            <h1 className='text-main font-medium text-[clamp(16px,1.3vw,20px)]'>Sprawdz najnowsze oferty</h1>
            <h1 className='text-white font-medium text-[clamp(16px,1.3vw,20px)]'>Przejdź do newslettera</h1>
        </div>
        <div style={{gridArea:"security-nav"}} className='flex sm:flex-row flex-col-reverse justify-end 1md:my-0 my-6'>
            <div className='bg-[#2C2C2C] rounded-[40px] sm:rounded-br-[0px] flex flex-col items-center 1md:w-auto w-full'>
                <h1 className='text-white text-[clamp(16px,1.3vw,20px)] font-medium py-3'>Centrum pomocy</h1>
                <div className='flex bg-black rounded-[40px] sm:rounded-br-[0px] text-white text-[clamp(14px,1.2vw,20px)] px-8 py-6 pb-8 space-x-8 1md:w-auto w-full 1md:justify-start justify-around'>
                    <div className='flex flex-col space-y-4'>
                        <p>Regulamin</p>
                        <p>Polityka prywatności</p>
                        <p>Zwroty i reklamacje</p>
                    </div>
                    <div className='flex flex-col space-y-4'>
                        <p>Dostawa</p>
                        <p>Formy płatności</p>
                    </div>
                </div>
            </div> 
            <div className='flex sm:flex-col flex-row-reverse justify-between max-sm:my-10 max-sm:bg-[#2C2C2C] max-sm:px-4 max-sm:rounded-[40px]'>
                <div className='flex sm:item-start items-center justify-end'>
                    <div className='sm:bg-[#2C2C2C] bg-black rounded-full h-fit p-3 px-4 space-x-4 flex'>
                        <ShoppingBag className='text-white'/>
                        <Heart className='text-white'/>
                    </div>
                </div>
                <div className='sm:bg-[#2C2C2C] bg-transparent sm:rounded-r-[40px] flex flex-col items-center sm:pr-6 relative'>
                    <div className='absolute sm:block hidden top-0 left-0 translate-y-[-100%] w-[40px] h-[40px] overflow-hidden'>
                        <div id='shadow-bl-footer2' className='w-[40px] h-[40px] rounded-bl-[40px]'></div>
                    </div>
                    <h1 className='text-white text-[clamp(16px,1.3vw,20px)] font-medium sm:py-3 max-sm:absolute max-sm:-top-2 left-0 max-sm:translate-y-[-100%]'>Moje konto</h1>
                    <div className='sm:bg-black bg-transparent sm:rounded-r-[40px] max-sm:rounded-l-[40px] sm:pr-5 sm:py-5 py-3 relative'>
                        <div className='absolute sm:block hidden top-0 left-0 translate-y-[-100%] w-[40px] h-[40px] overflow-hidden'>
                            <div id='shadow-bl-footer' className='w-[40px] h-[40px] rounded-bl-[40px]'></div>
                        </div>
                        <div className='bg-white px-9 py-2 sm:text-[clamp(18px,1.4vw,20px)] text-[16px] font-bold text-black rounded-[15px]'>Zaloguj</div>
                    </div>
                </div>
            </div>
        </div>
        <div style={{gridArea:"brand-label"}} className='flex flex-col max-sm:mt-4'>
            <h1 className='text-[clamp(20px,1.9vw,32px)] font-bold'>HAU sklep</h1>
            <h1 className='text-white sm:text-[clamp(16px,1.3vw,20px)] text-[14px] mr-5'>© 2025 Hau sklep. Wszystkie prawa zastrzeżone.</h1>
        </div>
        </Container>
    </div>
  )
}

export default Footer