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

        <div id={mode === 0? "navbar":"navbar2"} className={`w-full h-auto sm:px-10 z-10  ${
            mode === 0 ? "absolute lg:pt-4 pt-0" : "left-0 "
        }`}>
            <Link  href={"/"} style={{gridArea:"logo"}} className={`lg:flex cursor-pointer justify-center relative z-10  contrast-70 brightness-80 ${
                mode === 1 ? "w-auto flex":"w-full max-sm:flex hidden "
            }`}><Image src="/logo_hau.svg" alt='logo' className='xl:w-[100px] lg:w-[90px] w-[75px] xl:h-[100px] lg:h-[90px] h-[75px]' width={130} height={130}/></Link>
            <NavRMenu style={{gridArea:"nav"}} mode={mode} className='flex flex-col items-center xl:space-y-6 space-y-0 lg:space-x-0 w-full sm:max-w-[calc(100%-100px)]'/>
            <ServerUser style={{gridArea:"actions", width: mode === 0 ? "100%": "auto" }} mode={mode}/>            
        </div>

        {
            mode === 0 ? children : null
        }

    </div>
  )
}


export default NavbarContainer