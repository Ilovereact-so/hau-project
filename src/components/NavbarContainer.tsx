'server-only'
import Image from 'next/image'
import React from 'react'
import ServerUser from './ServerUser'
import NavRMenu from './NavRMenu'
import Link from 'next/link'
import {motion} from 'framer-motion'
import SearchBarContext from './SearchBarContext'
import NavHamburger from './NavHamburger'



const NavbarContainer = async ({ children, mode }: Readonly<{children?: React.ReactNode, mode: number}>) => {
    
    return (
    <div className={`w-full h-full relative ${
        mode === 0 ? "h-full" : "h-auto"
    }`}>

        <div id={mode === 0? "navbar":"navbar2"} className={`w-full h-auto z-10  ${
            mode === 0 ? "absolute lg:pt-4 pt-0 sm:px-10" : "left-0 md:px-10"
        }`}>
            <Link  href={"/"} style={{gridArea:"logo"}} className={`lg:flex cursor-pointer relative z-10  contrast-70 brightness-80 ${
                mode === 1 ? "w-auto flex justify-start max-md:ml-6":"w-full max-sm:flex hidden justify-center"
            }`}><Image src="/logo_hau.svg" alt='logo' className='xl:w-[100px] lg:w-[90px] w-[75px] xl:h-[100px] lg:h-[90px] h-[75px]' width={130} height={130}/></Link>
            <NavRMenu style={{gridArea:"nav"}} mode={mode} className={`flex  items-center xl:space-y-6 space-y-0 lg:space-x-0 w-full ${
                mode === 1 ? "sm:max-w-fit md:max-w-[calc(100%-100px)] sm:flex-col flex-row max-sm:border-t-1 max-sm:border-[#838383]":"sm:max-w-[calc(100%-100px)] msx-w-fit flex-col"
            }`}/>
            <ServerUser style={{gridArea:"actions", width: mode === 0 ? "100%": "auto" }} mode={mode}/>            
        </div>

        {
            mode === 0 ? children : null
        }

    </div>
  )
}


export default NavbarContainer