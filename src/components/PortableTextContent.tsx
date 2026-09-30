import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { PortableText, type PortableTextComponents } from '@portabletext/react'
import { urlFor } from '@/sanity/lib/image'

/**
 * Renderer treści Centrum pomocy (Portable Text z Sanity).
 *
 * Klucze w `components` odpowiadają 1:1 stylom/dekoratorom zadeklarowanym w
 * schemacie `helpDocument` (sanity/schemaTypes/helpDocument.ts). To jest ta druga
 * połowa mechanizmu "wklej z Worda i ma wyglądać tak samo": edytor Sanity mapuje
 * wklejone formatowanie na te klucze, a tutaj każdy z nich dostaje docelowy styl
 * sklepu. Jeśli w schemacie pojawi się nowy styl, trzeba go dopisać RÓWNIEŻ tutaj —
 * inaczej wyrenderuje się jako zwykły akapit.
 *
 * Komponent jest serwerowy (bez 'use client') — nie ma tu interaktywności, więc
 * cały HTML powstaje po stronie serwera i jest indeksowalny.
 */

// Word/Google Docs przy wklejaniu potrafi wygenerować mnóstwo pustych akapitów
// (odstępy robione Enterem zamiast stylami). Renderowanie ich jako pełnoprawnych
// <p> z marginesem rozjeżdżałoby rytm dokumentu, więc puste bloki zamieniamy na
// wyraźnie mniejszy odstęp.
function isEmptyBlock(children: React.ReactNode) {
    const arr = React.Children.toArray(children)
    if (arr.length === 0) return true
    return arr.every(
        (child) => typeof child === 'string' && child.trim().length === 0
    )
}

/**
 * Mapa `_key` bloku → `id` kotwicy. Liczona przez `guideHeadings` (ta sama
 * funkcja zasila spis treści), więc link „#sekcja” zawsze trafia w nagłówek.
 */
type HeadingAnchors = Map<string, string>

function buildBlockComponents(anchors?: HeadingAnchors): PortableTextComponents['block'] {
    const headingId = (value: { _key?: string }) => (value?._key ? anchors?.get(value._key) : undefined)
    return {
        // `h1` z treści renderujemy jako <h2> (z wyglądem h1) — strona dokumentu ma
        // już własny <h1> z tytułem, a dwa H1 na stronie to błąd dostępności i SEO.
        h1: ({ children, value }) => (
            <h2 id={headingId(value)} className="text-black font-poppins font-semibold text-[clamp(22px,2.4vw,30px)] mt-10 first:mt-0 mb-4 scroll-mt-28">
                {children}
            </h2>
        ),
        h2: ({ children, value }) => (
            <h2 id={headingId(value)} className="text-black font-poppins font-semibold text-[clamp(19px,2vw,24px)] mt-9 first:mt-0 mb-3 scroll-mt-28">
                {children}
            </h2>
        ),
        h3: ({ children, value }) => (
            <h3 id={headingId(value)} className="text-black font-poppins font-medium text-[clamp(17px,1.7vw,20px)] mt-7 first:mt-0 mb-2 scroll-mt-28">
                {children}
            </h3>
        ),
        h4: ({ children, value }) => (
            <h4 id={headingId(value)} className="text-black font-poppins font-medium text-[clamp(15px,1.5vw,17px)] mt-6 first:mt-0 mb-2 scroll-mt-28">
                {children}
            </h4>
        ),
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-main bg-[#F5F5F5] rounded-r-[16px] my-6 py-3 px-5 text-[#3A3A3A] text-[clamp(14px,1.4vw,16px)] leading-relaxed italic">
                {children}
            </blockquote>
        ),
        normal: ({ children }) => {
            if (isEmptyBlock(children)) return <div className="h-3" aria-hidden="true" />
            return (
                <p className="text-[#2B2B2B] text-[clamp(14px,1.4vw,16px)] leading-[1.8] my-3">
                    {children}
                </p>
            )
        },
    }
}

