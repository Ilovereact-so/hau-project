import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Bookmark, Clock } from 'lucide-react'
import { urlFor } from '@/sanity/lib/image'

export type GuideCardItem = {
    _id: string
    title: string
    slug: string
    excerpt: string
    coverImage?: any
    category?: { _id: string; title: string; slug: string } | null
    publishedAt?: string
    readingTime?: number
    hasVideo?: boolean
}

export const formatGuideDate = (value?: string) => {
    if (!value) return null
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return new Intl.DateTimeFormat('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(date)
}

/**
 * Kafelek poradnika — jedyny wygląd wpisu na liście, w module na stronie
 * głównej i w sekcji "zobacz też". Jeden komponent, żeby te trzy miejsca nie
 * zaczęły się rozjeżdżać przy pierwszej korekcie.
 *
 * `variant="featured"` to ten sam kafelek w układzie poziomym (obraz obok
 * tekstu) — używany dla wyróżnionego poradnika na górze /poradniki.
 */
const GuideCard = ({
    guide,
    variant: _variant = 'default',
    className,
    priority = false,
}: {
    guide: GuideCardItem
    variant?: 'default' | 'featured'
    className?: string
    priority?: boolean
}) => {
    const date = formatGuideDate(guide.publishedAt)
    const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).url() : null
    const coverAlt = guide.coverImage?.alt || guide.title

    return (
        <Link 
            id='guidesCard'           
            href={`/poradniki/${guide.slug}`}
            className={`bg-[#ebe0d1] p-4 rounded-[25px] flex max-sm:flex-col h-auto w-auto 3xl:max-w-[60vw] max-w-[1100px] hover:scale-97 ease-in-out duration-300 relative ${className ?? ''}`}
        >   
            <div
                style={{gridArea: "image"}}
                className={'relative overflow-hidden rounded-[24px] bg-[#EDEDED] shrink-0  lg:w-[300px] w-[100px] lg:h-[200px] h-[50px] '}
            >
                {cover ? (
                    <Image
                        src={cover}
                        alt={coverAlt}
                        fill
                        priority={priority}
                        className="object-cover w-full h-full"
                    />
                ) : null}                
            </div>
            <div style={{gridArea: "title"}} className='flex flex-col'>
                {guide.category && (
                    <span className="bg-[#f5f9f7] text-[#94cdc3] uppercase text-[clamp(10px,1.5vw,12px)] w-fit sm:text-[13px] font-medium px-3 py-[5px] rounded-full max-md:hidden">
                        {guide.category.title}
                    </span>
                )}
        
                <h3
                    className={'text-fancy-black font-medium text-[clamp(16px,1.5vw,18px)] mt-2 '}
                >
                    {guide.title}
                </h3>
            </div>
            <div style={{gridArea: "description"}} className={`flex flex-col w-full max-sm:pb-2`}>
                
                <p
                    className={`text-[clamp(14px,1.5vw,16px)] text-fancy-black mt-2`}
                >
                    {guide.excerpt}
                </p>
                <div className='flex text-[#78afa5] text-[clamp(14px,1.5vw,16px)] font-medium space-x-2 items-center mt-4'>
                    <p>Czytaj więcej</p>
                    <ArrowRight className='w-[20px] h-[20px] '/>
                </div>
            </div>
            
            <div style={{gridArea: "actions"}} className='flex flex-col justify-between items-end w-fit max-3xs:absolute right-0 h-full'>
                <Bookmark className='w-[30px] h-[30px] text-black/50'/>
                <div className="flex items-center text-fancy-black  font-medium text-[12px] sm:text-[13px] text-nowrap bg-[#f5f9f7] p-2 rounded-[14px]">
                    {date && <span className=''>{date}</span>}
                    {guide.readingTime ? (
                        <span className="inline-flex items-center gap-1 ">
                            <Clock className="w-[13px] h-[13px]" />
                            {guide.readingTime} min
                        </span>
                    ) : null}
                </div>
            </div>
            
        </Link>
    )
}

export default GuideCard
