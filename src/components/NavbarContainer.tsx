'server-only'
import Image from 'next/image'
import React from 'react'
import ServerUser from './ServerUser'
import NavRMenu from './NavRMenu'
import Link from 'next/link'
import { getCategories } from '@/hooks/categories'
import Container from './Container'
import { headers } from 'next/headers'

// UWAGA: `export const revalidate` tu nie działa — route segment config jest
// honorowany wyłącznie w page.tsx / layout.tsx / route.ts, nie w komponencie.
// Cache kategorii z navbaru jest zrealizowany bezpośrednio w getCategories()
// (src/hooks/categories.ts) przez next: { revalidate: 600 }.

const NavbarContainer = async ({ children, mode }: Readonly<{children?: React.ReactNode, mode: number}>) => {
    const categories = await getCategories()
    // Podpowiedź z middleware (na podstawie User-Agent) — dzięki niej pierwszy
    // render trafia w mobile/desktop od razu, bez wizualnego przeskoku po
    // hydracji (patrz useMediaQuery.ts).
    const initialMobile = (await headers()).get('x-is-mobile') === '1'
    return (
    
        <div className={`w-full h-full relative ${
            mode === 0 ? "h-full" : "h-auto"
        }`}>
            
            <Container id={mode === 0? "navbar":"navbar2"} className={`w-full h-auto z-10 ${
                mode === 0 ? "absolute lg:pt-4 pt-0 sm:px-9 px-5 4xl:left-[50%] 4xl:translate-x-[-50%]" : "left-0 md:px-10 px-5 " //border-b-1 border-[#838383]
            }`}>
                <div style={{gridArea:"logo"}} className={`navbar-logo relative z-10 ${
                    mode === 1 ? "sm:w-auto w-full flex justify-start max-md:mt-2 max-sm:items-end ":"w-full 2xl:flex max-sm:flex hidden max-3xl:justify-center max-sm:items-end justify-start max-sm:mt-4"
                }`}><Link href={"/"} className="cursor-pointer"><Image src={mode === 0 ? "/logo_hau_white.svg" : "/logo_hau.svg"} alt='logo' className={` ${
                    mode === 1 ? " xl:w-[60px] lg:w-[70px] sm:w-[75px] w-[46px] min-w-[46px] xl:h-[60px] lg:h-[70px] md:h-[75px] h-[46px] xl:mt-2":" 3xl:ml-13 m-3 max-lg:m-0 invert xl:w-[100px] lg:w-[90px] sm:w-[75px] w-[46px] xl:h-[100px] lg:h-[90px] sm:h-[75px] h-[46px]"
                }`} width={130} height={130}/></Link></div>
                
                <NavRMenu style={{gridArea:"nav"}} mode={mode} categories={categories} initialMobile={initialMobile} className={`flex  items-center xl:space-y-6 space-y-0 lg:space-x-0 w-full ${
                    // Na mobile mode 1 ma wyglądać jak mode 0 (patrz NavRMenu.tsx / themeMode) — ale
                    // to server component bez dostępu do JS-owego mobile-detection, więc mobilowy
                    // override robimy czysto przez CSS: max-sm:flex-col (bazowe flex-row jest tylko
                    // dla desktopu tego wariantu) i bez granicy górnej, której mode 0 nie ma.
                    mode === 1 ? "max-w-fit 1xl:max-w-[calc(100%-240px)] sm:max-w-[calc(100%-130px)] sm:flex-col flex-row max-sm:flex-col":"max-w-[calc(100%-292px)] max-2xl:max-w-[calc(100%-120px)] max-lg:max-w-[calc(100%-120px)] max-sm:max-w-fit flex-col"
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