const components: PortableTextComponents = {
    block: buildBlockComponents(),
    list: {
        bullet: ({ children }) => (
            <ul className="list-disc marker:text-[#6EB0A6] pl-6 my-4 space-y-2">{children}</ul>
        ),
        number: ({ children }) => (
            <ol className="list-decimal marker:font-semibold marker:text-[#5E9E94] pl-6 my-4 space-y-2">{children}</ol>
        ),
    },
    listItem: {
        bullet: ({ children }) => (
            <li className="text-[#2B2B2B] text-[clamp(14px,1.4vw,16px)] leading-[1.8] pl-1">{children}</li>
        ),
        number: ({ children }) => (
            <li className="text-[#2B2B2B] text-[clamp(14px,1.4vw,16px)] leading-[1.8] pl-1">{children}</li>
        ),
    },
    marks: {
        strong: ({ children }) => <strong className="font-semibold text-black">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        underline: ({ children }) => <span className="underline underline-offset-2">{children}</span>,
        'strike-through': ({ children }) => <span className="line-through">{children}</span>,
        code: ({ children }) => (
            <code className="bg-[#EDEDED] text-black rounded-[6px] px-[6px] py-[2px] text-[0.9em] font-mono">
                {children}
            </code>
        ),
        link: ({ children, value }) => {
            const href: string = value?.href ?? ''
            // Linki wewnętrzne przez <Link> (nawigacja klientowa, bez przeładowania),
            // zewnętrzne przez <a> z rel="noopener noreferrer" — bez tego strona
            // docelowa dostaje dostęp do window.opener.
            const isInternal = href.startsWith('/')
            const className =
                'text-[#1F7A6A] underline underline-offset-2 hover:text-black transition-colors break-words'

            if (isInternal) {
                return (
                    <Link href={href} className={className}>
                        {children}
                    </Link>
                )
            }
            return (
                <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
                    {children}
                </a>
            )
        },
    },
    types: {
        image: ({ value }) => {
            if (!value?.asset) return null
            return (
                <figure className="my-7">
                    <Image
                        src={urlFor(value).width(1400).url()}
                        alt={value?.alt ?? ''}
                        width={1400}
                        height={800}
                        className="w-full h-auto rounded-[20px] object-cover"
                    />
                    {value?.alt && (
                        <figcaption className="text-[#6C6C6C] text-[13px] mt-2 text-center">
                            {value.alt}
                        </figcaption>
                    )}
                </figure>
            )
        },
    },
}

/**
 * Eksport bazowego zestawu komponentów, żeby renderery treści o BOGATSZYM
 * zestawie bloków (np. poradniki, które mają dodatkowo `videoEmbed`) mogły go
 * rozszerzyć zamiast kopiować całą mapę stylów. Kopia rozjechałaby się przy
 * pierwszej zmianie typografii — a wtedy regulamin i poradnik wyglądałyby
 * inaczej mimo identycznej treści.
 */
export const portableTextBaseComponents = components

// Word/Docs przy wklejaniu potrafi skleić całe zdania twardymi spacjami (U+00A0).
// Taki ciąg nie łamie się na końcu linii i na telefonie wychodzi poza ekran
// (przeglądarka rozszerza wtedy całą stronę). Łańcuch 3+ słów połączonych
// twardymi spacjami zamieniamy na zwykłe spacje; pojedyncze twarde spacje
// (np. „w Tarnowie” — polska typografia) zostają.
const NBSP_CHAIN = /(?:[^\s\u00A0]+\u00A0){3,}[^\s\u00A0]+/g

function relaxNbspChains(value: any[]): any[] {
    return value.map((block) => {
        if (block?._type !== 'block' || !Array.isArray(block.children)) return block
        let changed = false
        const children = block.children.map((child: any) => {
            if (typeof child?.text !== 'string' || !child.text.includes('\u00A0')) return child
            const text = child.text.replace(NBSP_CHAIN, (m: string) => m.replace(/\u00A0/g, ' '))
            if (text === child.text) return child
            changed = true
            return { ...child, text }
        })
        return changed ? { ...block, children } : block
    })
}

/**
 * `overflow-wrap:anywhere` — siatka bezpieczeństwa dla ciągów bez miejsca na
 * złamanie (długi e-mail, adres, sklejony tekst): łamią się w środku zamiast
 * wypychać treść poza ekran telefonu. Zwykłe słowa łamią się normalnie.
 */
const PortableTextContent = ({ value, anchors }: { value?: any[]; anchors?: HeadingAnchors }) => {
    if (!value || value.length === 0) return null
    const withAnchors = anchors?.size ? { ...components, block: buildBlockComponents(anchors) } : components
    return (
        <div className="min-w-0 [overflow-wrap:anywhere]">
            <PortableText value={relaxNbspChains(value)} components={withAnchors} />
        </div>
    )
}

export default PortableTextContent
