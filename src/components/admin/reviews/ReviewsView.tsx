'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, Eye, EyeOff, MessageSquareReply,
  MessageSquareText, RefreshCw, Trash2, X,
} from 'lucide-react'
import type { AdminReviewRow } from '@/lib/admin/reviewsQueries'
import { adminDeleteReview, adminReplyToReview, adminSetReviewStatus } from '@/actions/adminReviews'
import { PawRating } from '@/components/reviews/PawRating'
import { REVIEW_REPLY_MAX } from '@/lib/reviewsShared'
import { Badge } from '../kit/Badge'
import { Button } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { EmptyState, ErrorBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { PillButton, PillSelect } from '../kit/Pill'
import { TextAreaField } from '../kit/TextField'
import { formatDateTime } from '../kit/format'
import { useQueryNav } from '../orders/useQueryNav'

const STATUS_OPTIONS = [
  { value: '', label: 'Wszystkie statusy' },
  { value: 'published', label: 'Opublikowane' },
  { value: 'hidden', label: 'Ukryte' },
]

const RATING_OPTIONS = [
  { value: '', label: 'Każda ocena' },
  ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} / 5` })),
]

function ReplyModal({ review, onClose }: { review: AdminReviewRow; onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState(review.adminReply ?? '')
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const save = (value: string) =>
    startTransition(async () => {
      setError('')
      const result = await adminReplyToReview(review.id, value)
      if (!result.ok) return setError(result.error)
      toast.success(value.trim() ? 'Odpowiedź opublikowana' : 'Odpowiedź usunięta')
      router.refresh()
      onClose()
    })

  return (
    <Modal
      as="form"
      title={review.adminReply ? 'Edytuj odpowiedź sklepu' : 'Odpowiedz na opinię'}
      subtitle={`${review.authorName} o „${review.productTitle}” — odpowiedź jest widoczna publicznie pod opinią.`}
      onClose={onClose}
      width="w-[min(620px,100%)]"
      onSubmit={(event) => {
        event.preventDefault()
        save(text)
      }}
      footer={
        <>
          {review.adminReply && (
            <Button variant="danger" disabled={pending} onClick={() => save('')}>
              Usuń odpowiedź
            </Button>
          )}
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={pending || !text.trim()}>
            {pending ? 'Zapisywanie…' : 'Opublikuj odpowiedź'}
          </Button>
        </>
      }
    >
      <blockquote className="m-0 rounded-sm border border-border bg-surface-muted px-3 py-2 text-xs text-text-2 whitespace-pre-line">
        {review.body}
      </blockquote>
      {error && <ErrorBox>{error}</ErrorBox>}
      <TextAreaField
        label="Treść odpowiedzi"
        value={text}
        maxLength={REVIEW_REPLY_MAX}
        onChange={(event) => setText(event.target.value)}
        rows={6}
        hint={`${text.trim().length}/${REVIEW_REPLY_MAX} znaków`}
        autoFocus
      />
    </Modal>
  )
}

function ReviewCard({ review, onReply }: { review: AdminReviewRow; onReply: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const hidden = review.status === 'hidden'
  const productHref = review.productSlug ? `/product/${review.productSlug}#opinie` : null

  const toggle = () =>
    startTransition(async () => {
      setError('')
      const result = await adminSetReviewStatus(review.id, hidden ? 'published' : 'hidden')
      if (!result.ok) return setError(result.error)
      toast.success(hidden ? 'Opinia opublikowana' : 'Opinia ukryta')
      router.refresh()
    })

  const remove = () => {
    if (!window.confirm('Trwale usunąć tę opinię? Autor będzie mógł dodać nową. Jeśli chcesz tylko zdjąć ją ze sklepu — użyj „Ukryj”.')) return
    startTransition(async () => {
      setError('')
      const result = await adminDeleteReview(review.id)
      if (!result.ok) return setError(result.error)
      toast.success('Opinia usunięta')
      router.refresh()
    })
  }

  return (
    <article
      className={`flex flex-col gap-3 rounded-md border border-border bg-surface p-4 shadow-1 transition-opacity ${
        hidden ? 'opacity-75' : ''
      } ${pending ? 'pointer-events-none opacity-50' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-surface-muted">
            {review.productImage ? (
              <Image src={review.productImage} alt="" width={48} height={48} className="size-12 object-cover" />
            ) : (
              <MessageSquareText size={18} strokeWidth={1.5} className="text-muted" />
            )}
          </span>
          <div className="min-w-0">
            <p className="m-0 truncate text-xs font-semibold text-text" title={review.productTitle}>
              {review.productTitle}
            </p>
            <p className="m-0 truncate text-[11px] text-text-2">
              {review.productBrand || review.productId}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={hidden ? 'neutral' : 'success'}>{hidden ? 'Ukryta' : 'Opublikowana'}</Badge>
          {review.verifiedPurchase && (
            <Badge tone="info">
              <BadgeCheck size={12} strokeWidth={2} className="mr-1" />
              Zakup potwierdzony
            </Badge>
          )}
          {review.rating <= 2 && <Badge tone="danger">Niska ocena</Badge>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <PawRating value={review.rating} pawClassName="w-4 h-4" />
          <span className="text-xs font-semibold text-text">{review.rating}/5</span>
          {review.title && <span className="text-xs font-semibold text-text">· {review.title}</span>}
        </div>
        <p className="m-0 text-xs leading-[1.6] text-text whitespace-pre-line break-words">{review.body}</p>
        <p className="m-0 text-[11px] text-text-2">
          {review.authorName} · {formatDateTime(review.createdAt)} ·{' '}
          <a href={`/admin/orders?q=${encodeURIComponent(review.userId)}`} className="hover:underline">
            zamówienia klienta
          </a>
        </p>
      </div>

      {review.adminReply && (
        <div className="rounded-sm border-l-2 border-primary bg-surface-muted px-3 py-2">
          <p className="m-0 text-[11px] font-semibold text-text">
            Odpowiedź sklepu · <span className="font-normal text-text-2">{formatDateTime(review.adminReplyAt)}</span>
          </p>
          <p className="mt-1 mb-0 text-xs text-text whitespace-pre-line break-words">{review.adminReply}</p>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button size="sm" variant="secondary" onClick={onReply} disabled={pending}>
          <MessageSquareReply size={14} strokeWidth={1.5} />
          {review.adminReply ? 'Edytuj odpowiedź' : 'Odpowiedz'}
        </Button>
        <Button size="sm" variant="secondary" onClick={toggle} disabled={pending}>
          {hidden ? <Eye size={14} strokeWidth={1.5} /> : <EyeOff size={14} strokeWidth={1.5} />}
          {hidden ? 'Opublikuj' : 'Ukryj'}
        </Button>
        {productHref && (
          <a
            href={productHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-xs px-2.5 text-xs font-medium text-text-2 hover:bg-surface-muted"
          >
            <ExternalLink size={14} strokeWidth={1.5} />
            W sklepie
          </a>
        )}
        <Button size="sm" variant="danger" className="ml-auto" onClick={remove} disabled={pending}>
          <Trash2 size={14} strokeWidth={1.5} />
          Usuń
        </Button>
      </div>
    </article>
  )
}

export function ReviewsView({
  rows,
  total,
  page,
  limit,
  error,
}: {
  rows: AdminReviewRow[]
  total: number
  page: number
  limit: number
  error?: string
}) {
  const router = useRouter()
  const nav = useQueryNav()
  const status = nav.get('status')
  const rating = nav.get('rating')
  const q = nav.get('q')
  const pageCount = Math.max(1, Math.ceil(total / limit))
  const filtered = Boolean(status || rating || q)
  const [replyFor, setReplyFor] = useState<AdminReviewRow | null>(null)

  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={MessageSquareText}
        title="Opinie klientów"
        subtitle="Opinie publikują się od razu. Ukryta opinia znika ze sklepu i nie liczy się do średniej produktu."
        actions={
          <>
            <PillSelect label="Status opinii" value={status} onChange={(value) => nav.set({ status: value })} options={STATUS_OPTIONS} />
            <PillSelect label="Ocena" value={rating} onChange={(value) => nav.set({ rating: value })} options={RATING_OPTIONS} />
            {filtered && (
              <PillButton icon={X} onClick={() => router.push('/admin/reviews')}>
                Wyczyść
              </PillButton>
            )}
            <PillButton icon={RefreshCw} onClick={nav.refresh} disabled={nav.pending}>
              Odśwież
            </PillButton>
          </>
        }
      />

      <div className={`px-4 pt-3 pb-4 transition-opacity ${nav.pending ? 'opacity-60' : ''}`}>
        {error && <ErrorBox className="mb-3">{error}</ErrorBox>}
        {q && (
          <p className="mt-0 mb-3 text-xs text-text-2">
            Wyniki dla „<b className="text-text">{q}</b>” — treść, tytuł, autor, nazwa produktu lub ID konta.
          </p>
        )}

        {rows.length ? (
          <>
            <div className="grid gap-3 xl:grid-cols-2">
              {rows.map((review) => (
                <ReviewCard key={review.id} review={review} onReply={() => setReplyFor(review)} />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-text-2">
              <Button variant="secondary" size="sm" disabled={page <= 1 || nav.pending} onClick={() => nav.set({ page: String(page - 1) })}>
                <ChevronLeft size={14} strokeWidth={1.5} />
                Poprzednie
              </Button>
              <span>
                Strona {page} z {pageCount} · {total} opinii
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pageCount || nav.pending} onClick={() => nav.set({ page: String(page + 1) })}>
                Następne
                <ChevronRight size={14} strokeWidth={1.5} />
              </Button>
            </div>
          </>
        ) : !error ? (
          <EmptyState icon={<MessageSquareText size={20} strokeWidth={1.5} />} title={filtered ? 'Brak wyników' : 'Brak opinii'}>
            {filtered
              ? 'Żadna opinia nie pasuje do ustawionych filtrów.'
              : 'Opinie pojawią się tutaj, gdy klienci zaczną oceniać produkty na ich stronach.'}
          </EmptyState>
        ) : null}
      </div>

      {replyFor && <ReplyModal review={replyFor} onClose={() => setReplyFor(null)} />}
    </Card>
  )
}
