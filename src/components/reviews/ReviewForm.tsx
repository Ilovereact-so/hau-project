'use client'

import { useEffect, useId, useState, useTransition } from 'react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { submitReview } from '@/actions/reviews'
import { useAuthModalStore } from '@/store/authModalStore'
import {
  REVIEW_BODY_MAX,
  REVIEW_BODY_MIN,
  REVIEW_TITLE_MAX,
  validateReviewInput,
  type MyReview,
  type ReviewFieldErrors,
  type ReviewSummaryFull,
} from '@/lib/reviewsShared'
import { PawRatingInput } from './PawRatingInput'
import { Button } from '../ui/button'

type Props = {
  productId: string
  productTitle: string
  existing: MyReview | null
  verifiedPurchase: boolean
  onSaved: (result: { review: MyReview; summary: ReviewSummaryFull; created: boolean }) => void
  onCancel: () => void
}

const INPUT =
  'w-full border border-black text-black px-4 font-poppins text-[clamp(14px,1.4vw,15px)] ' +
  'placeholder:text-[#BBBBBB] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6EB0A6]/50 ' +
  'disabled:opacity-60'

export function ReviewForm({ productId, productTitle, existing, verifiedPurchase, onSaved, onCancel }: Props) {
  const formId = useId()
  const openModal = useAuthModalStore((s) => s.openModal)
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [body, setBody] = useState(existing?.body ?? '')
  const [errors, setErrors] = useState<ReviewFieldErrors>({})
  const [formError, setFormError] = useState('')
  const [pending, startTransition] = useTransition()

  // Po zapisie komponent dostaje nową wersję opinii — formularz ją odzwierciedla.
  useEffect(() => {
    setRating(existing?.rating ?? 0)
    setTitle(existing?.title ?? '')
    setBody(existing?.body ?? '')
  }, [existing?.id, existing?.rating, existing?.title, existing?.body])

  const bodyLength = body.trim().length

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError('')
    const input = { productId, rating, title, body }
    const check = validateReviewInput(input)
    if (!check.ok) {
      setErrors(check.errors)
      return
    }
    setErrors({})

    startTransition(async () => {
      const result = await submitReview(input)
      if (!result.ok) {
        if (result.needsLogin) {
          toast.error(result.error)
          openModal('signIn')
          return
        }
        setErrors(result.fieldErrors ?? {})
        setFormError(result.error)
        return
      }
      toast.success(result.created ? 'Dziękujemy za opinię! 🐾' : 'Opinia zaktualizowana')
      onSaved(result)
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${formId}-heading`}
      className="flex flex-col gap-5 rounded-[35px] "
    >
      <div>
        <h3 id={`${formId}-heading`} className="text-black 2xl:text-[20px] text-[clamp(16px,1.8vw,18px)] font-medium">
          {existing ? 'Edytuj swoją opinię' : 'Napisz opinię'}
        </h3>
        <p className="text-[#6C6C6C] text-[13px] sm:text-[14px] mt-1">
          {productTitle}
          {verifiedPurchase && <span className="ml-2 text-[#3d8a7e]">· kupiony przez Ciebie</span>}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[clamp(13px,1.3vw,14px)] font-medium text-[#3D3D3D]">Ocena *</span>
        <PawRatingInput
          id={`${formId}-rating`}
          value={rating}
          onChange={(value) => {
            setRating(value)
            setErrors((prev) => ({ ...prev, rating: undefined }))
          }}
          disabled={pending}
          error={errors.rating}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[clamp(13px,1.3vw,14px)] font-medium text-[#3D3D3D]">Tytuł (opcjonalnie)</span>
        <input
          type="text"
          value={title}
          maxLength={REVIEW_TITLE_MAX}
          disabled={pending}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Np. Idealne na długie spacery"
          aria-invalid={Boolean(errors.title)}
          className={cn(INPUT, 'rounded-full sm:py-2.5 py-2', errors.title && 'border-red-400')}
        />
        {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[clamp(13px,1.3vw,14px)] font-medium text-[#3D3D3D]">Twoja opinia *</span>
        <textarea
          value={body}
          maxLength={REVIEW_BODY_MAX}
          disabled={pending}
          rows={5}
          onChange={(e) => {
            setBody(e.target.value)
            if (errors.body) setErrors((prev) => ({ ...prev, body: undefined }))
          }}
          placeholder="Jak sprawdza się produkt? Co spodobało się Tobie i Twojemu pupilowi?"
          aria-invalid={Boolean(errors.body)}
          aria-describedby={`${formId}-body-hint`}
          className={cn(INPUT, 'rounded-[24px] py-3 resize-y min-h-[130px]', errors.body && 'border-red-400')}
        />
        <span id={`${formId}-body-hint`} className="flex justify-between gap-3 text-xs">
          <span className="text-red-500">{errors.body ?? ''}</span>
          <span className={cn('text-[#6C6C6C] tabular-nums', bodyLength > 0 && bodyLength < REVIEW_BODY_MIN && 'text-red-500')}>
            {bodyLength}/{REVIEW_BODY_MAX}
          </span>
        </span>
      </label>

      <p className="text-[12px] text-[#6C6C6C] -mt-2">
        Opinia będzie widoczna publicznie z podpisem w formie imienia i pierwszej litery nazwiska z Twojego konta.
        Sklep może ukryć treści niezgodne z regulaminem.
      </p>

      {formError && (
        <p role="alert" className="text-sm text-red-500 -mt-2">
          {formError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={pending}
          className="w-fit rounded-full font-bold bg-fancy-black text-white text-[clamp(14px,1.4vw,15px)] lg:py-6 py-5.5 px-6 hover:bg-fancy-black/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? 'Zapisywanie…' : existing ? 'Zapisz zmiany' : 'Opublikuj opinię'}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="w-fit rounded-full font-bold  bg-white text-fancy-black text-[clamp(14px,1.4vw,15px)] lg:py-6 py-5.5 px-6 hover:bg-white/60 hover:text-fancy-black transition-colors cursor-pointer disabled:opacity-60"
        >
          Anuluj
        </Button>
      </div>
    </form>
  )
}

export default ReviewForm
