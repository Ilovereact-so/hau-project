"use client"
import { Heart, ShoppingBag } from 'lucide-react'
import React from 'react'
import Container from './Container'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import Image from 'next/image'
import { HELP_DOCUMENTS } from '@/constants'
import { openConsentSettings } from '@/lib/consent'
import { useAuthModalStore } from '@/store/authModalStore'

const Footer = ({className}:{className?:string}) => {
    const { user } = useUser()
    const openModal = useAuthModalStore(s => s.openModal)
    // if (!isLoaded) return <Loading />
    // if (!user) return <Loading />

    return (
        <div className='w-full bg-fancy-black font-poppins'>
            <Container id='footer' className={cn("sm:px-10 px-7 py-8 w-full",className)}>
            <div style={{gridArea:"short-info"}} className='space-y-2 flex flex-col max-1md:flex-row max-sm:flex-col 1md:space-x-0 space-x-8 max-sm:mb-5'>
                <Link href="/#latest-offers" className='text-main font-medium text-[clamp(14px,1.6vw,18px)] hover:opacity-70 transition-opacity'>Sprawdz najnowsze oferty</Link>
                <Link href="/#newsletterContainer" className='text-white font-medium text-[clamp(14px,1.6vw,18px)] hover:opacity-70 transition-opacity'>Przejdź do newslettera</Link>
            </div>
            <div style={{gridArea:"security-nav"}} className='flex sm:flex-row flex-col-reverse justify-end 1md:my-0 my-6'>
                <div className='bg-[#2C2C2C] rounded-[40px] sm:rounded-br-[0px] flex flex-col items-center 1md:w-auto w-full'>
                    <Link href="/help" className='text-white text-[clamp(14px,1.6vw,18px)] font-medium py-3 hover:text-main transition-colors'>Centrum pomocy</Link>
                    {/* Lista pochodzi z HELP_DOCUMENTS (constants) — treść tych dokumentów
                        siedzi w Sanity (typ helpDocument), ale sama nawigacja jest stałą,
                        bo Footer to komponent kliencki i nie może odpytać sanityFetch
                        (server-only). Podział na `column` odwzorowuje dotychczasowy
                        dwukolumnowy układ. */}
                    <div className='flex bg-black rounded-[40px] sm:rounded-br-[0px] text-white md:text-[clamp(15px,1.5vw,17px)] text-[clamp(14px,2vw,18px)] px-8 py-6 pb-8 space-x-8 1md:w-auto w-full 1md:justify-start justify-around'>
                        {([1, 2] as const).map((column) => (
                            <div key={column} className='flex flex-col space-y-4'>
                                {HELP_DOCUMENTS.filter(doc => doc.column === column).map(doc => (
                                    <Link
                                        key={doc.slug}
                                        href={`/help/${doc.slug}`}
                                        className='hover:text-main transition-colors w-fit'
                                    >
                                        {doc.title}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </div> 
                <div className='flex sm:flex-col flex-row-reverse justify-between max-sm:my-10 max-sm:bg-[#2C2C2C] max-sm:px-4 max-sm:rounded-[40px]'>
                    <div className='flex sm:item-start items-center justify-end'>
                        <div className='sm:bg-[#2C2C2C] bg-black rounded-full h-fit p-3 px-4 space-x-4 flex'>
                            <Link href="/card"><ShoppingBag className='text-white'/></Link>
                            <Link href="/profile/wishlist"><Heart className='text-white'/></Link>
                        </div>
                    </div>
                    <div className='sm:bg-[#2C2C2C] bg-transparent sm:rounded-r-[40px] flex flex-col items-center sm:pr-6 relative'>
                        <div className='absolute sm:block hidden top-0 left-0 translate-y-[-100%] w-[40px] h-[40px] overflow-hidden'>
                            <div id='shadow-bl-footer2' className='w-[40px] h-[40px] rounded-bl-[40px]'></div>
                        </div>
                        <h1 className='text-white text-[clamp(14px,1.6vw,18px)] font-medium sm:py-3 max-sm:absolute max-sm:-top-2 left-0 max-sm:translate-y-[-100%] text-nowrap'>Moje konto</h1>
                        <div className='sm:bg-black bg-transparent sm:rounded-r-[40px] max-sm:rounded-l-[40px] sm:pr-5 sm:py-5 py-3 relative'>
                            <div className='absolute sm:block hidden top-0 left-0 translate-y-[-100%] w-[40px] h-[40px] overflow-hidden'>
                                <div id='shadow-bl-footer' className='w-[40px] h-[40px] rounded-bl-[40px]'></div>
                            </div>
                            { user ? 
                            <div className='flex justify-end items-center sm:w-[120px] h-[40px]'>
                                <Link href="/profile"><Image src={user?.imageUrl} width={40} height={40} alt="Zdjęcie profilowe" className='rounded-full w-12 h-12 cursor-pointer' /></Link>
                            </div>
                            :
                            <div onClick={() => openModal('signIn')} className='bg-white px-9 py-2 sm:text-[clamp(14px,1.6vw,18px)] text-[16px] font-bold text-black rounded-[15px]'>Zaloguj</div>
                            }
                        </div>
                    </div>
                </div>
            </div>
            <div style={{gridArea:"brand-label"}} className='flex flex-col max-sm:mt-4 text-white '>
                <h1 className='text-[clamp(20px,1.9vw,32px)] font-bold'>HAU sklep</h1>
                <h1 className='sm:text-[clamp(14px,1.6vw,18px)] font-normal text-[14px] mr-5'>© {new Date().getFullYear()} Hau sklep. Wszystkie prawa zastrzeżone.</h1>
                {/* Wymóg RODO: zgodę na cookies trzeba dać się wycofać równie łatwo,
                    jak się ją wyraziło — stąd stały link w stopce. */}
                <button
                    type='button'
                    onClick={openConsentSettings}
                    className='mt-2 w-fit text-[14px] text-white/80 hover:text-main cursor-pointer'
                >
                    Ustawienia cookies
                </button>
            </div>
            </Container>
        </div>
    )
}

export default Footer