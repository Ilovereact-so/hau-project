'use client'

import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useAuth } from '@clerk/nextjs'
import toast from 'react-hot-toast'
import { BadgeCheck, Check, ChevronDown, MessageSquareText, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteMyReview } from '@/actions/reviews'
import { primeReviewSummary } from '@/hooks/useReviewSummary'
import { useAuthModalStore } from '@/store/authModalStore'
import {
  REVIEW_RATING_MAX,
  REVIEW_SORTS,
  REVIEW_SORT_LABELS,
  formatAverage,
  formatReviewDate,
  reviewsLabel,
  type MyReview,
  type PublicReview,
  type ReviewPage,
  type ReviewSort,
  type ReviewSummaryFull,
} from '@/lib/reviewsShared'
import { Skeleton } from '@/components/ui/Skeleton'
import { Paw_Filled } from '@/components/ui/paw'
import { PawRating } from './PawRating'
import { ReviewForm } from './ReviewForm'
import { Button } from '../ui/button'
import { AnimatePresence, motion } from 'framer-motion'
import { useClickOutside } from '@/hooks/useClickOutside'

type Props = {
  productId: string
  productTitle: string
  initialSummary: ReviewSummaryFull
  initialPage: ReviewPage
  initialMyReview: MyReview | null
  /** Czy zalogowany klient kupił produkt (podpowiedź w formularzu). */
  purchased: boolean
  /** Stan sesji z serwera — zanim Clerk załaduje się w przeglądarce. */
  signedIn: boolean
}

// ─── pojedyncza opinia ────────────────────────────────────────────────────────

