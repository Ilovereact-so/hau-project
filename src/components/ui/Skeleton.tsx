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

/** Kafelek produktu: obrazek + linie tekstu + "pazurki" oceny + cena + przycisk.
 *  Szerokości identyczne jak w ProductItem2, więc karuzela nie skacze po dociągnięciu danych. */
export const ProductCardSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('relative flex flex-col justify-between h-fit rounded-[20px]', className)}>
    <div className='max-sm:w-[230px] max-lg:w-[280px] max-2.5xl:w-[calc((100vw-156px)/3.6))] w-[calc((100vw-156px)/5))]'>
      <Skeleton className='rounded-[20px] w-full max-sm:h-[150px] max-lg:h-[calc((100vw-156px)/3.5))] h-[230px]' />
    </div>
    <div className='flex flex-col px-3 pt-3 max-sm:w-[230px] max-lg:w-[280px] max-2.5xl:w-[calc((100vw-156px)/3.6))] w-[calc((100vw-156px)/5))]'>
      <Skeleton className='h-[11px] w-[40%] rounded-full' />
      <Skeleton className='h-[14px] w-[85%] rounded-full mt-2' />
      <div className='flex items-center space-x-1 sm:my-3 my-1'>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className='w-6 h-6 rounded-full' />
        ))}
      </div>
      <Skeleton className='h-[12px] w-[70%] rounded-full' />
      <Skeleton className='h-[20px] w-[45%] rounded-full mt-2' />
      <Skeleton className='h-[44px] w-full rounded-[20px] sm:mt-4 mt-2' />
    </div>
  </div>
)

/** Rząd kafelków produktowych — do wstawienia w istniejącą karuzelę (nagłówek
 *  z prawdziwym tytułem zostaje, szkielet pojawia się tylko w rzędzie). */
export const ProductCardRowSkeleton = ({ count = 4, className }: { count?: number; className?: string }) => (
  <div className={twMerge('flex md:space-x-[18px] space-x-[14px] w-auto h-auto', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <ProductCardSkeleton key={i} />
    ))}
  </div>
)
/** Szkielet banera hero — ciemny (tło banera to zdjęcie), z pasami tekstu i CTA. */
export const BannerSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge(
    'w-full min-h-[600px] 3xl:h-[80vh] h-[70vh] relative overflow-hidden bg-[#2c2c2c]',
    className
  )}>
    <div className='absolute inset-0 animate-pulse bg-gradient-to-tr from-[#232323] via-[#323232] to-[#232323]' />
    <div className='absolute w-full flex flex-col z-[4] xl:pl-30 lg:pl-22 pl-[7%] lg:pr-10 pr-[7%] sm:bottom-[18%] bottom-[14%] space-y-3'>
      <Skeleton className='h-[clamp(40px,5vw,80px)] w-[min(560px,70%)] rounded-2xl bg-white/15' />
      <Skeleton className='h-[18px] w-[min(420px,55%)] rounded-full bg-white/10' />
      <Skeleton className='h-[18px] w-[min(320px,45%)] rounded-full bg-white/10' />
      <Skeleton className='h-[46px] w-[190px] rounded-full bg-white/15 mt-2' />
    </div>
  </div>
)

/** Ciemny kafel subkategorii (karuzela "Odkryj kategorie" ma czarne tło). */
export const SubcategoryTileSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge(
    'w-[clamp(170px,18vw,255px)] h-[clamp(240px,22vw,322px)] rounded-[35px] border border-[#3a3a3a] bg-[#2c2c2c] flex flex-col items-center justify-between py-8',
    className
  )}>
    <Skeleton className='sm:w-25 w-20 sm:h-25 h-20 rounded-full bg-[#3a3a3a]' />
    <Skeleton className='h-[12px] w-[60%] rounded-full bg-[#3a3a3a]' />
    <Skeleton className='h-[11px] w-[45%] rounded-full bg-[#3a3a3a]' />
  </div>
)

/** Kafelek poradnika — obrazek 16/10 + trzy linie tekstu (wygląd 1:1 z tego,
 *  co GuidesCarousel renderował inline przed wydzieleniem do biblioteki). */
export const GuideCardSkeleton = ({ className }: { className?: string }) => (
  <div className={twMerge('animate-pulse', className)}>
    <Skeleton className='w-full aspect-[16/10] rounded-[24px]' />
    <Skeleton className='h-[12px] w-[45%] rounded-full mt-4' />
    <Skeleton className='h-[16px] w-[85%] rounded-full mt-3' />
    <Skeleton className='h-[12px] w-[70%] rounded-full mt-3' />
  </div>
)
