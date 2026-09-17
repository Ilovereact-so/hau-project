'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { slugifyCollection } from '@/sanity/lib/collectionRefs'
import { FIELD_BASE } from '../kit/TextField'
import { cn } from '../kit/utils'

export type CollectionChoice = { id: string; title: string; status: 'published' | 'changed' | 'draft' }

export type CollectionSelection = { ids: string[]; newNames: string[] }

const MAX_NEW = 20

/**
 * Wybór kolekcji produktu: istniejące z listy albo nowe po nazwie.
 * Nowe (i wpisana nazwa, która nie pasuje do żadnej kolekcji) zostaną
 * utworzone przy zapisie produktu jako SZKIC kolekcji.
 */
export function CollectionPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: CollectionChoice[]
  value: CollectionSelection
  onChange: (value: CollectionSelection) => void
  disabled?: boolean
}) {
  const inputId = useId()
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const bySlug = useMemo(() => {
    const map = new Map<string, CollectionChoice>()
    for (const option of options) {
      const key = slugifyCollection(option.title)
      if (key && !map.has(key)) map.set(key, option)
    }
    return map
  }, [options])

  const selectedIds = new Set(value.ids)
  const needle = slugifyCollection(text)
  const suggestions = options
    .filter((option) => !selectedIds.has(option.id))
    .filter((option) => !needle || slugifyCollection(option.title).includes(needle))
    .slice(0, 8)
  const exact = needle ? bySlug.get(needle) : undefined
  const alreadyNew = value.newNames.some((name) => slugifyCollection(name) === needle)
  const canCreate = Boolean(needle) && !exact && !alreadyNew && value.newNames.length < MAX_NEW
  const items: Array<{ kind: 'existing'; option: CollectionChoice } | { kind: 'new'; title: string }> = [
    ...suggestions.map((option) => ({ kind: 'existing' as const, option })),
    ...(canCreate ? [{ kind: 'new' as const, title: text.replace(/\s+/g, ' ').trim().slice(0, 120) }] : []),
  ]

  const reset = () => {
    setText('')
    setActive(0)
    inputRef.current?.focus()
  }

  const pickExisting = (option: CollectionChoice) => {
    if (!selectedIds.has(option.id)) onChange({ ...value, ids: [...value.ids, option.id] })
    reset()
  }

  const pickNew = (title: string) => {
    // Nazwa pasująca do istniejącej kolekcji zawsze wskazuje ją zamiast tworzyć duplikat.
    const match = bySlug.get(slugifyCollection(title))
    if (match) return pickExisting(match)
    onChange({ ...value, newNames: [...value.newNames, title] })
    reset()
  }

  const choose = (index: number) => {
    const item = items[index]
    if (!item) return
    if (item.kind === 'existing') pickExisting(item.option)
    else pickNew(item.title)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, Math.max(items.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      // Enter nie może wysłać formularza produktu, gdy wybieramy kolekcję.
      if (text.trim()) {
        event.preventDefault()
        if (exact && !selectedIds.has(exact.id)) pickExisting(exact)
        else if (items.length) choose(Math.min(active, items.length - 1))
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.stopPropagation()
        setOpen(false)
      }
    } else if (event.key === 'Backspace' && !text) {
      if (value.newNames.length) onChange({ ...value, newNames: value.newNames.slice(0, -1) })
      else if (value.ids.length) onChange({ ...value, ids: value.ids.slice(0, -1) })
    }
  }

  const titleFor = (id: string) => options.find((option) => option.id === id)

  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={inputId} className="text-xs font-medium text-text-2">
        Kolekcje <span className="font-normal">(opcjonalnie)</span>
      </label>
      <div
        className={cn('relative flex min-h-10 flex-wrap items-center gap-1.5 px-2 py-1.5', FIELD_BASE, disabled && 'opacity-60')}
        onClick={() => inputRef.current?.focus()}
      >
        {value.ids.map((id) => {
          const option = titleFor(id)
          return (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text">
              {option?.title ?? 'Nieznana kolekcja'}
              {option?.status === 'draft' && <span className="text-[10px] text-text-2">szkic</span>}
              <button
                type="button"
                aria-label={`Usuń kolekcję ${option?.title ?? ''}`}
                className="rounded-full text-text-2 hover:text-danger"
                disabled={disabled}
                onClick={(event) => {
                  event.stopPropagation()
                  onChange({ ...value, ids: value.ids.filter((entry) => entry !== id) })
                }}
              >
                <X size={12} strokeWidth={2} />
              </button>
            </span>
          )
        })}
        {value.newNames.map((name) => (
          <span key={`new-${name}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
            {name}
            <span className="text-[10px]">nowa · szkic</span>
            <button
              type="button"
              aria-label={`Usuń nową kolekcję ${name}`}
              className="rounded-full hover:text-danger"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation()
                onChange({ ...value, newNames: value.newNames.filter((entry) => entry !== name) })
              }}
            >
              <X size={12} strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={text}
          maxLength={120}
          placeholder={value.ids.length || value.newNames.length ? '' : 'Wybierz lub wpisz nazwę nowej…'}
          className="min-w-[140px] flex-1 bg-transparent px-1 text-sm text-text outline-none placeholder:text-muted"
          onChange={(event) => {
            setText(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
        {open && items.length > 0 && (
          <ul
            id={listId}
            role="listbox"
            className="absolute top-[calc(100%+4px)] left-0 z-20 max-h-60 w-full overflow-auto rounded-xs border border-border bg-surface py-1 shadow-2"
          >
            {items.map((item, index) => (
              <li
                key={item.kind === 'existing' ? item.option.id : `new-${item.title}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs',
                  index === active ? 'bg-surface-muted text-text' : 'text-text-2',
                )}
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => {
                  event.preventDefault()
                  choose(index)
                }}
              >
                {item.kind === 'existing' ? (
                  <>
                    <span className="truncate">{item.option.title}</span>
                    {item.option.status === 'draft' && <span className="text-[10px] text-text-2">szkic</span>}
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-primary">
                    <Plus size={12} strokeWidth={2} />
                    Utwórz „{item.title}” (szkic)
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className="text-[11px] text-text-2">
        Brakująca kolekcja powstanie jako szkic — opublikujesz ją w zakładce Kolekcje.
      </span>
    </div>
  )
}
