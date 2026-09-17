'use client'

import React, { useMemo, useState } from 'react'
import GuideCard, { type GuideCardItem } from './GuideCard'

type Category = { _id: string; title: string; slug: string }

/**
 * Lista poradników z filtrem kategorii.
 *
 * Filtrowanie dzieje się po stronie klienta na już pobranym zbiorze, a nie
 * przez nawigację do /poradniki?kategoria=... — przy skali blogu sklepu
 * (dziesiątki, nie tysiące wpisów) przeładowanie strony dla zmiany chipa byłoby
 * kosztem bez zysku. Gdy wpisów zrobi się na tyle dużo, że trzeba je stronicować,
 * ten komponent jest jedynym miejscem do przepięcia na filtr serwerowy.
 *
 * W filtrach pokazujemy tylko te kategorie, które mają co najmniej jeden wpis —
 * inaczej świeżo dodana kategoria bez treści dawałaby chip prowadzący do pustki.
 */
const GuidesGrid = ({
    guides,
    categories,
}: {
    guides: GuideCardItem[]
    categories: Category[]
}) => {
    const [activeSlug, setActiveSlug] = useState<string | null>(null)

    const usedCategories = useMemo(() => {
        const used = new Set(guides.map((guide) => guide.category?.slug).filter(Boolean) as string[])
        return categories.filter((category) => used.has(category.slug))
    }, [guides, categories])

    const visibleGuides = useMemo(
        () => (activeSlug ? guides.filter((guide) => guide.category?.slug === activeSlug) : guides),
        [guides, activeSlug],
    )

    const chipClass = (isActive: boolean) =>
        `rounded-full px-4 py-2 text-[clamp(13px,1.3vw,15px)] font-poppins whitespace-nowrap transition-colors duration-300 cursor-pointer border ${
            isActive
                ? 'bg-fancy-black border-fancy-black text-white'
                : 'bg-transparent border-black/20 text-black hover:border-black/50'
        }`

    return (
        <div className="w-full">
            {usedCategories.length > 0 && (
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-8">
                    <button type="button" onClick={() => setActiveSlug(null)} className={chipClass(activeSlug === null)}>
                        Wszystkie
                    </button>
                    {usedCategories.map((category) => (
                        <button
                            key={category._id}
                            type="button"
                            onClick={() => setActiveSlug(category.slug)}
                            className={chipClass(activeSlug === category.slug)}
                        >
                            {category.title}
                        </button>
                    ))}
                </div>
            )}

            {visibleGuides.length > 0 ? (
                <div className="grid lg:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-x-6 gap-y-10">
                    {visibleGuides.map((guide, index) => (
                        <GuideCard key={guide._id} guide={guide} priority={index < 3} />
                    ))}
                </div>
            ) : (
                <p className="text-[#6C6C6C] font-poppins text-[clamp(14px,1.4vw,16px)] py-10">
                    W tej kategorii nie ma jeszcze poradników. Zajrzyj do pozostałych — coś na pewno się znajdzie.
                </p>
            )}
        </div>
    )
}

export default GuidesGrid
