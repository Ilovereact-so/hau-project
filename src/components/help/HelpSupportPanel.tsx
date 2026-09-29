import React from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import HelpCookieSettingsButton from './HelpCookieSettingsButton'

/**
 * Ciemny panel „Nie znalazłeś odpowiedzi?” — zamyka indeks /help i każdy
 * dokument, żeby strona nie kończyła się ślepym zaułkiem. Kształt i kolory
 * z tej samej rodziny co stopka i dock filtrów (grafit → #2C2C2C → czerń,
 * miętowe akcenty).
 */
const action =
    'group flex items-center gap-3 rounded-full bg-[#2C2C2C] px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main cursor-pointer'

export default function HelpSupportPanel({ className }: { className?: string }) {
    return (
        <section
            aria-labelledby='help-support-title'
            className={cn('@container rounded-[40px] bg-fancy-black px-6 py-8 sm:px-10 sm:py-10 font-poppins', className)}
        >
            {/* Układ zależy od szerokości PANELU (na /help jest szeroki, obok
                dokumentu węższy), dlatego @container, a nie breakpointy okna. */}
            <div className='flex flex-col gap-6 @min-[900px]:flex-row @min-[900px]:items-center @min-[900px]:justify-between'>
                <div className='max-w-[520px]'>
                    <h2 id='help-support-title' className='text-white font-medium text-[clamp(18px,2vw,24px)]'>
                        Nie znalazłeś odpowiedzi?
                    </h2>
                    <p className='mt-2 text-white/70 text-[clamp(14px,1.4vw,16px)] leading-relaxed'>
                        Status zamówienia i przesyłki sprawdzisz w swoim profilu, a praktyczne porady o psach
                        znajdziesz w poradnikach.
                    </p>
                </div>
                <div className='flex flex-wrap gap-3'>
                    <Link href='/profile/orders' className={action}>
                        <Package className='size-[18px] text-main' aria-hidden />
                        Moje zamówienia
                        <ArrowRight className='size-4 text-white/50 transition-transform group-hover:translate-x-[2px]' aria-hidden />
                    </Link>
                    <Link href='/poradniki' className={action}>
                        <BookOpen className='size-[18px] text-main' aria-hidden />
                        Poradniki
                        <ArrowRight className='size-4 text-white/50 transition-transform group-hover:translate-x-[2px]' aria-hidden />
                    </Link>
                    <HelpCookieSettingsButton className={action} />
                </div>
            </div>
        </section>
    )
}
