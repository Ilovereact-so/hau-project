'server-only'
import { banerVariants, category } from '@/constants'
import { ChevronLeft, ChevronRight, Search, ShoppingBasket, User } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import AutoResizeInput from './AutoResizeInput'
import ServerUser from './ServerUser'
import ResearchNav from './ResearchNav'


const NavbarContainer = async ({ children, }: Readonly<{children: React.ReactNode}>) => {

    return (
    <div className='w-full h-full relative'>
        <div id="navbar" className='top-7 left-0 w-full absolute h-auto flex justify-between px-10 z-10'>
            <div className='2lg:flex hidden'><Image src="/logo_hau.svg" alt='logo' className='xl:w-[130px] w-[90px] xl:h-[130px] h-[90px]' width={130} height={130}/></div>
            <div className='flex flex-col items-center xl:space-y-6 space-y-4 w-full'>
                <div className='bg-[#A7E4D9]/65 rounded-[39px] inline-flex justify-center items-center space-x-7 xl:px-25 2lg:px-14 2lg:pl-14 2lg:pr-14 pl-6 pr-10 xl:py-5 2lg:py-4 py-2 h-fit'>
                    <div className='2lg:hidden flex'><Image src="/logo_hau.svg" alt='logo' className=' w-[45px] h-[45px] invert' width={45} height={45}/></div>
                
                    {
                        category.map((item,index)=>(
                            <Link key={index} href={item.path} className='text-black text-[clamp(13px,1.2vw,18px)] font-poppins'> {item.name}</Link>
                        ))
                    }
                </div>
                <div className='bg-white rounded-full inline-flex space-x-5 px-3 py-2 w-auto max-2lg:absolute max-2lg:translate-x-[-50%] max-2lg:left-[50%] top-19'>
                    <Search className='text-black xl:w-[24px] w-[20px] xl:h-[24px] h-[20px]'/>
                    {/**<input placeholder='Obroża taktyczna..' className='focus:outline-none font-poppins text-[16px] placeholder:text-[16px] text-black placeholder:text-[#4E4E4E]'/> */}
                    <ResearchNav/>
                </div>
            </div>
            <ServerUser/>
            
        </div>
        {
            children
        }

    </div>
  )
}

export default NavbarContainer