import React from 'react'
import { twMerge } from 'tailwind-merge'

/**
 * Kształty pokazowe ("szkielety") na czas ładowania danych z Sanity.
 *
 * Zasada: skeleton ma odwzorowywać geometrię tego, co realnie wstawi się
 * w jego miejsce (szerokości/wysokości kopiowane 1:1 z komponentów docelowych),
 * żeby treść po dojściu danych nie przeskakiwała. Wszystkie bloki pulsumją
 * (animate-pulse) w kolorze #EDEDED — neutralnym dla jasnego layoutu sklepu.
 */

/** Bazowy pulsumjący prostokąt — przekaż wymiary przez className. */
export const Skeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('animate-pulse bg-[#EDEDED] rounded-[14px]', className)} />
)

/** Kafelek produktu w KARUZELI (geometria 1:1 z ProductItem2).
 *  Do SIATEK używaj ProductGridSkeleton, do wishlisty WishlistCardSkeleton. */
export const ProductCardSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('relative w-max flex flex-col justify-between h-fit rounded-[20px] max-md:bg-[#ededed]', className)}>
    <div className='max-sm:w-[230px] flex justify-center max-sm:rounded-[20px] max-lg:w-[280px] max-2.5xl:w-[calc((100vw-156px)/3.6)] w-[calc((100vw-156px)/5)] 4xl:w-[calc((1900px-156px)/5)] max-sm:h-[150px] max-lg:h-[calc((100vw-156px)/3.5)] max-2.5xl:h-[230px] h-[250px] 4xl:h-[calc((1900px-156px)/5)] brightness-93 overflow-hidden'>
      <Skeleton className='rounded-[20px] w-full h-full' />
    </div>
    <Skeleton className='absolute top-4 left-3 h-[26px] w-[52px] rounded-[10px]' />
    <Skeleton className='absolute top-4 right-4 w-[28px] h-[28px] rounded-full' />
    <div className='flex flex-col px-3 pb-4 max-sm:w-[230px] max-lg:w-[280px] max-2.5xl:w-[calc((100vw-156px)/3.6)] w-[calc((100vw-156px)/5)] 4xl:w-[calc((1900px-156px)/5)]'>
      <Skeleton className='h-[16px] w-[40%] rounded-full mt-3' />
      <Skeleton className='h-[18px] w-[85%] rounded-full mt-1' />
      <div className='flex items-center sm:my-3 my-1 min-h-6'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='w-6 h-6 rounded-full mr-1' />
        ))}
        <Skeleton className='h-[14px] w-[60px] rounded-full ml-1' />
      </div>
      <Skeleton className='h-[14px] w-full rounded-full' />
      <Skeleton className='h-[14px] w-[60%] rounded-full mt-1' />
      <Skeleton className='h-[15px] w-[45%] rounded-full sm:mt-3 mt-2' />
      <Skeleton className='h-[48px] w-full rounded-[20px] sm:rounded-[24px] sm:mt-4 mt-2' />
    </div>
  </div>
)

/** Kafelek produktu w SIATCE listingu: kwadratowy obrazek (w == h), brak przycisku.
 *  Geometria 1:1 z ProductItemWithoutBTN (strony subcategory/search/kolekcje). */
export const ProductGridSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('relative w-max flex flex-col justify-between h-fit', className)}>
    <div className='relative max-sm:w-[calc((100vw-66px)/2)] max-md:w-[calc((100vw-110px)/3)] max-lg:w-[calc((100vw-156px)/3)] max-1.5xl:w-[calc((100vw-156px)/4)] w-[calc((100vw-156px)/5)] 4xl:w-[calc((1900px-156px)/5)] max-sm:h-[calc((100vw-100px)/2)] max-md:h-[calc((100vw-110px)/3)] max-lg:h-[calc((100vw-156px)/3)] max-1.5xl:h-[calc((100vw-156px)/4)] h-[calc((100vw-156px)/5)] 4xl:h-[calc((1900px-156px)/5)] brightness-92 overflow-hidden'>
      <Skeleton className='w-full h-full rounded-none' />
    </div>
    <Skeleton className='absolute top-4 left-4 h-[26px] w-[52px] rounded-[10px]' />
    <Skeleton className='absolute top-4 right-4 w-[28px] h-[28px] rounded-full' />
    <div className='flex flex-col max-sm:w-[calc((100vw-66px)/2)] max-md:w-[calc((100vw-110px)/3)] max-lg:w-[calc((100vw-156px)/3)] max-1.5xl:w-[calc((100vw-156px)/4)] w-[calc((100vw-156px)/5)] 4xl:w-[calc((1900px-156px)/5)]'>
      <Skeleton className='h-[15px] w-[40%] rounded-full mt-3' />
      <Skeleton className='h-[18px] w-[85%] rounded-full mt-1' />
      <div className='flex items-center sm:my-3 my-1 min-h-6'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='w-6 h-6 rounded-full mr-1' />
        ))}
        <Skeleton className='h-[14px] w-[60px] rounded-full ml-1' />
      </div>
      <Skeleton className='h-[14px] w-full rounded-full' />
      <Skeleton className='h-[14px] w-[60%] rounded-full mt-1' />
      <Skeleton className='h-[15px] w-[45%] rounded-full mt-2' />
    </div>
  </div>
)

