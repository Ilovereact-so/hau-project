'use client'

import React from 'react'
import GuideCard, { type GuideCardItem } from './GuideCard'
import GuideCardTop from './GuideCard2'

/**
 * Karuzela wyróżnionych poradników — zaraz pod nagłówkiem /poradniki.
 *
 * - 0 elementów: nie renderuje nic.
 * - 1–2 elementy: statyczny rząd (flex), bez animacji i bez duplikacji DOM.
 * - 3+ elementów: ciągłe przesuwanie w zapętleniu (marquee). Tor jest
 *   `w-max` i zawiera DOKŁADNIE dwie identyczne kopie listy, więc animacja
 *   `translateX(0 → -50%)` zapętla się bez skoku. Obie kopie są klikalne.
 *   Pauza na hover/focus, `prefers-reduced-motion` wyłącza ruch.
 */
const FeaturedGuidesCarousel = ({ guides }: { guides: GuideCardItem[] }) => {
    if (guides.length === 0) return null

    // Statycznie: 1–2 kafle obok siebie (na mobile jeden pod drugim).
    if (guides.length <= 2) {
        return (
            <div className="featured-guides-static flex flex-col sm:flex-row gap-5 sm:gap-6">
                {guides.map((guide, index) => (
                    <GuideCard
                        key={guide._id}
                        guide={guide}
                        variant="featured"
                        priority={index === 0}
                    />
                ))}
            </div>
        )
    }

    // Animacja: czas rośnie z liczbą kafli, żeby prędkość przesuwu była stała.
    const duration = `${guides.length * 7}s`

    return (
        <div className="featured-guides-viewport relative overflow-hidden">
            {/* Tor: dwie kopie listy obok siebie — warunek płynnej pętli -50%. */}
            <div
                className="featured-guides-track flex w-max animate-featured-guides-marquee"
                style={{ animationDuration: duration }}
            >
                {[0, 1,2].map((copy) => {
                    const isDup = copy === 1
                    const isDup2 = copy ===2

                    return (
                        <div
                            key={copy}
                            className="flex gap-5 sm:gap-6 pr-5 sm:pr-6"
                        >
                            {guides.map((guide, index) => (
                                <GuideCardTop
                                    key={isDup ? `dup-${guide._id}` : isDup2 ? `dup2-${guide._id}` : guide._id}
                                    guide={guide}
                                    variant="featured"
                                    priority={copy === 0 && index === 0}
                                />
                            ))}
                        </div>
                    )
                })}
            </div>

            {/* Miękkie wygaszenie krawędzi — pozycjonowane absolutnie w viewport. */}
            <div
                aria-hidden
                className="featured-guides-fade featured-guides-fade-left pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-16"
            />
            <div
                aria-hidden
                className="featured-guides-fade featured-guides-fade-right pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-16"
            />
        </div>
    )
}

export default FeaturedGuidesCarousel
