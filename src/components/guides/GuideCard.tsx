import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Bookmark, Clock, PlayCircle } from 'lucide-react'
import { urlFor } from '@/sanity/lib/image'
import { Paw_Filled } from '@/components/ui/paw'

export type GuideCardItem = {
    _id: string
    title: string
    slug: string
    excerpt: string
    coverImage?: any
    category?: { _id: string; title: string; slug: string } | null
    publishedAt?: string
    readingTime?: number
    estimatedReadingTime?: number
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
 * Kafelek poradnika — jeden wygląd wpisu na liście /poradniki, w module na
 * stronie głównej, w wyróżnionych i w sekcji „Zobacz też”.
 *
 * Responsywność zależy od szerokości SAMEJ KARTY (`@container`), a nie okna:
 * ta sama karta siedzi raz w wąskiej kolumnie siatki, raz w szerokiej liście.
 *  - karta < 560 px — układ pionowy: okładka 16:9 na całą szerokość,
 *    kategoria na okładce, tytuł, zajawka, stopka z „Czytaj więcej” i datą,
 *  - karta ≥ 560 px — układ poziomy: okładka po lewej (40%, max 320 px),
 *    tekst po prawej, zakładka w rogu.
 * W siatce wszystkie karty rzędu mają równą wysokość (h-full + mt-auto stopki).
 *
 * `variant` zostaje w API dla zgodności — wygląd wynika z dostępnego miejsca.
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
    // Ręcznie wpisany czas czytania ma pierwszeństwo, inaczej szacunek z GROQ.
    const readingTime =
        guide.readingTime || (typeof guide.estimatedReadingTime === 'number' ? Math.max(1, guide.estimatedReadingTime) : null)
    const cover = guide.coverImage?.asset ? urlFor(guide.coverImage).width(900).height(560).fit('crop').auto('format').url() : null
    const coverAlt = guide.coverImage?.alt || guide.title

    return (
        <Link
            href={`/poradniki/${guide.slug}`}
            className={`guide-card group @container mx-auto block h-full w-full max-w-[1100px] rounded-[25px] bg-[#ebe0d1] font-poppins transition duration-300 ease-in-out hover:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6EB0A6] focus-visible:ring-offset-2 ${className ?? ''}`}
        >
            <article className='flex h-full flex-col gap-4 p-3 @min-[560px]:flex-row @min-[560px]:gap-6 @min-[560px]:p-4'>
                {/* Okładka */}
                <div className='relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-[20px] bg-[#e0d3c1] @min-[560px]:aspect-auto @min-[560px]:min-h-[190px] @min-[560px]:w-[40%] @min-[560px]:max-w-[320px] @min-[560px]:rounded-[22px]'>
                    {cover ? (
                        <Image
                            src={cover}
                            alt={coverAlt}
                            fill
                            priority={priority}
                            sizes='(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 420px'
                            className='object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]'
                        />
                    ) : (
                        // Wpis bez okładki — łapka zamiast pustego prostokąta.
                        <Paw_Filled className='absolute inset-0 m-auto size-12 text-[#d3c3ad]' />
                    )}

                    {guide.hasVideo && (
                        <span className='absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-fancy-black/80 px-3 py-[5px] text-[12px] font-medium text-white backdrop-blur-sm'>
                            <PlayCircle className='size-[14px]' aria-hidden />
                            Film
                        </span>
                    )}

                    {/* Kategoria na okładce — tylko w układzie pionowym. */}
                    {guide.category && (
                        <span className='absolute left-3 top-3 rounded-full bg-[#f5f9f7] px-3 py-[5px] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#4E8F85] @min-[560px]:hidden'>
                            {guide.category.title}
                        </span>
                    )}
                </div>

                {/* Treść */}
                <div className='flex min-w-0 flex-1 flex-col px-1 pb-1 @min-[560px]:px-0 @min-[560px]:py-1'>
                    <div className='hidden items-start justify-between gap-3 @min-[560px]:flex'>
                        {guide.category ? (
                            <span className='rounded-full bg-[#f5f9f7] px-3 py-[5px] text-[12px] font-semibold uppercase tracking-[0.06em] text-[#4E8F85]'>
                                {guide.category.title}
                            </span>
                        ) : (
                            <span />
                        )}
                        <Bookmark className='size-6 shrink-0 text-black/40' aria-hidden />
                    </div>

                    <h3 className='line-clamp-2 text-[clamp(17px,1.5vw,19px)] font-medium leading-snug text-fancy-black @min-[560px]:mt-3'>
                        {guide.title}
                    </h3>

                    {guide.excerpt && (
                        <p className='mt-2 line-clamp-3 text-[15px] leading-relaxed text-[#4A4540]'>{guide.excerpt}</p>
                    )}

                    <div className='mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-4'>
                        <span className='inline-flex items-center gap-2 text-[15px] font-medium text-fancy-black'>
                            Czytaj więcej
                            <ArrowRight
                                className='size-[18px] text-[#5E9E94] transition-transform group-hover:translate-x-[3px]'
                                aria-hidden
                            />
                        </span>
                        {(date || readingTime) && (
                            <span className='inline-flex items-center gap-2 whitespace-nowrap rounded-[14px] bg-[#f5f9f7] px-3 py-1.5 text-[12px] font-medium text-fancy-black sm:text-[13px]'>
                                {date && <time dateTime={guide.publishedAt}>{date}</time>}
                                {date && readingTime ? <span className='text-black/30' aria-hidden>·</span> : null}
                                {readingTime ? (
                                    <span className='inline-flex items-center gap-1'>
                                        <Clock className='size-[13px]' aria-hidden />
                                        {readingTime} min
                                    </span>
                                ) : null}
                            </span>
                        )}
                    </div>
                </div>
            </article>
        </Link>
    )
}

export default GuideCard
