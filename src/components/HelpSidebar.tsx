import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { HelpNavItem } from '@/lib/helpNavigation'

/**
 * Boczna nawigacja Centrum pomocy. Serwerowa i bezstanowa — aktywny element
 * wynika z przekazanego `activeSlug`, więc nie potrzeba tu usePathname ani
 * 'use client'.
 */
const HelpSidebar = ({
    items,
    activeSlug,
}: {
    items: HelpNavItem[]
    activeSlug?: string
}) => {
    return (
        <nav
            aria-label="Centrum pomocy"
            className="bg-fancy-black rounded-[30px] p-3 lg:sticky lg:top-6 h-fit"
        >
            <h2 className="text-white font-poppins font-medium text-[clamp(15px,1.4vw,17px)] px-4 py-3">
                Centrum pomocy
            </h2>
            <ul className="flex flex-col bg-black rounded-[24px] p-2">
                {items.map((item) => {
                    const isActive = item.slug === activeSlug
                    return (
                        <li key={item.slug}>
                            <Link
                                href={`/help/${item.slug}`}
                                aria-current={isActive ? 'page' : undefined}
                                className={`group flex items-center justify-between gap-2 rounded-[18px] px-4 py-3 text-[clamp(13px,1.3vw,15px)] transition-colors ${
                                    isActive
                                        ? 'bg-main text-black font-medium'
                                        : 'text-white/85 hover:bg-[#1E1E1E] hover:text-white'
                                }`}
                            >
                                <span>{item.title}</span>
                                <ChevronRight
                                    className={`w-[16px] h-[16px] shrink-0 transition-transform ${
                                        isActive ? 'text-black' : 'text-white/40 group-hover:translate-x-[2px]'
                                    }`}
                                />
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </nav>
    )
}

export default HelpSidebar
