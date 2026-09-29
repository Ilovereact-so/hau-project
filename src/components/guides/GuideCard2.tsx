import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Bookmark, Clock } from 'lucide-react'
import { urlFor } from '@/sanity/lib/image'
import { formatGuideDate, GuideCardItem } from './GuideCard'



/**
 * Kafelek poradnika — jedyny wygląd wpisu na liście, w module na stronie
 * głównej i w sekcji "zobacz też". Jeden komponent, żeby te trzy miejsca nie
 * zaczęły się rozjeżdżać przy pierwszej korekcie.
 *
 * `variant="featured"` to ten sam kafelek w układzie poziomym (obraz obok
 * tekstu) — używany dla wyróżnionego poradnika na górze /poradniki.
 */
const GuideCardTop = ({
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
    // Ręcznie wpisany czas czytania ma pierwszeństwo, inaczej szacunek z GROQ.
    const readingTime = guide.readingTime || (typeof guide.estimatedReadingTime === 'number' ? Math.max(1, guide.estimatedReadingTime) : null)
    const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).url() : null
    const coverAlt = guide.coverImage?.alt || guide.title

    return (
        <Link 
            id='guidesCard2'           
            href={`/poradniki/${guide.slug}`}
            className={`bg-[#ebe0d1] p-4 rounded-[25px] flex flex-col h-auto w-auto 3xl:max-w-[60vw] max-w-[1100px] hover:scale-97 ease-in-out duration-300 relative ${className ?? ''}`}
        >   
        <div className='flex justify-between mb-4'>
            {guide.category && (
                <span className="bg-[#f5f9f7] text-[#94cdc3] uppercase text-[clamp(10px,1.5vw,12px)] w-fit sm:text-[13px] font-medium px-3 py-[5px] rounded-full max-md:hidden">
                    {guide.category.title}
                </span>
            )}
             <Bookmark size={16} className='w-[30px] h-[30px] text-white'/>
        </div>
        
                
        <div className={'relative overflow-hidden rounded-[24px] bg-[#EDEDED] shrink-0 lg:w-[400px] w-[100px] lg:h-[200px] h-[50px] '}>
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

        <div className='max-w-[400px] mt-2'>
            <div  className='flex flex-col'>                        
                <h3
                    className={'text-fancy-black font-medium text-[clamp(16px,1.5vw,18px)] mt-2 '}
                >
                    {guide.title}
                </h3>
            </div>
            <div  className={`flex flex-col w-full max-sm:pb-2`}>
                
                <p
                    className={`text-[clamp(14px,1.5vw,15px)] text-fancy-black mt-2 line-clamp-3`}
                >
                    {guide.excerpt}
                </p>
                <div className='flex text-[#78afa5] text-[clamp(14px,1.5vw,16px)] font-medium space-x-2 items-center mt-4'>
                    <p>Czytaj więcej</p>
                    <ArrowRight className='w-[20px] h-[20px] '/>
                </div>
            </div>
            
            <div  className='flex flex-col justify-between items-end w-fit max-3xs:absolute right-0 h-full'>
                
                <div className="flex items-center gap-2 text-[#afa290] font-medium text-[11px] sm:text-[12px] text-nowrap mt-1 ">
                    {date && <span className=''>{date}</span>}
                    {readingTime ? (
                        <span className="inline-flex items-center gap-1 ">
                            <Clock className="w-[13px] h-[13px]" />
                            {readingTime} min
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
            
        </Link>
    )
}

export default GuideCardTop
