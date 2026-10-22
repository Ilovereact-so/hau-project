'use client'

import { useId } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import {
  INFO_BODY_MAX,
  INFO_MAX_SECTIONS,
  INFO_TITLE_MAX,
  INFO_TITLE_SUGGESTIONS,
} from '@/lib/productInfo'
import { Button, IconButton } from '../kit/Button'
import { FIELD_BASE } from '../kit/TextField'
import { cn } from '../kit/utils'

export type InfoSectionDraft = { key: string; title: string; body: string }

const newKey = () => Math.random().toString(36).slice(2, 10)

/**
 * Zakładki „Informacje o produkcie” (karta produktu, pod „Opis”).
 * Tytuł dowolny (z podpowiedziami), treść zwykłym tekstem — nowa linia
 * zostaje nową linią w sklepie. Zakładka bez treści się nie pokazuje.
 */
export function ProductInfoSectionsEditor({
  value,
  onChange,
  disabled,
}: {
  value: InfoSectionDraft[]
  onChange: (next: InfoSectionDraft[]) => void
  disabled?: boolean
}) {
  const listId = useId()
  const update = (key: string, patch: Partial<InfoSectionDraft>) =>
    onChange(value.map((section) => (section.key === key ? { ...section, ...patch } : section)))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  const usedTitles = new Set(value.map((section) => section.title.trim().toLocaleLowerCase('pl')))
  const suggestion = INFO_TITLE_SUGGESTIONS.find((title) => !usedTitles.has(title.toLocaleLowerCase('pl'))) ?? ''

  return (
    <div className="flex flex-col gap-2 rounded-xs border border-border bg-surface-muted px-3 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-text">Informacje o produkcie (zakładki pod „Opis”)</span>
        <span className="text-[11px] text-text-2">Np. Skład, Dodatkowe informacje. Pusta treść = zakładka ukryta.</span>
      </div>
      <datalist id={listId}>
        {INFO_TITLE_SUGGESTIONS.map((title) => (
          <option key={title} value={title} />
        ))}
      </datalist>

      {value.map((section, index) => (
        <div key={section.key} className="grid gap-1.5 rounded-xs border border-border bg-surface p-2.5">
          <div className="flex items-center gap-1.5">
            <input
              aria-label={`Tytuł zakładki ${index + 1}`}
              list={listId}
              value={section.title}
              maxLength={INFO_TITLE_MAX}
              disabled={disabled}
              placeholder="Tytuł zakładki, np. Skład"
              onChange={(event) => update(section.key, { title: event.target.value })}
              className={cn('h-9 min-w-0 flex-1 px-3 font-medium', FIELD_BASE)}
            />
            <IconButton label="Przesuń wyżej" className="size-8" disabled={disabled || index === 0} onClick={() => move(index, -1)}>
              <ArrowUp size={13} strokeWidth={1.6} />
            </IconButton>
            <IconButton label="Przesuń niżej" className="size-8" disabled={disabled || index === value.length - 1} onClick={() => move(index, 1)}>
              <ArrowDown size={13} strokeWidth={1.6} />
            </IconButton>
            <IconButton
              label="Usuń zakładkę"
              className="size-8 text-danger hover:border-danger/50 hover:text-danger"
              disabled={disabled}
              onClick={() => onChange(value.filter((entry) => entry.key !== section.key))}
            >
              <Trash2 size={13} strokeWidth={1.6} />
            </IconButton>
          </div>
          <textarea
            aria-label={`Treść zakładki ${section.title || index + 1}`}
            value={section.body}
            rows={3}
            maxLength={INFO_BODY_MAX}
            disabled={disabled}
            placeholder={
              section.title.toLocaleLowerCase('pl').startsWith('skład')
                ? 'np. 100% bawełna, wypełnienie: włókno poliestrowe'
                : 'Treść zakładki — każda nowa linia zostaje nową linią w sklepie.'
            }
            onChange={(event) => update(section.key, { body: event.target.value })}
            className={cn('min-h-16 w-full min-w-0 resize-y px-3 py-2 text-sm', FIELD_BASE)}
          />
        </div>
      ))}

      {value.length < INFO_MAX_SECTIONS && (
        <Button
          size="sm"
          variant="secondary"
          className="w-fit"
          disabled={disabled}
          onClick={() => onChange([...value, { key: newKey(), title: suggestion, body: '' }])}
        >
          <Plus size={14} strokeWidth={2} />
          Dodaj zakładkę
        </Button>
      )}
    </div>
  )
}
