'server-only'
import Image from 'next/image'
import React from 'react'
import ServerUser from './ServerUser'
import NavRMenu from './NavRMenu'
import { Search } from 'lucide-react'
import ResearchNav from './ResearchNav'


const NavbarContainer = async ({ children, }: Readonly<{children: React.ReactNode}>) => {
    
    return (
    <div className='w-full h-full relative'>
        <div id="navbar" className='left-0 w-full absolute h-auto sm:px-10 z-10 lg:pt-4 pt-0'>
            <div style={{gridArea:"logo"}} className='lg:flex max-sm:flex hidden justify-center relative z-10 w-full contrast-70 brightness-80'><Image src="/logo_hau.svg" alt='logo' className='xl:w-[100px] lg:w-[90px] w-[75px] xl:h-[100px] lg:h-[90px] h-[75px]' width={130} height={130}/></div>
            <NavRMenu style={{gridArea:"nav"}} className='flex flex-col items-center xl:space-y-6 space-y-0 lg:space-x-0 w-full sm:max-w-[calc(100%-100px)]'/>
            <ServerUser style={{gridArea:"actions"}}/>            
        </div>
        {
            children
        }

    </div>
  )
}

export default NavbarContainer