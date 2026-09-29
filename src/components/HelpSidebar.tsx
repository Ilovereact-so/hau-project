import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { groupHelpNavigation, type HelpNavItem } from '@/lib/helpNavigation'
import { helpIcon } from '@/components/help/helpIcons'
import HelpChipScroller from '@/components/help/HelpChipScroller'

/**
 * Nawigacja między dokumentami Centrum pomocy (strona /help/[slug]).
 *
 * Dwa układy z jednego komponentu:
 *  - od `lg` — przyklejona biała kolumna obok treści, pogrupowana jak /help,
 *  - poniżej `lg` — jeden rząd pigułek przewijany w poziomie (ten sam kształt
 *    co filtry kategorii w poradnikach), żeby nie spychać dokumentu w dół.
 *
 * Serwerowa i bezstanowa — aktywny element wynika z `activeSlug`.
 */
const HelpSidebar = ({ items, activeSlug }: { items: HelpNavItem[]; activeSlug?: string }) => {
    const groups = groupHelpNavigation(items)

    return (
        <>
            {/* Telefon / tablet */}
            <nav aria-label='Dokumenty Centrum pomocy' className='lg:hidden -mx-6 sm:-mx-8 md:-mx-10'>
                <HelpChipScroller className='carousel relative flex gap-2 overflow-x-auto px-6 sm:px-8 md:px-10 pb-1'>
                    {groups.flatMap((group) => group.items).map((item) => {
                        const isActive = item.slug === activeSlug
                        const Icon = helpIcon(item.slug)
                        return (
                            <li key={item.slug} className='shrink-0'>
                                <Link
                                    href={`/help/${item.slug}`}
                                    aria-current={isActive ? 'page' : undefined}
                                    className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] whitespace-nowrap transition-colors ${
                                        isActive
                                            ? 'bg-fancy-black border-fancy-black text-white'
                                            : 'bg-white border-black/10 text-black hover:border-black/40'
                                    }`}
                                >
                                    <Icon className={`size-4 ${isActive ? 'text-main' : 'text-[#6EB0A6]'}`} aria-hidden />
                                    {item.title}
                                </Link>
                            </li>
                        )
                    })}
                </HelpChipScroller>
            </nav>

            {/* Desktop */}
            <aside className='hidden lg:block sticky top-17 self-start'>
                <nav aria-label='Dokumenty Centrum pomocy' className='rounded-[30px] border border-[#E8E8E8] bg-white p-3 shadow-[0_4px_18px_-10px_rgba(32,32,31,0.18)]'>
                    <Link
                        href='/help'
                        className='group flex items-center gap-2 rounded-[18px] px-4 py-3 text-[14px] text-[#6C6C6C] transition-colors hover:bg-[#F4F4F4] hover:text-black'
                    >
                        <ArrowLeft className='size-4 transition-transform group-hover:-translate-x-[2px]' aria-hidden />
                        Wszystkie tematy
                    </Link>

                    {groups.map((group) => (
                        <div key={group.id} className='mt-2 border-t border-[#EFEFEF] pt-3'>
                            <p className='px-4 pb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8A8A8A]'>
                                {group.title}
                            </p>
                            <ul className='flex flex-col gap-1'>
                                {group.items.map((item) => {
                                    const isActive = item.slug === activeSlug
                                    const Icon = helpIcon(item.slug)
                                    return (
                                        <li key={item.slug}>
                                            <Link
                                                href={`/help/${item.slug}`}
                                                aria-current={isActive ? 'page' : undefined}
                                                className={`flex items-center gap-3 rounded-[18px] px-4 py-2.5 text-[15px] leading-snug transition-colors ${
                                                    isActive
                                                        ? 'bg-main text-black font-medium'
                                                        : 'text-[#4E4E4E] hover:bg-[#F4F4F4] hover:text-black'
                                                }`}
                                            >
                                                <Icon
                                                    className={`size-[18px] shrink-0 ${isActive ? 'text-fancy-black' : 'text-[#6EB0A6]'}`}
                                                    aria-hidden
                                                />
                                                <span>{item.title}</span>
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        </div>
                    ))}
                </nav>
            </aside>
        </>
    )
}

export default HelpSidebar
