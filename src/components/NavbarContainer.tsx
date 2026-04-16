'server-only'
import Image from 'next/image'
import React from 'react'
import ServerUser from './ServerUser'
import NavRMenu from './NavRMenu'
import Link from 'next/link'
import { getCategories } from '@/hooks/categories'
import Container from './Container'

export const revalidate = 60*10; // disable caching, always fetch fresh data

const NavbarContainer = async ({ children, mode }: Readonly<{children?: React.ReactNode, mode: number}>) => {
    const categories = await getCategories()
    return (
    
        <div className={`w-full h-full relative ${
            mode === 0 ? "h-full" : "h-auto"
        }`}>
            
            <Container id={mode === 0? "navbar":"navbar2"} className={`w-full h-auto z-10 ${
                mode === 0 ? "absolute lg:pt-4 pt-0 sm:px-9 4xl:left-[50%] 4xl:translate-x-[-50%]" : "left-0 md:px-10 border-b-1 border-[#838383]"
            }`}>
                <div style={{gridArea:"logo"}} className={`navbar-logo relative z-10 ${
                    mode === 1 ? "w-auto flex justify-start max-md:ml-6 ":"w-full 2xl:flex max-sm:flex hidden max-3xl:justify-center max-sm:items-end justify-start max-sm:mt-4"
                }`}><Link href={"/"} className="cursor-pointer"><Image src={mode === 0 ? "/logo_hau_white.svg" : "/logo_hau.svg"} alt='logo' className={` ${
                    mode === 1 ? " xl:w-[100px] lg:w-[90px]  sm:w-[75px] w-[50px] xl:h-[100px] lg:h-[90px] md:h-[75px] h-[50px]":" 3xl:ml-13 m-3 max-lg:m-0 invert xl:w-[100px] lg:w-[90px]  sm:w-[75px] w-[46px] xl:h-[100px] lg:h-[90px] sm:h-[75px] h-[46px]"
                }`} width={130} height={130}/></Link></div>
                
                <NavRMenu style={{gridArea:"nav"}} mode={mode} categories={categories} className={`flex  items-center xl:space-y-6 space-y-0 lg:space-x-0 w-full ${
                    mode === 1 ? "sm:max-w-fit 1xl:max-w-[calc(100%-240px)] md:max-w-[calc(100%-130px)] sm:flex-col flex-row max-sm:border-t-1 max-sm:border-[#838383]":"max-w-[calc(100%-120px)] max-lg:max-w-[calc(100%-100px)] max-sm:max-w-fit flex-col"
                }`}/>
                <ServerUser style={{gridArea:"actions", width: mode === 0 ? "100%": "auto" }} mode={mode}/>            
            </Container>
            
            {
                mode === 0 ? children : null
            }

        </div>

  )
}


export default NavbarContainer