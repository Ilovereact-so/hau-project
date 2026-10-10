'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  EditorProvider,
  PortableTextEditable,
  defineSchema,
  keyGenerator,
  useEditor,
  useEditorSelector,
  type Editor,
  type EditorSelection,
  type PortableTextBlock,
  type RenderAnnotationFunction,
  type RenderBlockFunction,
  type RenderDecoratorFunction,
  type RenderStyleFunction,
} from '@portabletext/editor'
import { EditorRefPlugin, EventListenerPlugin } from '@portabletext/editor/plugins'
import * as selectors from '@portabletext/editor/selectors'
import { MarkdownShortcutsPlugin } from '@portabletext/plugin-markdown-shortcuts'
import { Bold, ChevronDown, Italic, Link2, List, ListOrdered, Redo2, Trash2, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { normalizeHref } from '@/lib/guides/content'
import { LinkDialog } from '../blog/BlockDialogs'
import { imageUrlFromRef } from '../blog/shared'
import { cn } from './utils'

/*
 * Lekki edytor tekstu sformatowanego (Portable Text — ten sam format co
 * Sanity Studio) do opisów: długi opis produktu i opis SEO kategorii.
 *
 * Celowo prostszy niż edytor poradników: akapit, H2, H3, cytat,
 * pogrubienie, kursywa, listy i linki. Zdjęcia dodane wcześniej w Studio
 * są zachowywane (karta z miniaturą, można je usunąć) — nowe dodaje się
 * w Studio. Skróty Markdown („## ”, „- ”, „1. ”, „**…**”) działają.
 * Wartość zapisuje rodzic: `getValue()` czyta bieżący stan edytora.
 */

const STYLES = [
  { value: 'normal', label: 'Akapit' },
  { value: 'h2', label: 'Nagłówek H2' },
  { value: 'h3', label: 'Nagłówek H3' },
  { value: 'blockquote', label: 'Cytat' },
] as const

const schemaDefinition = defineSchema({
  decorators: [{ name: 'strong' }, { name: 'em' }, { name: 'underline' }],
  styles: [{ name: 'normal' }, { name: 'h1' }, { name: 'h2' }, { name: 'h3' }, { name: 'h4' }, { name: 'blockquote' }],
  lists: [{ name: 'bullet' }, { name: 'number' }],
  annotations: [{ name: 'link', fields: [{ name: 'href', type: 'string' }] }],
  blockObjects: [
    {
      name: 'image',
      fields: [
        { name: 'asset', type: 'object' },
        { name: 'alt', type: 'string' },
        { name: 'caption', type: 'string' },
        { name: 'hotspot', type: 'object' },
        { name: 'crop', type: 'object' },
      ],
    },
  ],
  inlineObjects: [],
})

const HOTKEYS = { marks: { 'mod+b': 'strong', 'mod+i': 'em', 'mod+u': 'underline' } }

export type RichTextEditorHandle = {
  /** Bieżąca treść prosto ze stanu edytora (`null` przed zamontowaniem). */
  getValue: () => PortableTextBlock[] | null
}

export type RichTextEditorProps = {
  initialValue: unknown[] | null | undefined
  placeholder?: string
  /** Wywoływane przy każdej zmianie — np. do oznaczenia formularza jako zmienionego. */
  onEdit?: () => void
  minHeight?: number
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(function RichTextEditor(
  { initialValue, placeholder, onEdit, minHeight = 220 },
  ref,
) {
  const editorRef = useRef<Editor | null>(null)
  const value = useMemo(() => (Array.isArray(initialValue) ? (initialValue as PortableTextBlock[]) : undefined), [initialValue])
  const [invalid, setInvalid] = useState<string | null>(null)
  // Edytor renderujemy dopiero w przeglądarce — przy SSR nadaje losowe klucze
  // blokom i hydracja się rozjeżdża (to samo co w edytorze poradników).
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useImperativeHandle(ref, () => ({
    getValue: () => (editorRef.current ? editorRef.current.getSnapshot().context.value ?? [] : null),
  }))

  if (!mounted) {
    return <div className="rounded-xs border border-border bg-surface-muted/50" style={{ minHeight: minHeight + 42 }} aria-busy="true" />
  }

  return (
    <EditorProvider initialConfig={{ schemaDefinition, initialValue: value, keyGenerator }}>
      <EditorRefPlugin ref={editorRef} />
      <EventListenerPlugin
        on={(event) => {
          if (event.type === 'patch') onEdit?.()
          if (event.type === 'invalid value') setInvalid(event.resolution?.description ?? 'Treść zawiera nieobsługiwane elementy.')
        }}
      />
      <MarkdownShortcutsPlugin
        boldDecorator={() => 'strong'}
        italicDecorator={() => 'em'}
        defaultStyle={() => 'normal'}
        headingStyle={({ props: { level } }) => (level <= 2 ? 'h2' : 'h3')}
        blockquoteStyle={() => 'blockquote'}
        orderedList={() => 'number'}
        unorderedList={() => 'bullet'}
        linkObject={({ props }) => {
          const href = normalizeHref(props.href)
          return href ? { _type: 'link', href } : undefined
        }}
      />
      <div className="overflow-hidden rounded-xs border border-border bg-surface focus-within:border-border-strong focus-within:ring-2 focus-within:ring-primary/20">
        <Toolbar />
        {invalid && (
          <p className="m-0 border-b border-border bg-[#fff8e6] px-3 py-2 text-[11px] text-[#7A5410]">
            {invalid} Elementy, których edytor nie zna, zostaną pominięte przy zapisie — złożone opisy edytuj w Studio.
          </p>
        )}
        <PortableTextEditable
          className="hau-blog-editable px-3 py-3 text-[14px] leading-[1.7] text-text outline-none"
          style={{ minHeight }}
          hotkeys={HOTKEYS}
          spellCheck
          renderBlock={renderBlock}
          renderStyle={renderStyle}
          renderDecorator={renderDecorator}
          renderAnnotation={renderAnnotation}
          renderListItem={(props) => <>{props.children}</>}
          renderPlaceholder={() => <span className="pointer-events-none text-muted">{placeholder ?? 'Zacznij pisać…'}</span>}
        />
      </div>
    </EditorProvider>
  )
})

// ─── renderowanie ────────────────────────────────────────────────────────────

const renderBlock: RenderBlockFunction = (props) => {
  if (props.schemaType.name === 'image') {
    return <ImageCard value={props.value as Record<string, unknown>} selected={props.selected} />
  }
  return <div>{props.children}</div>
}

function ImageCard({ value, selected }: { value: Record<string, unknown>; selected: boolean }) {
  const editor = useEditor()
  const ref = (value.asset as { _ref?: string } | undefined)?._ref
  const url = imageUrlFromRef(ref, 480)
  return (
    <div className={cn('group/card relative my-3 inline-flex items-center gap-3 rounded-[12px] border border-border bg-surface-muted p-2 pr-3', selected && 'ring-2 ring-primary')}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={String(value.alt ?? '')} className="h-16 w-24 rounded-[8px] object-cover" />
      ) : (
        <span className="grid h-16 w-24 place-items-center rounded-[8px] bg-surface text-[11px] text-text-2">zdjęcie</span>
      )}
      <span className="text-[11px] text-text-2">Zdjęcie w opisie{value.alt ? ` · ${String(value.alt)}` : ''}</span>
      <button
        type="button"
        className="grid size-7 place-items-center rounded-full text-text-2 hover:bg-surface hover:text-danger"
        aria-label="Usuń zdjęcie z opisu"
        title="Usuń"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => editor.send({ type: 'delete.block', at: [{ _key: String(value._key) }] })}
      >
        <Trash2 size={13} strokeWidth={1.75} />
      </button>
    </div>
  )
}

