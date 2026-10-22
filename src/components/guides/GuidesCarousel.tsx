'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import Container from '@/components/Container'
import { GUIDES_NAV } from '@/constants'
import GuideCard from './GuideCard'
import { getLatestGuidesClient, type GuideCardData } from '@/sanity/helpers/clientRequest'
import { GuideCardSkeleton } from '../ui/Skeleton'
import { HeartIcon } from '../ui/HeartIcon'
import { PawIcon } from '../ui/PawIcon'
import { BulbIcon } from '../ui/BulbIcon'


/**
 * Moduł poradników na stronie głównej (nad sekcją "O nas").
 *
 * Układ celowo powtarza rytm karuzel produktowych (ProductCarusel2): nagłówek
 * po lewej, strzałki po prawej, slider pod spodem — dzięki temu strona główna
 * czyta się jako jedna całość, a nie zlepek modułów o różnych zasadach.
 * Odróżnia go warstwa treściowa: etykieta sekcji, zdanie wprowadzające i link
 * do pełnej listy, bo tu nie sprzedajemy produktu, tylko zapraszamy do czytania.
 *
 * Dane lecą z klienta (jak bannery i karuzele) — strona główna jest komponentem
 * 'use client', więc server-only sanityFetch nie wchodzi w grę. Zapytanie jest
 * cache'owane i deduplikowane w getLatestGuidesClient.
 *
 * Gdy w Sanity nie ma jeszcze żadnego poradnika, moduł nie renderuje się wcale
 * — pusta sekcja z nagłówkiem "Poradniki" i niczym pod spodem wyglądałaby na
 * zepsutą stronę, a nie na sekcję w przygotowaniu.
 */
const GuidesCarousel = ({ className, limit = 2 }: { className?: string; limit?: number }) => {
    const [guides, setGuides] = useState<GuideCardData[]>([])
    const [loading, setLoading] = useState<boolean>(true)

    useEffect(() => {
        let active = true
        setLoading(true)
        getLatestGuidesClient(limit)
            .then((data) => {
                if (!active) return
                setGuides(data)
            })
            .finally(() => {
                if (active) setLoading(false)
            })
        return () => {
            active = false
        }
    }, [limit])

    if (!loading && guides.length === 0) return null

    const list = [
        {
            title : "Sprawdzone informacje",
            icon_path: <HeartIcon className='w-12 h-12 text-[#f5c65b]'/>,
            description : "Porady oparte na doświadczeniu i rzetelnej wiedzy"
        },
        {
            title : "Dla każdego psa",
            icon_path: <PawIcon className='w-12 h-12 text-[#f5c65b]'/>,
            description : "Niezaleznie od wieku, rasy czy charakteru"
        },
        {
            title : "Inspiracje na co dzień",
            icon_path: <BulbIcon className='w-12 h-12 text-[#f5c65b]'/>,
            description : "Pomysły, które ułatwiają życie z pupilem"
        }
    ]

    return (
        <Container className={twMerge('w-full h-auto font-poppins sm:px-14 px-8 sm:py-14 py-8 lg:mt-10 sm:mt-10 mt-4 bg-[#edece5] max-w-full', className)}>
            <div id='guides' className=''>
                <div style={{gridArea: "heading"}} className='flex flex-col max-sm:mb-2'>
                    <h2 className='text-fancy-black text-[clamp(20px,2vw,40px)] font-bold '>Wiedza, która robi różnicę</h2>                    
                    <p className='text-fancy-black text-[clamp(14px,1.5vw,18px)] mt-2 max-3xl:mb-4'>Praktyczne porady, wskazówki i inspiracje dla świadomych opiekunów.</p>
                </div>
                    
                <div style={{gridArea: "description"}} className='mt-10 max-3xl:grid max-3xl:grid-cols-2 max-sm:grid-cols-1 max-md:gap-2'>
                {
                    list.map((i,_)=>(
                        <div key={_} className='flex sm:space-x-5 space-x-3 sm:space-y-7 space-y-6'>
                            <div className='flex justify-center items-center w-14 h-14 p-2 rounded-full bg-[#faebd7]'>{i.icon_path}</div>
                            <div className='flex flex-col text-[clamp(14px,1.5vw,16px)] text-fancy-black'>
                                <h3 className='font-medium'>{i.title}</h3>
                                <p className='font-normal text-[#6C6C6C]'>{i.description}</p>
                            </div>
                        </div>
                    ))
                }
                </div>
                {/* Prowadzi na listę wszystkich poradników (/poradniki). */}
                <Link
                    href={GUIDES_NAV.href}
                    style={{gridArea: "actions"}}
                    className='group flex gap-2 text-white bg-fancy-black rounded-full py-3 w-fit px-10 text-[clamp(14px,1.5vw,16px)] items-center mt-4 transition-colors duration-200 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fancy-black/40 focus-visible:ring-offset-2'
                >
                    <span>Zobacz wszystkie artykuły</span>
                    <ArrowRight aria-hidden className='w-[20px] h-[20px] text-white transition-transform duration-200 group-hover:translate-x-1'/>
                </Link>
                
                <div style={{gridArea: "cards"}} className='flex flex-col w-auto 3xl:space-y-2 space-y-4'>
                   
                    {loading
                        ? // Szkielety 1:1 z GuideCard — tyle samo kart ile limit,
                          // więc po dojściu danych nic się nie przeskoczy.
                          Array.from({ length: limit }).map((_, index) => (
                              <GuideCardSkeleton key={index} />
                          ))
                        : guides.map((guide) => (
                              <GuideCard key={guide._id} guide={guide} />
                          ))}
                </div>
            </div>

            
        </Container>
    )
}

export default GuidesCarousel