/** Kafelek wishlisty: jak siatka, ale z wierszem typu/wariantów, ikoną edycji
 *  i outline'owym przyciskiem. Geometria 1:1 z WishlistProduct. */
export const WishlistCardSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('relative flex flex-col justify-between h-full max-sm:w-[calc((100vw-60px)/2)] max-md:w-[calc((100vw-90px)/2)] max-lg:w-[calc((100vw-330px)/2)] max-xl:w-[calc((100vw-330px)/3)] max-3xl:w-[calc((100vw-440px)/3)] w-[calc((100vw-156px)/5)] 4xl:w-[calc((1900px-156px)/5)]', className)}>
    <div className='flex flex-col h-auto'>
      <div className='max-sm:w-[calc((100vw-70px)/2)] flex justify-center max-md:w-[calc((100vw-90px)/2)] max-lg:w-[calc((100vw-330px)/2)] max-xl:w-[calc((100vw-330px)/3)] max-3xl:w-[calc((100vw-440px)/3)] w-[calc((100vw-156px)/5)] 4xl:w-[calc((1900px-156px)/5)] max-sm:h-[150px] max-md:h-[190px] max-lg:h-[calc((100vw-156px)/3.5)] max-2.5xl:h-[230px] h-[250px] 4xl:h-[calc((1900px-156px)/5)] brightness-93 overflow-hidden'>
        <Skeleton className='w-full h-full rounded-none' />
      </div>
      <Skeleton className='h-[15px] w-[35%] rounded-full mt-4' />
      <Skeleton className='h-[18px] w-[90%] rounded-full mt-1' />
      <Skeleton className='h-[18px] w-[60%] rounded-full mt-1' />
    </div>
    <Skeleton className='absolute top-4 left-4 h-[26px] w-[52px] rounded-[10px]' />
    <Skeleton className='absolute top-4 right-4 w-[28px] h-[28px] rounded-full' />
    <div className='flex items-center sm:my-3 my-1 min-h-6'>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className='w-6 h-6 rounded-full mr-1' />
      ))}
      <Skeleton className='h-[14px] w-[60px] rounded-full ml-1' />
    </div>
    <div className='flex flex-col h-full justify-end'>
      <div className='flex justify-between w-full mt-1 gap-2'>
        <div className='flex-1'>
          <Skeleton className='h-[12px] w-[70%] rounded-full' />
          <Skeleton className='h-[12px] w-[50%] rounded-full mt-1' />
        </div>
        <div className='flex flex-col items-end gap-1'>
          <Skeleton className='h-[15px] w-[70px] rounded-full' />
          <Skeleton className='w-[20px] h-[20px] rounded' />
        </div>
      </div>
      <Skeleton className='h-[12px] w-[80%] rounded-full mt-2' />
      <Skeleton className='h-[12px] w-[55%] rounded-full mt-1' />
      <Skeleton className='h-[48px] w-full rounded-[20px] sm:rounded-[24px] sm:mt-4 mt-3' />
    </div>
  </div>
)

/** Rząd kafelków produktowych — do wstawienia w istniejącą karuzelę (nagłówek
 *  z prawdziwym tytułem zostaje, szkielet pojawia się tylko w rzędzie).
 *  `gap` dopasuj do karuzeli: ProductCarusel2 → 'md:space-x-[18px] space-x-[14px]',
 *  stara ProductCarusel → '1xl:space-x-10 lg:space-x-7 space-x-5'. */
export const ProductCardRowSkeleton = ({ count = 4, gap = 'md:space-x-[18px] space-x-[14px]', className }: { count?: number; gap?: string; className?: string }) => (
  <div className={twMerge('flex w-auto h-auto overflow-hidden', gap, className)}>
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
)
/** Szkielet banera hero — geometria 1:1 z HomeCarousel (tytuł clamp do 96px,
 *  opis max-w-600, CTA w-fit, kropki/strzałki). Bez użyć od przejścia hero na
 *  dane z serwera — trzymany jako fallback gdyby hero wrócił do client-fetch. */
