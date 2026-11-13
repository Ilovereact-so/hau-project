import React from 'react'
import { PortableText, type PortableTextComponents } from '@portabletext/react'
import { portableTextBaseComponents } from '@/components/PortableTextContent'
import { guideHeadings, numberedListIndexes } from '@/lib/guides/content'
import VideoPlayer, { type VideoValue } from './VideoPlayer'
import { GuideCallout, GuideDivider, GuideFigure, GuideProductEmbed, type EmbedProduct } from './GuideBlocks'

/**
 * Renderer treści poradnika.
 *
 * Bazą jest ten sam Portable Text co w Centrum pomocy (wspólne marki: linki,
 * pogrubienia, kod…), rozszerzony o elementy artykułu:
 *  - nagłówki z kotwicami (`id` z `guideHeadings` — tej samej funkcji używa
 *    spis treści, więc link „#sekcja” zawsze trafia),
 *  - typografię do dłuższego czytania (większy tekst, rytm akapitów),
 *  - bloki: film, ramka, separator, zdjęcie z podpisem, polecane produkty.
 * Stąd rozszerzenie bazowej mapy zamiast jej kopiowania — zmiana marki
 * w jednym miejscu przenosi się na obie sekcje.
 *
 * Komponent nie ma 'use client' — renderuje go serwer (sklep) i podgląd
 * w panelu admina.
 */

const TEXT = 'font-poppins text-[#2B2B2B] text-[clamp(16px,1.55vw,17.5px)] leading-[1.85]'

function isEmpty(children: React.ReactNode) {
  const parts = React.Children.toArray(children)
  return parts.length === 0 || parts.every((part) => typeof part === 'string' && !part.trim())
}

type ProductMap = Record<string, EmbedProduct>

export type GuideBodyProps = {
  value?: unknown[]
  /**
   * Produkty dla bloków „Polecane produkty”, gdy treść ma same referencje
   * (podgląd w panelu). W sklepie GROQ dokleja je do bloku jako `items`.
   */
  products?: ProductMap
  /** Podgląd w panelu: produkty bez linków (klik nie wyprowadza z edytora). */
  preview?: boolean
}

function buildComponents(
  anchors: Map<string, string>,
  listNumbers: Map<string, number>,
  products: ProductMap | undefined,
  preview: boolean,
): PortableTextComponents {
  const headingId = (value: { _key?: string }) => (value?._key ? anchors.get(value._key) : undefined)
  return {
    ...portableTextBaseComponents,
    // Wszystkie style akapitu z schematu (normal, h1–h4, blockquote) są
    // nadpisane — poradnik ma własną, większą typografię do czytania.
    block: {
      // Starszy `h1` w treści renderujemy jako H2 — strona ma już H1 (tytuł).
      h1: ({ children, value }) => (
        <h2 id={headingId(value)} className="mt-14 mb-4 scroll-mt-28 font-poppins text-[clamp(22px,2.4vw,28px)] font-semibold leading-tight tracking-[-0.01em] text-[#20201F] first:mt-0">
          {children}
        </h2>
      ),
      h2: ({ children, value }) => (
        <h2 id={headingId(value)} className="mt-14 mb-4 scroll-mt-28 font-poppins text-[clamp(22px,2.4vw,28px)] font-semibold leading-tight tracking-[-0.01em] text-[#20201F] first:mt-0">
          {children}
        </h2>
      ),
      h3: ({ children, value }) => (
        <h3 id={headingId(value)} className="mt-10 mb-3 scroll-mt-28 font-poppins text-[clamp(18px,1.9vw,21px)] font-semibold leading-snug text-[#20201F] first:mt-0">
          {children}
        </h3>
      ),
      h4: ({ children, value }) => (
        <h4 id={headingId(value)} className="mt-8 mb-2 scroll-mt-28 font-poppins text-[clamp(16px,1.6vw,18px)] font-semibold text-[#20201F] first:mt-0">
          {children}
        </h4>
      ),
      blockquote: ({ children }) => (
        <blockquote className="my-9 border-l-[3px] border-[#9CCFC7] pl-6 font-poppins text-[clamp(18px,1.9vw,21px)] font-medium italic leading-[1.6] text-[#20201F]">
          {children}
        </blockquote>
      ),
      normal: ({ children }) => {
        if (isEmpty(children)) return <div className="h-4" aria-hidden="true" />
        return <p className={`my-5 ${TEXT}`}>{children}</p>
      },
    },
    list: {
      bullet: ({ children }) => <ul className="my-6 list-disc space-y-2.5 pl-6 marker:text-[#9CCFC7]">{children}</ul>,
      // Lista przerwana akapitem/zdjęciem liczy dalej (`numberedListIndexes`) — `start` z numeru jej pierwszego punktu.
      number: ({ children, value }) => {
        const firstKey = (value as { children?: Array<{ _key?: string }> })?.children?.[0]?._key
        const start = firstKey ? listNumbers.get(firstKey) : undefined
        return (
          <ol start={start && start > 1 ? start : undefined} className="my-6 list-decimal space-y-2.5 pl-6 marker:font-semibold marker:text-[#5E9E94]">
            {children}
          </ol>
        )
      },
    },
    listItem: {
      bullet: ({ children }) => <li className={`pl-1.5 ${TEXT}`}>{children}</li>,
      number: ({ children }) => <li className={`pl-1.5 ${TEXT}`}>{children}</li>,
    },
    types: {
      ...portableTextBaseComponents.types,
      image: ({ value }) => <GuideFigure value={value} />,
      videoEmbed: ({ value }) => (
        <div className="my-9">
          <VideoPlayer value={value as VideoValue} />
        </div>
      ),
      callout: ({ value }) => <GuideCallout value={value} />,
      divider: ({ value }) => <GuideDivider style={value?.style} />,
      productEmbed: ({ value }) => {
        const resolved: EmbedProduct[] = Array.isArray(value?.items)
          ? value.items
          : Array.isArray(value?.products)
            ? value.products.map((ref: { _ref?: string }) => (ref?._ref ? products?.[ref._ref] : undefined)).filter(Boolean)
            : []
        return <GuideProductEmbed title={value?.title} items={resolved} linkable={!preview} />
      },
    },
  }
}

const GuideBody = ({ value, products, preview = false }: GuideBodyProps) => {
  if (!value || value.length === 0) return null
  const anchors = new Map(guideHeadings(value).map((heading) => [heading.key, heading.id]))
  return <PortableText value={value as any} components={buildComponents(anchors, numberedListIndexes(value), products, preview)} />
}

export default GuideBody