const renderStyle: RenderStyleFunction = (props) => {
  switch (props.schemaType.value) {
    case 'h1':
    case 'h2':
      return <h2 className="m-0 mt-5 mb-1 text-[19px] font-semibold leading-tight text-text">{props.children}</h2>
    case 'h3':
    case 'h4':
      return <h3 className="m-0 mt-4 mb-1 text-[16px] font-semibold leading-snug text-text">{props.children}</h3>
    case 'blockquote':
      return <blockquote className="m-0 my-2 border-l-2 border-border-strong pl-3 text-text-2">{props.children}</blockquote>
    default:
      return <p className="m-0 my-1.5">{props.children}</p>
  }
}

const renderDecorator: RenderDecoratorFunction = (props) => {
  switch (props.value) {
    case 'strong':
      return <strong className="font-semibold">{props.children}</strong>
    case 'em':
      return <em>{props.children}</em>
    case 'underline':
      return <u className="underline-offset-2">{props.children}</u>
    default:
      return <>{props.children}</>
  }
}

const renderAnnotation: RenderAnnotationFunction = (props) => {
  if (props.schemaType.name === 'link') {
    const href = String((props.value as { href?: string }).href ?? '')
    return (
      <span className="text-[#2f7f73] underline underline-offset-2" title={href}>
        {props.children}
      </span>
    )
  }
  return <>{props.children}</>
}

// ─── pasek narzędzi ──────────────────────────────────────────────────────────