export const BannerSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge(
    'w-full min-h-[600px] 3xl:h-[80vh] h-[70vh] flex z-[9] relative overflow-hidden bg-[#2c2c2c]',
    className
  )}>
    <div className='absolute inset-0 animate-pulse bg-gradient-to-tr from-[#232323] via-[#323232] to-[#232323]' />
    <div className='absolute w-full flex flex-col z-[4] xl:pl-30 lg:pl-22 pl-[7%] lg:pr-10 pr-[7%] sm:bottom-[18%] bottom-[14%]'>
      <Skeleton className='h-[clamp(40px,5vw,96px)] w-[min(560px,70%)] rounded-2xl bg-white/15 sm:leading-[90px] leading-[40px]' />
      <Skeleton className='h-[clamp(16px,1.5vw,22px)] w-[min(600px,60%)] rounded-full bg-white/10 mt-2' />
      <Skeleton className='h-[clamp(18px,1.6vw,22px)] w-[min(240px,45%)] rounded-full bg-white/15 mt-5 sm:px-10 px-6 sm:py-3 py-2' />
    </div>
    <div className='absolute sm:hidden block w-full h-full top-0 left-0 z-[2] bg-gradient-to-t from-black/30 from-30% to-50% to-transparent' />
    <div className='w-auto h-auto absolute sm:right-20 right-0 max-sm:left-[50%] max-sm:translate-x-[-50%] sm:bottom-12 bottom-7 z-[2] flex justify-center items-center space-x-2'>
      <Skeleton className='rounded-full xl:w-[17px] sm:w-[15px] w-[12px] xl:h-[17px] sm:h-[15px] h-[12px] bg-white/15' />
      <Skeleton className='rounded-full xl:w-[17px] sm:w-[15px] w-[12px] xl:h-[17px] sm:h-[15px] h-[12px] bg-white/15' />
      <Skeleton className='rounded-full xl:w-[17px] sm:w-[15px] w-[12px] xl:h-[17px] sm:h-[15px] h-[12px] bg-white/15' />
    </div>
  </div>
)

/** Ciemny kafel subkategorii — geometria 1:1 z SubcategoryContainer
 *  (kółko z paddingiem, tytuł, kreska 50px, link „Zobacz produkty"). */
export const SubcategoryTileSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge(
    'w-[clamp(170px,18vw,255px)] flex flex-col justify-evenly items-center h-[clamp(240px,22vw,322px)] rounded-[35px] relative px-2 border border-[#2b2b2b] bg-[#2c2c2c]',
    className
  )}>
    <div className='w-full flex flex-col items-center'>
      <Skeleton className='sm:w-25 w-20 sm:h-25 h-20 p-3 rounded-full bg-[#3a3a3a]' />
      <div className='flex flex-col items-center mt-4 w-full'>
        <Skeleton className='h-[16px] w-[60%] rounded-full bg-[#3a3a3a]' />
        <Skeleton className='h-[2px] w-[50px] rounded-full bg-[#3a3a3a] mt-2' />
      </div>
    </div>
    <div className='flex space-x-1 items-center'>
      <Skeleton className='h-[14px] w-[100px] rounded-full bg-[#3a3a3a]' />
      <Skeleton className='h-4 w-4 rounded-full bg-[#3a3a3a]' />
    </div>
  </div>
)

/** Kafelek poradnika — geometria 1:1 z GuideCard, łącznie z container
 *  queries: w wąskim miejscu pionowy (okładka 16:9), od 560 px karty poziomy
 *  (okładka 40% / max 320 px po lewej). */
export const GuideCardSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('@container mx-auto h-full w-full max-w-[1100px] rounded-[25px] bg-[#ebe0d1]', className)}>
    <div className='flex h-full flex-col gap-4 p-3 @min-[560px]:flex-row @min-[560px]:gap-6 @min-[560px]:p-4'>
      <Skeleton className='aspect-[16/9] w-full shrink-0 rounded-[20px] bg-[#e0d3c1] @min-[560px]:aspect-auto @min-[560px]:min-h-[190px] @min-[560px]:w-[40%] @min-[560px]:max-w-[320px] @min-[560px]:rounded-[22px]' />
      <div className='flex min-w-0 flex-1 flex-col px-1 pb-1 @min-[560px]:px-0 @min-[560px]:py-1'>
        <div className='hidden justify-between @min-[560px]:flex'>
          <Skeleton className='h-[26px] w-[110px] rounded-full bg-[#f5f9f7]' />
          <Skeleton className='size-6 rounded bg-[#e0d3c1]' />
        </div>
        <Skeleton className='h-[19px] w-[85%] rounded-full bg-[#e0d3c1] @min-[560px]:mt-3' />
        <Skeleton className='mt-3 h-[15px] w-full rounded-full bg-[#e0d3c1]' />
        <Skeleton className='mt-2 h-[15px] w-[70%] rounded-full bg-[#e0d3c1]' />
        <div className='mt-auto flex items-center justify-between pt-4'>
          <Skeleton className='h-[16px] w-[120px] rounded-full bg-[#e0d3c1]' />
          <Skeleton className='h-[30px] w-[150px] rounded-[14px] bg-[#f5f9f7]' />
        </div>
      </div>
    </div>
  </div>
)
