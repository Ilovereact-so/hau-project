import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, Info, Lightbulb, Sparkles } from 'lucide-react'
import { PawIcon } from '@/components/ui/PawIcon'
import { urlFor } from '@/sanity/lib/image'
import { CALLOUT_TONE_LABELS, type CalloutTone, type DividerStyle } from '@/lib/guides/content'

/*
 * Bloki treści poradnika poza tekstem: ramka, separator, zdjęcie z podpisem
 * i polecane produkty. Te same komponenty renderuje sklep (GuideBody) i
 * podgląd w edytorze panelu — dzięki temu podgląd wygląda dokładnie tak,
 * jak opublikowany wpis. Bez 'use client' i bez importów serwerowych.
 *
 * Promienie i kolory są zapisane wprost (rounded-[..px], #hex), a nie przez
 * skalę Tailwinda: panel admina nadpisuje `rounded-xl` & co. własnymi
 * tokenami, a podgląd ma wyglądać jak sklep.
 */

const CALLOUT_STYLES: Record<CalloutTone, { box: string; icon: string; title: string; Icon: typeof Lightbulb }> = {
  tip: { box: 'bg-[#EEF7F5] ', icon: 'bg-[#BCDFDB] text-[#1F5E54]', title: 'text-[#1F5E54]', Icon: Lightbulb },
  info: { box: 'bg-[#EEF3FB] ', icon: 'bg-[#CFDDF3] text-[#274C85]', title: 'text-[#274C85]', Icon: Info },
  warning: { box: 'bg-[#FDF6E7] ', icon: 'bg-[#F2DDAA] text-[#7A5410]', title: 'text-[#7A5410]', Icon: AlertTriangle },
  important: { box: 'bg-[#FCEFEC] ', icon: 'bg-[#F3CCC3] text-[#8A2E1C]', title: 'text-[#8A2E1C]', Icon: Sparkles },
}

export type CalloutValue = { tone?: string; title?: string; text?: string }

export function GuideCallout({ value }: { value: CalloutValue }) {
  const tone = (value.tone && value.tone in CALLOUT_STYLES ? value.tone : 'tip') as CalloutTone
  const style = CALLOUT_STYLES[tone]
  const text = (value.text ?? '').trim()
  if (!text) return null
  const title = value.title?.trim() || CALLOUT_TONE_LABELS[tone]
  return (
    <aside
      className={`my-8 flex gap-4 rounded-[20px] px-5 py-4 sm:px-6 sm:py-5 ${style.box}`}
      role="note"
      aria-label={title}
    >
      <span className={`grid size-9 shrink-0 place-items-center rounded-full ${style.icon}`} aria-hidden>
        <style.Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className={`m-0 font-poppins text-[15px] font-semibold ${style.title}`}>{title}</p>
        <p className="m-0 mt-1 whitespace-pre-line font-poppins text-[clamp(15px,1.5vw,16.5px)] leading-[1.75] text-[#2B2B2B]">
          {text}
        </p>
      </div>
    </aside>
  )
}

export function GuideDivider({ style }: { style?: DividerStyle | string }) {
  if (style === 'paws') {
    return (
      <div className="my-12 flex items-center justify-center gap-5 text-[#9CCFC7]" role="separator">
        <PawIcon className="size-5 -rotate-12" />
        <PawIcon className="size-6" />
        <PawIcon className="size-5 rotate-12" />
      </div>
    )
  }
  return <hr className="my-12 h-px border-0 bg-gradient-to-r from-transparent via-[#D9D9D9] to-transparent" />
}

export type FigureValue = { asset?: unknown; alt?: string; caption?: string; hotspot?: unknown; crop?: unknown }

export function GuideFigure({ value, priority = false }: { value: FigureValue; priority?: boolean }) {
  if (!value?.asset) return null
  const source = value as Parameters<typeof urlFor>[0]
  return (
    <figure className="my-9">
      <Image
        src={urlFor(source).width(1600).fit('max').auto('format').url()}
        alt={value.alt ?? ''}
        width={1600}
        height={1000}
        priority={priority}
        sizes="(max-width: 820px) 100vw, 760px"
        className="h-auto w-full rounded-[20px] bg-[#EDEDED] object-cover"
      />
      {value.caption?.trim() && (
        <figcaption className="mt-3 text-center font-poppins text-[13px] leading-relaxed text-[#6C6C6C]">{value.caption}</figcaption>
      )}
    </figure>
  )
}

export type EmbedProduct = {
  _id: string
  title: string
  slug: string | null
  price: number | null
  imageUrl: string | null
  subtitle?: string | null
}

const priceFormat = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })

/**
 * Polecane produkty w treści. `items` to produkty już rozwiązane z referencji
 * (w sklepie przez GROQ, w podglądzie z katalogu panelu). Produkt usunięty
 * albo wycofany ze sklepu po prostu nie przychodzi — ramka pokazuje resztę,
 * a bez żadnego produktu znika w całości.
 */
export function GuideProductEmbed({ title, items, linkable = true }: { title?: string; items: EmbedProduct[]; linkable?: boolean }) {
  const products = items.filter((item) => item && item.title)
  if (!products.length) return null
  const single = products.length === 1
  return (
    <section className="my-10 rounded-[24px] bg-[#f9f9f9] p-4 sm:p-5" aria-label={title?.trim() || 'Polecane produkty'}>
      <p className="m-0 mb-3 px-1 font-poppins text-[13px] font-semibold uppercase tracking-[0.08em] text-fancy-black">
        {title?.trim() || 'Polecane produkty'}
      </p>
      <div className={single ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
        {products.map((product) => {
          const content = (
            <>
              <span className={`relative shrink-0 overflow-hidden rounded-[16px] bg-white ${single ? 'size-28 sm:size-32' : 'size-20'}`}>
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl.includes('?') ? product.imageUrl : `${product.imageUrl}?w=320&h=320&fit=crop&auto=format`}
                    alt={product.title}
                    fill
                    sizes="128px"
                    className="object-cover "
                  />
                ) : null}
              </span>
              <span className="flex min-w-0 flex-1 flex-col justify-center">
                <span className="line-clamp-2 font-poppins text-[15px] font-medium leading-snug text-[#20201F]">{product.title}</span>
                {single && product.subtitle ? (
                  <span className="mt-1 line-clamp-2 font-poppins text-[13px] text-[#6C6C6C]">{product.subtitle}</span>
                ) : null}
                <span className="mt-2 flex items-center justify-between gap-2">
                  <span className="font-poppins text-[15px] font-semibold text-[#20201F]">
                    {product.price !== null ? priceFormat.format(product.price) : ''}
                  </span>
                  <span className="inline-flex items-center gap-1 font-poppins text-[13px] font-medium text-[#1F7A6A]">
                    Zobacz
                    <ArrowRight className="size-4" />
                  </span>
                </span>
              </span>
            </>
          )
          const className =
            'group flex gap-4 rounded-[18px] bg-white p-3 no-underline transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(32,32,31,0.08)]'
          return linkable && product.slug ? (
            <Link key={product._id} href={`/product/${product.slug}`} className={className}>
              {content}
            </Link>
          ) : (
            <div key={product._id} className={className}>
              {content}
            </div>
          )
        })}
      </div>
    </section>
  )
}
