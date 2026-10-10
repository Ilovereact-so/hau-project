'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import { adminUpdateTaxonomySeo } from '@/actions/adminProducts'
import type { TaxonomySeo } from '@/lib/admin/catalog'
import { Button } from '../kit/Button'
import { ErrorBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { TextAreaField, TextField } from '../kit/TextField'
import { RichTextEditor, type RichTextEditorHandle } from '../kit/RichTextEditor'

/**
 * Opis kategorii / subkategorii: krótki nagłówek na górze listingu, tytuł
 * i opis do Google oraz długi opis SEO wyświetlany na DOLE strony
 * (pod produktami — klientowi nie przeszkadza, a Google go czyta).
 */
export function TaxonomySeoModal({
  id,
  title,
  kind,
  path,
  initial,
  onClose,
}: {
  id: string
  title: string
  kind: 'category' | 'subcategory'
  path: string | null
  initial: TaxonomySeo
  onClose: () => void
}) {
  const router = useRouter()
  const [description, setDescription] = useState(initial.description ?? '')
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription ?? '')
  const seoRef = useRef<RichTextEditorHandle>(null)
  const [seoTouched, setSeoTouched] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await adminUpdateTaxonomySeo(id, {
        description,
        metaTitle,
        metaDescription,
        ...(seoTouched ? { seoContent: seoRef.current?.getValue() ?? [] } : {}),
      })
      if (!result.ok) return setError(result.error)
      toast.success('Opis zapisany — sklep odświeży się w ciągu minuty')
      router.refresh()
      onClose()
    })
  }

  return (
    <Modal
      as="form"
      onSubmit={submit}
      title={`Opis i SEO: ${title}`}
      subtitle={path ? `Strona w sklepie: ${path}` : 'Ta pozycja nie ma jeszcze adresu (sluga).'}
      width="w-[min(860px,100%)]"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Anuluj
          </Button>
          <Button type="submit" disabled={pending}>
            <Save size={15} strokeWidth={1.5} />
            {pending ? 'Zapisywanie…' : 'Zapisz'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <TextAreaField
          label={kind === 'category' ? 'Nagłówek strony kategorii' : 'Nagłówek listingu'}
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          maxLength={500}
          hint="Jedno zdanie wyświetlane dużą czcionką na górze strony (np. „Zabawki, które nagradzają psa…”)."
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Tytuł w Google (opcjonalnie)"
            value={metaTitle}
            onChange={(event) => setMetaTitle(event.target.value)}
            maxLength={120}
            hint={`${metaTitle.length}/60 znaków — puste = nazwa kategorii.`}
          />
          <TextField
            label="Opis w Google (opcjonalnie)"
            value={metaDescription}
            onChange={(event) => setMetaDescription(event.target.value)}
            maxLength={300}
            hint={`${metaDescription.length}/155 znaków — puste = nagłówek.`}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-2">Opis SEO — na dole strony, pod produktami</span>
          <RichTextEditor
            ref={seoRef}
            initialValue={initial.seoContent}
            placeholder="Dłuższy tekst o kategorii (150–400 słów): dla jakich psów, jak wybrać, na co zwrócić uwagę… „## ” tworzy śródtytuł."
            onEdit={() => setSeoTouched(true)}
            minHeight={260}
          />
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </Modal>
  )
}