function Toolbar() {
  const editor = useEditor()
  const activeStyle = useEditorSelector(editor, selectors.getActiveStyle) as string | undefined
  const bold = useEditorSelector(editor, selectors.isActiveDecorator('strong'))
  const italic = useEditorSelector(editor, selectors.isActiveDecorator('em'))
  const bullet = useEditorSelector(editor, selectors.isActiveListItem('bullet'))
  const number = useEditorSelector(editor, selectors.isActiveListItem('number'))
  const link = useEditorSelector(editor, selectors.isActiveAnnotation('link', { mode: 'partial' }))
  const inText = useEditorSelector(editor, (snapshot) => Boolean(selectors.getFocusTextBlock(snapshot)))
  const [dialog, setDialog] = useState<{ href?: string; annotation?: { blockKey: string; markKey: string }; selection: EditorSelection } | null>(null)

  const run = (event: Parameters<Editor['send']>[0]) => {
    editor.send(event)
    editor.send({ type: 'focus' })
  }

  const openLink = useCallback(() => {
    const snapshot = editor.getSnapshot()
    const selection = snapshot.context.selection
    const active = selectors.getActiveAnnotations(snapshot).find((annotation) => annotation._type === 'link')
    const block = selectors.getFocusTextBlock(snapshot)
    if (active && block) {
      setDialog({ href: String(active.href ?? ''), annotation: { blockKey: block.node._key, markKey: active._key }, selection })
      return
    }
    if (!selection || selectors.isSelectionCollapsed(snapshot)) {
      toast('Zaznacz tekst, który ma być linkiem.', { icon: '🔗' })
      return
    }
    setDialog({ selection })
  }, [editor])

  // Ctrl/Cmd+K — link.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
        const active = document.activeElement
        if (active && active.closest('[data-rich-text-editor]')) {
          event.preventDefault()
          openLink()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [openLink])

  const styleValue = activeStyle === 'h1' ? 'h2' : activeStyle === 'h4' ? 'h3' : activeStyle ?? 'normal'

  return (
    <div data-rich-text-editor className="flex flex-wrap items-center gap-1 border-b border-border bg-surface-muted/60 px-1.5 py-1.5">
      <ToolButton label="Cofnij (Ctrl+Z)" onClick={() => run({ type: 'history.undo' })}>
        <Undo2 size={14} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton label="Ponów (Ctrl+Y)" onClick={() => run({ type: 'history.redo' })}>
        <Redo2 size={14} strokeWidth={1.75} />
      </ToolButton>
      <Divider />
      <span className="relative inline-flex">
        <select
          aria-label="Styl akapitu"
          value={styleValue}
          disabled={!inText}
          onChange={(event) => run({ type: 'style.toggle', style: event.target.value })}
          className="h-7 w-[132px] cursor-pointer appearance-none rounded-xs border border-border bg-surface pr-7 pl-2 text-xs font-medium text-text outline-none disabled:opacity-50"
        >
          {STYLES.map((style) => (
            <option key={style.value} value={style.value}>
              {style.label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted" />
      </span>
      <Divider />
      <ToolButton label="Pogrubienie (Ctrl+B)" active={bold} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'strong' })}>
        <Bold size={14} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Kursywa (Ctrl+I)" active={italic} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'em' })}>
        <Italic size={14} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Link (Ctrl+K)" active={link} disabled={!inText} onClick={openLink}>
        <Link2 size={14} strokeWidth={2} />
      </ToolButton>
      <Divider />
      <ToolButton label="Lista punktowana („- ”)" active={bullet} disabled={!inText} onClick={() => run({ type: 'list item.toggle', listItem: 'bullet' })}>
        <List size={14} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Lista numerowana („1. ”)" active={number} disabled={!inText} onClick={() => run({ type: 'list item.toggle', listItem: 'number' })}>
        <ListOrdered size={14} strokeWidth={2} />
      </ToolButton>

      {dialog && (
        <LinkDialog
          initialHref={dialog.href}
          products={[]}
          guides={[]}
          onClose={() => {
            setDialog(null)
            editor.send({ type: 'focus' })
          }}
          onRemove={
            dialog.annotation
              ? () => {
                  if (dialog.selection) editor.send({ type: 'select', at: dialog.selection })
                  editor.send({ type: 'annotation.remove', annotation: { name: 'link' } })
                  setDialog(null)
                }
              : undefined
          }
          onSubmit={(href) => {
            if (dialog.annotation) {
              editor.send({
                type: 'annotation.set',
                at: [{ _key: dialog.annotation.blockKey }, 'markDefs', { _key: dialog.annotation.markKey }],
                props: { href },
              })
            } else {
              if (dialog.selection) editor.send({ type: 'select', at: dialog.selection })
              editor.send({ type: 'annotation.add', annotation: { name: 'link', value: { href } } })
            }
            setDialog(null)
            editor.send({ type: 'focus' })
          }}
        />
      )}
    </div>
  )
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-7 place-items-center rounded-xs transition-colors disabled:opacity-40',
        active ? 'bg-text text-bg' : 'text-text-2 hover:bg-surface hover:text-text',
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
}