function ReviewItem({ review, mine }: { review: PublicReview; mine?: boolean }) {
  const date = formatReviewDate(review.createdAt)
  return (
    <article className="flex flex-col gap-2 py-5" aria-label={`Opinia: ${review.authorName}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PawRating value={review.rating} pawClassName="w-5 h-5" />
        {review.title && (
          <h4 className="text-black 2xl:text-[17px] text-[clamp(14px,1.6vw,16px)] font-medium">{review.title}</h4>
        )}
      </div>
      <p className="text-black 2xl:text-[16px] text-[clamp(13px,1.6vw,15px)] whitespace-pre-line break-words">
        {review.body}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] sm:text-[13px] text-[#6C6C6C]">
        <span className="text-black">{review.authorName}</span>
        {mine && <span className="rounded-full bg-[#e2f3f0] px-2 py-0.5 text-black">Twoja opinia</span>}
        {date && <time dateTime={review.createdAt ?? undefined}>{date}</time>}
        {review.verifiedPurchase && (
          <span className="inline-flex items-center gap-1 text-[#3d8a7e]">
            <BadgeCheck size={15} aria-hidden="true" />
            Zweryfikowany zakup
          </span>
        )}
      </div>
      {review.adminReply && (
        <div className="mt-2 rounded-[20px] bg-white px-5 py-3 border-l-4 border-[#6EB0A6]">
          <p className="text-[12px] sm:text-[13px] font-medium text-black">
            Odpowiedź sklepu HAU
            {review.adminReplyAt && (
              <span className="ml-2 font-normal text-[#6C6C6C]">{formatReviewDate(review.adminReplyAt)}</span>
            )}
          </p>
          <p className="mt-1 text-[13px] sm:text-[14px] text-[#3D3D3D] whitespace-pre-line break-words">
            {review.adminReply}
          </p>
        </div>
      )}
    </article>
  )
}

// ─── rozkład ocen ─────────────────────────────────────────────────────────────

function Distribution({
  summary,
  active,
  onSelect,
}: {
  summary: ReviewSummaryFull
  active: number | null
  onSelect: (rating: number | null) => void
}) {
  return (
    <ul className="flex flex-col gap-1.5 w-full" aria-label="Rozkład ocen">
      {Array.from({ length: REVIEW_RATING_MAX }, (_, i) => {
        const rating = REVIEW_RATING_MAX - i
        const count = summary.distribution[rating - 1]
        const pct = summary.count ? Math.round((count / summary.count) * 100) : 0
        const selected = active === rating
        return (
          <li key={rating}>
            <button
              type="button"
              disabled={!count && !selected}
              aria-pressed={selected}
              onClick={() => onSelect(selected ? null : rating)}
              className={cn(
                'group flex w-full items-center gap-3 rounded-full px-2 py-1 text-[13px] text-[#6C6C6C] transition-colors',
                'enabled:cursor-pointer enabled:hover:bg-[#EDEDED] disabled:opacity-50',
                selected && 'bg-white text-black',
              )}
              title={count ? `Pokaż opinie z oceną ${rating}` : undefined}
              aria-label={`Ocena ${rating}: ${count} ${reviewsLabel(count)} (${pct}%)`}
            >
              <span className="w-3 text-right tabular-nums text-black">{rating}</span>
              <Paw_Filled className="w-4 h-4 shrink-0 text-[#6EB0A6]" />
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#EDEDED] group-hover:bg-[#F4F4F4]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#6EB0A6]" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-8 text-right tabular-nums">{count}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── sekcja ───────────────────────────────────────────────────────────────────

/**
 * Sekcja „Opinie klientów” na stronie produktu: podsumowanie z rozkładem,
 * formularz (dodanie/edycja/usunięcie własnej opinii), sortowanie, filtr po
 * ocenie i doładowywanie kolejnych porcji z `/api/reviews`.
 */
export function ProductReviews({
  productId,
  productTitle,
  initialSummary,
  initialPage,
  initialMyReview,
  purchased,
  signedIn: signedInFromServer,
}: Props) {
  const { isLoaded, isSignedIn } = useAuth()
  const signedIn = isLoaded ? Boolean(isSignedIn) : signedInFromServer
  const openModal = useAuthModalStore((s) => s.openModal)

  const [summary, setSummary] = useState(initialSummary)
  const [reviews, setReviews] = useState<PublicReview[]>(initialPage.reviews)
  const [total, setTotal] = useState(initialPage.total)
  const [hasMore, setHasMore] = useState(initialPage.hasMore)
  const [sort, setSort] = useState<ReviewSort>('newest')
  const [ratingFilter, setRatingFilter] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [myReview, setMyReview] = useState(initialMyReview)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, startDelete] = useTransition()
  const requestRef = useRef(0)
  const lastRequestRef = useRef<{ sort: ReviewSort; rating: number | null; offset: number } | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // Wylogowanie w innej karcie / przez menu — własna opinia znika z widoku.
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      setMyReview(null)
      setFormOpen(false)
    }
  }, [isLoaded, isSignedIn])

  const load = useCallback(
    async (opts: { sort: ReviewSort; rating: number | null; offset: number }) => {
      const requestId = ++requestRef.current
      lastRequestRef.current = opts
      setLoading(true)
      setLoadError('')
      try {
        const params = new URLSearchParams({ productId, sort: opts.sort, offset: String(opts.offset) })
        if (opts.rating) params.set('rating', String(opts.rating))
        const res = await fetch(`/api/reviews?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const page = (await res.json()) as ReviewPage
        // Odpowiedź na starsze zapytanie (szybka zmiana filtra) — pomijamy.
        if (requestId !== requestRef.current) return
        setReviews((prev) => (opts.offset ? [...prev, ...page.reviews.filter((r) => !prev.some((p) => p.id === r.id))] : page.reviews))
        setTotal(page.total)
        setHasMore(page.hasMore)
      } catch (err) {
        if (requestId !== requestRef.current) return
        console.error('[reviews] list fetch failed', err)
        setLoadError('Nie udało się wczytać opinii. Spróbuj ponownie.')
      } finally {
        if (requestId === requestRef.current) setLoading(false)
      }
    },
    [productId],
  )

  const changeSort = (next: ReviewSort) => {
    setSort(next)
    void load({ sort: next, rating: ratingFilter, offset: 0 })
  }

  const changeFilter = (next: number | null) => {
    setRatingFilter(next)
    void load({ sort, rating: next, offset: 0 })
  }

  const openForm = () => {
    if (!signedIn) {
      openModal('signIn')
      return
    }
    setFormOpen(true)
  }

  // Link „Napisz opinię” z nagłówka produktu (#napisz-opinie) otwiera formularz.
  useEffect(() => {
    const check = () => {
      if (window.location.hash === '#napisz-opinie') {
        sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        if (signedIn) setFormOpen(true)
      }
    }
    check()
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [signedIn])

  const applySummary = (next: ReviewSummaryFull) => {
    setSummary(next)
    primeReviewSummary(productId, next)
  }

  const handleSaved = ({ review, summary: nextSummary }: { review: MyReview; summary: ReviewSummaryFull }) => {
    setMyReview(review)
    setFormOpen(false)
    applySummary(nextSummary)
    // Świeża opinia na górze listy: najnowsze, bez filtra.
    setSort('newest')
    setRatingFilter(null)
    void load({ sort: 'newest', rating: null, offset: 0 })
  }

  const handleDelete = () => {
    if (!window.confirm('Usunąć Twoją opinię o tym produkcie? Tej operacji nie można cofnąć.')) return
    startDelete(async () => {
      const result = await deleteMyReview(productId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Opinia usunięta')
      setMyReview(null)
      setFormOpen(false)
      applySummary(result.summary)
      void load({ sort, rating: ratingFilter, offset: 0 })
    })
  }

  const listWithoutMine = myReview ? reviews.filter((r) => r.id !== myReview.id) : reviews
  const showMineOnTop = Boolean(myReview && myReview.status === 'published' && (!ratingFilter || ratingFilter === myReview.rating))
  
  const [open, setOpen] = React.useState(false)
  const rootRef = React.useRef<HTMLDivElement>(null)
  useClickOutside(rootRef, () => setOpen(false))

  React.useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  const handleSelect = (value: string) => {
    setOpen(false)
    changeSort(value as ReviewSort)
  }
  return (
    <section
      ref={sectionRef}
      id="opinie"
      aria-labelledby="opinie-heading"
      className="w-full max-w-[1430px] mx-auto xl:px-26 2lg:px-20 md:px-16 sm:px-8 px-6 mt-16 scroll-mt-24 font-poppins"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black pb-4">
        <h2 id="opinie-heading" className="text-black 2lg:text-[clamp(16px,1.6vw,18px)] text-[15px] ">
          Opinie klientów
          <span className="ml-2 text-[#6C6C6C] font-normal text-[clamp(14px,1.6vw,16px)]">({summary.count})</span>
        </h2>
      </div>

      <div className="grid lg:grid-cols-[minmax(260px,340px)_1fr] grid-cols-1 lg:gap-14 gap-8 mt-8">
        {/* Podsumowanie */}
        <aside className="flex flex-col gap-5 lg:sticky lg:top-6 self-start">
          <div className="flex items-center gap-4">
            <span className="text-black text-[clamp(44px,5vw,60px)] leading-none font-medium tabular-nums">
              {summary.count ? formatAverage(summary.average) : '–'}
            </span>
            <div className="flex flex-col gap-1">
              <PawRating value={summary.average} pawClassName="w-7 h-7" />
              <span className="text-[13px] text-[#6C6C6C]">
                {summary.count
                  ? `na podstawie ${summary.count} ${reviewsLabel(summary.count)}`
                  : 'Ten produkt nie ma jeszcze opinii'}
              </span>
            </div>
          </div>

          {summary.count > 0 && (
            <div className="rounded-[28px] border border-fancy-black px-3 py-3">
              <Distribution summary={summary} active={ratingFilter} onSelect={changeFilter} />
            </div>
          )}

          {!formOpen && (
            <div className="flex flex-col gap-2">
              <button
                                                
                className="w-fit rounded-full font-bold bg-[#EDEDED] text-fancy-black 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] md:py-3 py-2 md:px-8 px-6 hover:bg-[#EDEDED]/40 hover:text-fancy-black transition-colors cursor-pointer"
              ><div onClick={openForm}>
                {myReview ? 'Edytuj swoją opinię' : summary.count ? 'Napisz opinię' : 'Napisz pierwszą opinię'}
                </div>
              </button>
              {!signedIn && (
                <p className="text-center text-[12px] text-[#6C6C6C]">Opinie mogą dodawać zalogowani klienci.</p>
              )}
            </div>
          )}
        </aside>

        {/* Lista */}
        <div className="flex flex-col min-w-0">
          {formOpen && signedIn && (
            <div className="mb-8">
              <ReviewForm
                productId={productId}
                productTitle={productTitle}
                existing={myReview}
                verifiedPurchase={purchased || Boolean(myReview?.verifiedPurchase)}
                onSaved={handleSaved}
                onCancel={() => setFormOpen(false)}
              />
            </div>
          )}

          {myReview && !formOpen && (
            <div className="mb-6 rounded-[28px] border border-fancy-black sm:px-7 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[14px] text-black font-medium">
                  {myReview.status === 'hidden'
                    ? 'Twoja opinia została ukryta przez moderatora i nie jest widoczna dla innych.'
                    : 'Twoja opinia jest opublikowana.'}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormOpen(true)}
                    className="rounded-full border border-fancy-black px-5 py-2 text-[13px] font-bold text-fancy-black hover:bg-white/70 transition-colors cursor-pointer"
                  >
                    Edytuj
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="rounded-full px-5 py-2 text-[13px] font-bold text-red-600 hover:bg-white/60 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {deleting ? 'Usuwanie…' : 'Usuń'}
                  </button>
                </div>
              </div>
              {myReview.status === 'hidden' && <ReviewItem review={myReview} mine />}
            </div>
          )}

          {(summary.count > 0 || total > 0) && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-[#6C6C6C]">
                <span aria-live="polite">
                  {ratingFilter
                    ? `${total} ${reviewsLabel(total)} z oceną ${ratingFilter}`
                    : `${total} ${reviewsLabel(total)}`}
                </span>
                {ratingFilter && (
                  <button
                    type="button"
                    onClick={() => changeFilter(null)}
                    className="inline-flex items-center gap-1 rounded-full bg-[#EDEDED] px-3 py-1 text-black hover:bg-[#e2f3f0] transition-colors cursor-pointer"
                  >
                    Ocena: {ratingFilter}
                    <X size={14} aria-hidden="true" />
                    <span className="sr-only">— wyczyść filtr</span>
                  </button>
                )}
              </div>              

              <div ref={rootRef} className="relative w-[220px] font-poppins mt-3">
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-expanded={open}
                  aria-haspopup="listbox"
                  className={`flex my-2 items-center justify-between w-full gap-3 min-w-[9rem] h-[50px] px-5 text-black bg-[#EDEDED] cursor-pointer select-none transition-colors hover:bg-white ${
                    open ? "rounded-t-[20px]" : "rounded-[20px]"
                  }`}
                >
                  <span className="2lg:text-[15px] text-[14px] leading-6">{REVIEW_SORT_LABELS[sort]}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                  />
                </button>
          
                <AnimatePresence>
                  {open && (
                    <motion.ul
                      role="listbox"
                      initial={{ opacity: 0, y: -14 }}
                      animate={{ opacity: 1, y: -10 }}
                      exit={{ opacity: 0, y: -14 }}
                      transition={{ duration: 0.15, ease: "easeInOut" }}
                      className="absolute left-0 top-full z-20 w-full min-w-[9rem] max-h-64 overflow-y-auto rounded-b-[20px] bg-[#EDEDED] shadow-lg"
                    >
                      {REVIEW_SORTS.map((value ) => (
                        <li key={value}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={value === sort}
                            onClick={() => handleSelect(value)}
                            className="flex items-center gap-2 w-full h-[50px] px-5 text-left text-black text-[0.875rem] cursor-pointer hover:bg-white transition-colors"
                          >
                            <Check className={`w-3 h-3 shrink-0 ${value === sort ? "opacity-100" : "opacity-0"}`} />
                            <span >{REVIEW_SORT_LABELS[value]}</span>
                          </button>
                        </li>
                      ))}
                    </motion.ul>  
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <div className={cn('flex flex-col divide-y divide-[#D9D9D9] transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
            {showMineOnTop && myReview && sort === 'newest' && <ReviewItem review={myReview} mine />}
            {(showMineOnTop && sort === 'newest' ? listWithoutMine : reviews).map((review) => (
              <ReviewItem key={review.id} review={review} mine={review.id === myReview?.id} />
            ))}
            {loading && !reviews.length && (
              <div className="flex flex-col gap-3 py-5">
                <Skeleton className="h-5 w-40 rounded-full" />
                <Skeleton className="h-4 w-full rounded-full" />
                <Skeleton className="h-4 w-3/4 rounded-full" />
              </div>
            )}
          </div>

          {!loading && !reviews.length && !loadError && (
            <div className="flex flex-col items-center gap-3 rounded-[35px] bg-[#EDEDED] px-6 py-10 text-center mt-4 font-poppins">
              <MessageSquareText className="text-[#6EB0A6]" size={32} aria-hidden="true" />
              <p className="text-black text-[15px] font-medium">
                {ratingFilter ? 'Brak opinii z taką oceną.' : 'Nikt jeszcze nie ocenił tego produktu.'}
              </p>
              {!ratingFilter && !myReview && (
                <p className="text-[#6C6C6C] text-[13px]">Podziel się wrażeniami — Twoja opinia pomoże innym opiekunom.</p>
              )}
            </div>
          )}

          {loadError && (
            <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 text-[14px] text-red-600">
              {loadError}
              <button
                type="button"
                onClick={() => void load(lastRequestRef.current ?? { sort, rating: ratingFilter, offset: 0 })}
                className="rounded-full bg-[#EDEDED] px-4 py-1.5 text-black font-medium cursor-pointer hover:bg-[#e2f3f0]"
              >
                Ponów
              </button>
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void load({ sort, rating: ratingFilter, offset: reviews.length })}
              className="mt-6 self-center rounded-full font-bold bg-[#EDEDED] text-fancy-black 2xl:text-[16px] text-[clamp(13px,1.8vw,15px)] py-3 px-8 hover:bg-[#EDEDED]/50 transition-colors cursor-pointer disabled:opacity-60"
            >
              {loading ? 'Wczytywanie…' : 'Pokaż więcej opinii'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

export default ProductReviews
