import React from 'react'
import Image from 'next/image'
import { CalendarDays, Clock, RefreshCw } from 'lucide-react'
import { urlFor } from '@/sanity/lib/image'
import { guideHeadings } from '@/lib/guides/content'
import GuideBody from './GuideBody'
import GuideToc from './GuideToc'
import VideoPlayer, { type VideoValue } from './VideoPlayer'
import type { EmbedProduct } from './GuideBlocks'

/**
 * Układ artykułu: nagłówek (kategoria, tytuł, lead, autor i daty), okładka
 * albo film, spis treści i treść w kolumnie o szerokości wygodnej do czytania
 * (~70 znaków w linii).
 *
 * Układ reaguje na szerokość KONTENERA (`@container`), a nie okna — w panelu
 * podgląd siedzi obok sidebara i ma mniej miejsca niż strona sklepu.
 *
 * Jeden komponent dla strony /poradniki/[slug] i dla podglądu w edytorze
 * panelu — podgląd pokazuje dokładnie to, co zobaczy czytelnik.
 */

export type GuideArticleData = {
  title: string
  excerpt?: string | null
  category?: { title: string; slug?: string | null } | null
  author?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  readingTime: number
  coverImage?: { asset?: unknown; alt?: string } | null
  heroVideo?: VideoValue | null
  body?: unknown[]
}

const dateFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
const formatDate = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : dateFormat.format(date)
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || 'H'
  )
}

const DAY = 24 * 60 * 60 * 1000

export default function GuideArticle({
  guide,
  products,
  preview = false,
  footer,
}: {
  guide: GuideArticleData
  /** Produkty do bloków „Polecane produkty” (podgląd w panelu). */
  products?: Record<string, EmbedProduct>
  preview?: boolean
  /** Dodatkowa treść pod artykułem (udostępnianie, powrót do listy). */
  footer?: React.ReactNode
}) {
  const headings = guideHeadings(guide.body)
  const published = formatDate(guide.publishedAt)
  const updatedAt = guide.updatedAt && guide.publishedAt && new Date(guide.updatedAt).getTime() - new Date(guide.publishedAt).getTime() > DAY
    ? formatDate(guide.updatedAt)
    : null
  const author = guide.author?.trim() || 'Zespół HAU'
  const hasHeroVideo = Boolean(guide.heroVideo?.url || guide.heroVideo?.fileUrl)
  const coverSource = guide.coverImage?.asset ? (guide.coverImage as Parameters<typeof urlFor>[0]) : null
  const hasToc = headings.filter((heading) => heading.level <= 3).length >= 2

  return (
    <article className="@container font-poppins text-[#20201F]">
      <header className="mx-auto max-w-[1024px]">
        {guide.category?.title && (
          <span className="inline-flex rounded-full bg-[#BCDFDB] px-3 py-[5px] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#1F5E54]">
            {guide.category.title}
          </span>
        )}
        <h1 className="mt-4 mb-0 text-[clamp(28px,4.2vw,46px)] font-semibold leading-[1.12] tracking-[-0.02em] text-[#20201F]">
          {guide.title || 'Bez tytułu'}
        </h1>
        {guide.excerpt?.trim() && (
          <p className="mt-5 mb-0 text-[clamp(17px,1.8vw,20px)] leading-[1.6] text-[#555555]">{guide.excerpt}</p>
        )}
        <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-[#EAEAEA] pt-5 text-[14px] text-[#5A5A5A]">
          <span className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-[#20201F] text-[13px] font-semibold text-white" aria-hidden>
              {initials(author)}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[12px] text-[#8A8A8A]">Autor</span>
              <span className="font-medium text-[#20201F]">{author}</span>
            </span>
          </span>
          {published && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-[#8A8A8A]" />
              <time dateTime={guide.publishedAt ?? undefined}>{published}</time>
            </span>
          )}
          {updatedAt && (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="size-4 text-[#8A8A8A]" />
              Zaktualizowano <time dateTime={guide.updatedAt ?? undefined}>{updatedAt}</time>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-[#8A8A8A]" />
            {guide.readingTime} min czytania
          </span>
        </div>
      </header>

      {/* Film otwierający ma pierwszeństwo przed okładką — jeśli poradnik jest
          wideo, nie ma sensu kazać widzowi najpierw przewijać zdjęcia. */}
      {(hasHeroVideo || coverSource) && (
        <div className="mx-auto mt-9 max-w-[1100px]">
          {hasHeroVideo ? (
            <VideoPlayer value={guide.heroVideo ?? undefined} posterFallback={guide.coverImage} priority />
          ) : coverSource ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[28px] bg-[#EDEDED]">
              <Image
                src={urlFor(coverSource).width(2000).fit('max').auto('format').url()}
                alt={guide.coverImage?.alt || guide.title}
                fill
                sizes="(max-width: 1140px) 100vw, 1100px"
                priority
                className="object-cover"
              />
            </div>
          ) : null}
        </div>
      )}

      <div
        className={`mx-auto mt-10 sm:mt-12 ${
          hasToc ? 'max-w-[1100px] @min-[1080px]:grid @min-[1080px]:grid-cols-[230px_minmax(0,760px)] @min-[1080px]:justify-between @min-[1080px]:gap-12' : 'max-w-[760px]'
        }`}
      >
        {hasToc && (
          <aside className="hidden @min-[1080px]:block">
            <GuideToc headings={headings} variant="sidebar" />
          </aside>
        )}
        <div className="mx-auto w-full min-w-0 max-w-[760px] @min-[1080px]:mx-0">
          {hasToc && (
            <div className="mb-8 @min-[1080px]:hidden">
              <GuideToc headings={headings} variant="inline" />
            </div>
          )}
          <GuideBody value={guide.body} products={products} preview={preview} />
          {footer}
        </div>
      </div>
    </article>
  )
}
