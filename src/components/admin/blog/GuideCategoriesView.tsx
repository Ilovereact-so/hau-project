'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { ArrowLeft, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react'
import type { AdminGuideCategory } from '@/lib/admin/guides'
import { adminCreateGuideCategory, adminDeleteGuideCategory, adminUpdateGuideCategory } from '@/actions/adminGuides'
import { slugifyGuide } from '@/lib/guides/content'
import { Button, ButtonLink, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { DataTable, Td, Th, Tr } from '../kit/DataTable'
import { EmptyState, ErrorBox } from '../kit/EmptyState'
import { Modal } from '../kit/Modal'
import { TextAreaField, TextField } from '../kit/TextField'
import { articlesLabel } from './shared'

type Draft = { id: string | null; title: string; slug: string; description: string; order: string }

/**
 * Kategorie poradników (Żywienie, Szkolenie…) — filtry na /poradniki.
 * Kategorie są publikowane od razu: artykuł trzyma do nich silną referencję.
 */
export function GuideCategoriesView({ categories, loadError }: { categories: AdminGuideCategory[]; loadError?: string }) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<AdminGuideCategory | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const open = (category?: AdminGuideCategory) => {
    setError('')
    setDraft(
      category
        ? { id: category.id, title: category.title, slug: category.slug ?? '', description: category.description ?? '', order: String(category.order) }
        : { id: null, title: '', slug: '', description: '', order: String((categories.at(-1)?.order ?? 90) + 10) },
    )
  }

  const submit = () =>
    draft &&
    startTransition(async () => {
      const input = { title: draft.title, slug: draft.slug, description: draft.description, order: Number(draft.order) }
      const result = draft.id ? await adminUpdateGuideCategory(draft.id, input) : await adminCreateGuideCategory(input)
      if (!result.ok) return setError(result.error)
      toast.success(draft.id ? 'Zapisano kategorię' : 'Dodano kategorię')
      setDraft(null)
      router.refresh()
    })

  const remove = () =>
    toDelete &&
    startTransition(async () => {
      const result = await adminDeleteGuideCategory(toDelete.id)
      if (!result.ok) {
        toast.error(result.error)
        setToDelete(null)
        return
      }
      toast.success('Usunięto kategorię')
      setToDelete(null)
      router.refresh()
    })

  return (
    <div className="grid gap-4">
      {loadError && <ErrorBox>{loadError}</ErrorBox>}
      <Card>
        <CardHeader
          icon={FolderOpen}
          title="Kategorie poradników"
          subtitle="Filtry na liście /poradniki. Pusta kategoria nie pokazuje się w sklepie."
          actions={
            <>
              <ButtonLink href="/admin/blog" variant="secondary" size="sm">
                <ArrowLeft size={14} strokeWidth={1.75} />
                Artykuły
              </ButtonLink>
              <Button size="sm" onClick={() => open()}>
                <Plus size={14} strokeWidth={2} />
                Nowa kategoria
              </Button>
            </>
          }
        />
        <div className="p-4">
          {categories.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Kolejność</Th>
                  <Th>Nazwa</Th>
                  <Th>Adres</Th>
                  <Th>Artykuły</Th>
                  <Th className="text-right">Akcje</Th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <Tr key={category.id}>
                    <Td className="w-20 tabular-nums text-text-2">{category.order}</Td>
                    <Td>
                      <span className="block font-medium">{category.title}</span>
                      {category.description && <span className="block max-w-[46ch] truncate text-[11px] text-text-2">{category.description}</span>}
                    </Td>
                    <Td>
                      <code className="font-mono text-[11px] text-text-2">{category.slug ?? '—'}</code>
                    </Td>
                    <Td className="text-text-2">{articlesLabel(category.guideCount)}</Td>
                    <Td>
                      <span className="flex justify-end gap-2">
                        <IconButton label={`Edytuj „${category.title}”`} onClick={() => open(category)}>
                          <Pencil size={13} strokeWidth={1.5} />
                        </IconButton>
                        <IconButton label={`Usuń „${category.title}”`} onClick={() => setToDelete(category)} disabled={pending}>
                          <Trash2 size={13} strokeWidth={1.5} />
                        </IconButton>
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState icon={<FolderOpen size={20} strokeWidth={1.5} />} title="Brak kategorii">
              Dodaj pierwszą kategorię (np. „Żywienie”, „Szkolenie”, „Pielęgnacja”) — każdy artykuł musi mieć kategorię.
            </EmptyState>
          )}
        </div>
      </Card>

      {draft && (
        <Modal
          title={draft.id ? 'Edytuj kategorię' : 'Nowa kategoria'}
          onClose={() => setDraft(null)}
          as="form"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDraft(null)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={pending || !draft.title.trim()}>
                {draft.id ? 'Zapisz' : 'Dodaj'}
              </Button>
            </>
          }
        >
          <TextField
            label="Nazwa"
            autoFocus
            value={draft.title}
            maxLength={80}
            onChange={(event) => {
              const title = event.target.value
              setDraft((current) => current && { ...current, title, slug: current.id ? current.slug : slugifyGuide(title) })
            }}
          />
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <TextField
              label="Adres (slug)"
              value={draft.slug}
              onChange={(event) => setDraft((current) => current && { ...current, slug: event.target.value })}
              hint="Używany w filtrze listy poradników."
            />
            <TextField
              label="Kolejność"
              type="number"
              value={draft.order}
              onChange={(event) => setDraft((current) => current && { ...current, order: event.target.value })}
              hint="Niżej = wcześniej"
            />
          </div>
          <TextAreaField
            label="Krótki opis (opcjonalny)"
            rows={2}
            maxLength={300}
            value={draft.description}
            onChange={(event) => setDraft((current) => current && { ...current, description: event.target.value })}
          />
          {error && <ErrorBox>{error}</ErrorBox>}
        </Modal>
      )}

      {toDelete && (
        <Modal
          title={`Usunąć kategorię „${toDelete.title}”?`}
          subtitle={
            toDelete.guideCount
              ? `Kategorii używa ${articlesLabel(toDelete.guideCount)}. Najpierw przenieś je do innej kategorii w edytorze.`
              : 'Kategoria nie ma artykułów — można ją bezpiecznie usunąć.'
          }
          onClose={() => setToDelete(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setToDelete(null)}>
                Anuluj
              </Button>
              <Button variant="danger" className="border border-danger/40" onClick={remove} disabled={pending || toDelete.guideCount > 0}>
                Usuń
              </Button>
            </>
          }
        >
          {null}
        </Modal>
      )}
    </div>
  )
}
