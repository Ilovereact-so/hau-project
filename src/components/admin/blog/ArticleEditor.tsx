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
  type RenderListItemFunction,
  type RenderStyleFunction,
} from '@portabletext/editor'
import { EditorRefPlugin, EventListenerPlugin } from '@portabletext/editor/plugins'
import * as selectors from '@portabletext/editor/selectors'
import { MarkdownShortcutsPlugin } from '@portabletext/plugin-markdown-shortcuts'
import {
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  Code,
  Film,
  Image as ImageIcon,
  ImageOff,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Minus,
  Pencil,
  Plus,
  Redo2,
  ShoppingBag,
  Strikethrough,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  CALLOUT_TONE_LABELS,
  DIVIDER_STYLES,
  DIVIDER_STYLE_LABELS,
  EDITOR_STYLES,
  GUIDE_STYLE_LABELS,
  normalizeHref,
  numberedListIndexes,
  type CalloutTone,
  type GuideStyle,
} from '@/lib/guides/content'
import { parseVideoUrl } from '@/lib/video'
import { PawIcon } from '@/components/ui/PawIcon'
import { Badge } from '../kit/Badge'
import { cn } from '../kit/utils'
import {
  CalloutDialog,
  ImageDialog,
  LinkDialog,
  ProductEmbedDialog,
  VideoDialog,
  type CalloutBlockValue,
  type ProductEmbedBlockValue,
  type VideoBlockValue,
} from './BlockDialogs'
import { fileUrlFromRef, imageUrlFromRef, type EditorGuideLink, type EditorProduct } from './shared'

/*
 * Edytor treści artykułu — Portable Text Editor (ten sam silnik, którego
 * używa Sanity Studio), więc treść zapisuje się 1:1 w formacie Sanity, bez
 * konwersji HTML ↔ bloki.
 *
 *  - pasek narzędzi: styl akapitu, formatowanie, listy, link, wstawianie bloków,
 *  - skróty klawiszowe (Ctrl+B/I/U/K, Ctrl+Z/Y) i Markdown („## ”, „- ”, „1. ”, „> ”, „**…**”, „---”),
 *  - wklejanie z Worda/Google Docs zachowuje nagłówki, listy, pogrubienia i linki,
 *  - bloki (zdjęcie, film, ramka, produkty, separator) jako karty z edycją
 *    w oknie, przesuwaniem i usuwaniem; można je też przeciągać.
 *
 * Schemat poniżej MUSI odpowiadać `guide.body` w Sanity i
 * `lib/guides/content.ts` — edytor nie pozwoli wstawić niczego spoza niego.
 */

const schemaDefinition = defineSchema({
  decorators: [{ name: 'strong' }, { name: 'em' }, { name: 'underline' }, { name: 'strike-through' }, { name: 'code' }],
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
    {
      name: 'videoEmbed',
      fields: [
        { name: 'provider', type: 'string' },
        { name: 'url', type: 'string' },
        { name: 'file', type: 'object' },
        { name: 'poster', type: 'object' },
        { name: 'caption', type: 'string' },
      ],
    },
    {
      name: 'callout',
      fields: [
        { name: 'tone', type: 'string' },
        { name: 'title', type: 'string' },
        { name: 'text', type: 'string' },
      ],
    },
    {
      name: 'productEmbed',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'products', type: 'array' },
      ],
    },
    { name: 'divider', fields: [{ name: 'style', type: 'string' }] },
  ],
  inlineObjects: [],
})

const HOTKEYS = {
  marks: {
    'mod+b': 'strong',
    'mod+i': 'em',
    'mod+u': 'underline',
    'mod+shift+x': 'strike-through',
    "mod+'": 'code',
  },
}

type Dialog =
  | { kind: 'link'; href?: string; annotation?: { blockKey: string; markKey: string }; selection: EditorSelection }
  | { kind: 'video'; key?: string; value?: VideoBlockValue }
  | { kind: 'callout'; key?: string; value?: CalloutBlockValue }
  | { kind: 'products'; key?: string; value?: ProductEmbedBlockValue }
  | { kind: 'image'; key: string; ref: string; alt: string; caption: string }
  | null

export type UploadResult = { ref: string; url?: string } | { error: string }

export type ArticleEditorProps = {
  initialValue: unknown[]
  onChange: (value: PortableTextBlock[]) => void
  /** Natychmiast po każdej zmianie (bez czekania na zgrupowane `onChange`). */
  onEdit?: () => void
  products: EditorProduct[]
  guides: EditorGuideLink[]
  uploadImage: (file: File) => Promise<UploadResult>
  uploadVideo: (file: File) => Promise<UploadResult>
  /** Treść nie przeszła walidacji edytora — rodzic może zaproponować naprawę. */
  onInvalidValue?: (description: string) => void
}

export type ArticleEditorHandle = {
  focus: () => void
  /**
   * Bieżąca treść prosto ze stanu edytora. Zdarzenie `mutation` (onChange)
   * przychodzi z opóźnieniem (edytor grupuje zmiany), więc zapis czyta
   * wartość stąd — inaczej ostatnie sekundy pisania by przepadły.
   */
  getValue: () => PortableTextBlock[] | null
  /** Przewija do bloku (konspekt, lista kontrolna). */
  scrollToBlock: (key: string) => void
}

/**
 * Wrapper z własnym EditorProvider. Nowa wartość z zewnątrz (np. po
 * „Wczytaj najnowszą wersję”) = nowy `key` u rodzica, a nie aktualizacja propsów.
 */
export const ArticleEditor = forwardRef<ArticleEditorHandle, ArticleEditorProps>(function ArticleEditor(props, ref) {
  const editorRef = useRef<Editor | null>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.send({ type: 'focus' }),
    getValue: () => (editorRef.current ? editorRef.current.getSnapshot().context.value ?? [] : null),
    scrollToBlock: (key: string) => {
      const element = surfaceRef.current?.querySelector<HTMLElement>(`[data-block-key="${CSS.escape(key)}"]`)
      if (!element) return
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
      element.classList.add('hau-blog-flash')
      window.setTimeout(() => element.classList.remove('hau-blog-flash'), 1400)
    },
  }))

  const initialValue = useMemo(() => props.initialValue as PortableTextBlock[], [props.initialValue])

  return (
    <EditorProvider initialConfig={{ schemaDefinition, initialValue, keyGenerator }}>
      <EditorRefPlugin ref={editorRef} />
      <EventListenerPlugin
        on={(event) => {
          if (event.type === 'patch') props.onEdit?.()
          if (event.type === 'mutation') props.onChange(event.value ?? [])
          if (event.type === 'invalid value') props.onInvalidValue?.(event.resolution?.description ?? 'Treść zawiera nieznane elementy.')
        }}
      />
      <MarkdownShortcutsPlugin
        boldDecorator={() => 'strong'}
        italicDecorator={() => 'em'}
        codeDecorator={() => 'code'}
        strikeThroughDecorator={() => 'strike-through'}
        defaultStyle={() => 'normal'}
        // „# ” też daje H2 — tytuł wpisu jest już jedynym H1 na stronie.
        headingStyle={({ props: { level } }) => (level <= 2 ? 'h2' : level === 3 ? 'h3' : 'h4')}
        blockquoteStyle={() => 'blockquote'}
        orderedList={() => 'number'}
        unorderedList={() => 'bullet'}
        horizontalRuleObject={() => ({ _type: 'divider', style: 'line' })}
        linkObject={({ props }) => {
          // „[tekst](adres)” — tylko bezpieczne adresy (bez javascript: itp.).
          const href = normalizeHref(props.href)
          return href ? { _type: 'link', href } : undefined
        }}
      />
      <EditorSurface {...props} surfaceRef={surfaceRef} />
    </EditorProvider>
  )
})

function EditorSurface({
  products,
  guides,
  uploadImage,
  uploadVideo,
  surfaceRef,
}: ArticleEditorProps & { surfaceRef: React.RefObject<HTMLDivElement | null> }) {
  const editor = useEditor()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [uploading, setUploading] = useState(false)
  const imageInput = useRef<HTMLInputElement>(null)
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  // Numery punktów list numerowanych — te same co w sklepie (lista przerwana
  // akapitem liczy dalej, patrz `numberedListIndexes`). Selektor zwraca tekst,
  // więc komponent przelicza się tylko, gdy numeracja faktycznie się zmieni,
  // a nie przy każdym wpisanym znaku.
  const listNumbersSignature = useEditorSelector(editor, (snapshot) =>
    [...numberedListIndexes(snapshot.context.value)].map(([key, n]) => `${key}:${n}`).join(','),
  )
  const listNumbers = useMemo(
    () => new Map(listNumbersSignature ? listNumbersSignature.split(',').map((entry) => {
      const at = entry.lastIndexOf(':')
      return [entry.slice(0, at), Number(entry.slice(at + 1))] as const
    }) : []),
    [listNumbersSignature],
  )

  const focus = useCallback(() => window.setTimeout(() => editor.send({ type: 'focus' }), 0), [editor])
  const closeDialog = useCallback(() => {
    setDialog(null)
    focus()
  }, [focus])

  const insertObject = useCallback(
    (name: string, value: Record<string, unknown>) => {
      editor.send({ type: 'insert.block object', blockObject: { name, value }, placement: 'auto' })
      focus()
    },
    [editor, focus],
  )

  const setBlock = useCallback(
    (key: string, props: Record<string, unknown>, unset: string[] = []) => {
      editor.send({ type: 'block.set', at: [{ _key: key }], props })
      if (unset.length) editor.send({ type: 'block.unset', at: [{ _key: key }], props: unset })
    },
    [editor],
  )

  const pickImages = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!list.length) return
    setUploading(true)
    try {
      for (const file of list) {
        const result = await uploadImage(file)
        if ('error' in result) {
          toast.error(result.error)
          continue
        }
        insertObject('image', { asset: { _type: 'reference', _ref: result.ref }, alt: '' })
      }
    } finally {
      setUploading(false)
    }
  }

  const openLinkDialog = useCallback((attempt = 0) => {
    const snapshot = editor.getSnapshot()
    // Zaznaczenie zapamiętujemy: okno zabiera fokus, a link ma trafić
    // dokładnie na tekst zaznaczony przed jego otwarciem.
    const selection = snapshot.context.selection
    const active = selectors.getActiveAnnotations(snapshot).find((annotation) => annotation._type === 'link')
    const block = selectors.getFocusTextBlock(snapshot)
    if (active && block) {
      setDialog({ kind: 'link', href: String(active.href ?? ''), annotation: { blockKey: block.node._key, markKey: active._key }, selection })
      return
    }
    if (!selection || selectors.isSelectionCollapsed(snapshot)) {
      // Zaznaczenie z klawiatury trafia do stanu edytora z lekkim opóźnieniem —
      // gdy przeglądarka ma już zaznaczony tekst, próbujemy jeszcze raz.
      const dom = window.getSelection()
      if (attempt < 3 && dom && !dom.isCollapsed) {
        window.setTimeout(() => openLinkDialog(attempt + 1), 40)
        return
      }
      toast('Zaznacz tekst, który ma być linkiem.', { icon: '🔗' })
      return
    }
    setDialog({ kind: 'link', selection })
  }, [editor])

  // Ctrl/Cmd+K — link (jak w Google Docs i Wordzie).
  useEffect(() => {
    const node = surfaceRef.current
    if (!node) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        openLinkDialog()
      }
    }
    node.addEventListener('keydown', onKey, true)
    return () => node.removeEventListener('keydown', onKey, true)
  }, [openLinkDialog, surfaceRef])

  const renderBlock: RenderBlockFunction = useCallback(
    (props) => {
      const key = props.value._key
      const value = props.value as Record<string, any>
      const actions = (onEdit?: () => void) => (
        <BlockActions
          onEdit={onEdit}
          onUp={() => editor.send({ type: 'move.block up', at: [{ _key: key }] })}
          onDown={() => editor.send({ type: 'move.block down', at: [{ _key: key }] })}
          onDelete={() => editor.send({ type: 'delete.block', at: [{ _key: key }] })}
        />
      )
      switch (props.schemaType.name) {
        case 'image': {
          const ref = value.asset?._ref as string | undefined
          const src = imageUrlFromRef(ref, 1400)
          const edit = () => ref && setDialog({ kind: 'image', key, ref, alt: value.alt ?? '', caption: value.caption ?? '' })
          return (
            <ObjectCard selected={props.selected} label="Zdjęcie" actions={actions(edit)} onDoubleClick={edit}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={value.alt ?? ''} className="max-h-[460px] w-full rounded-[14px] bg-surface-muted object-contain" draggable={false} />
              ) : (
                <div className="grid h-40 place-items-center rounded-[14px] bg-surface-muted text-muted">
                  <ImageOff size={20} strokeWidth={1.5} />
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {value.caption ? <span className="text-text-2">{value.caption}</span> : null}
                {!value.alt?.trim() && (
                  <button type="button" onClick={edit} className="font-medium text-danger underline underline-offset-2">
                    Dodaj tekst alternatywny
                  </button>
                )}
              </div>
            </ObjectCard>
          )
        }
        case 'videoEmbed': {
          const parsed = parseVideoUrl(value.url)
          const edit = () =>
            setDialog({
              kind: 'video',
              key,
              value: { provider: value.provider === 'file' ? 'file' : 'external', url: value.url, file: value.file, caption: value.caption },
            })
          const fileUrl = value.provider === 'file' ? fileUrlFromRef(value.file?.asset?._ref) : null
          return (
            <ObjectCard selected={props.selected} label={value.provider === 'file' ? 'Film (plik)' : `Film · ${parsed.provider === 'vimeo' ? 'Vimeo' : 'YouTube'}`} actions={actions(edit)} onDoubleClick={edit}>
              {fileUrl ? (
                <video src={fileUrl} preload="metadata" controls className="aspect-video w-full rounded-[14px] bg-black" />
              ) : parsed.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={parsed.thumbnailUrl.replace('maxresdefault', 'hqdefault')} alt="" className="aspect-video w-full rounded-[14px] object-cover" draggable={false} />
              ) : (
                <div className="grid aspect-video place-items-center rounded-[14px] bg-surface-muted text-xs text-text-2">
                  <Film size={20} strokeWidth={1.5} />
                  {value.url}
                </div>
              )}
              {value.caption && <p className="m-0 mt-2 text-xs text-text-2">{value.caption}</p>}
            </ObjectCard>
          )
        }
        case 'callout': {
          const tone = (value.tone ?? 'tip') as CalloutTone
          const edit = () => setDialog({ kind: 'callout', key, value: { tone, title: value.title, text: value.text ?? '' } })
          return (
            <ObjectCard selected={props.selected} label={`Ramka · ${CALLOUT_TONE_LABELS[tone] ?? 'Wskazówka'}`} actions={actions(edit)} onDoubleClick={edit} bare>
              <div className={cn('rounded-[16px] border px-4 py-3', CALLOUT_CLASS[tone] ?? CALLOUT_CLASS.tip)}>
                <p className="m-0 text-[13px] font-semibold">{value.title?.trim() || CALLOUT_TONE_LABELS[tone]}</p>
                <p className="m-0 mt-1 whitespace-pre-line text-[14px] leading-relaxed text-[#2B2B2B]">{value.text}</p>
              </div>
            </ObjectCard>
          )
        }
        case 'productEmbed': {
          const refs: Array<{ _ref: string; _key: string }> = Array.isArray(value.products) ? value.products : []
          const edit = () =>
            setDialog({
              kind: 'products',
              key,
              value: { title: value.title, products: refs.map((item) => ({ _type: 'reference', _ref: item._ref, _weak: true, _key: item._key })) },
            })
          return (
            <ObjectCard selected={props.selected} label={value.title?.trim() || 'Polecane produkty'} actions={actions(edit)} onDoubleClick={edit}>
              <div className="grid gap-2 sm:grid-cols-2">
                {refs.map((item) => {
                  const product = productMap.get(item._ref)
                  return (
                    <div key={item._key} className="flex items-center gap-3 rounded-[12px] border border-border bg-bg p-2">
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-surface-muted">
                        {product?.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`${product.imageUrl}?w=96&h=96&fit=crop`} alt="" className="size-12 object-cover" draggable={false} />
                        ) : (
                          <ImageOff size={14} strokeWidth={1.5} className="text-muted" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-text">{product?.title ?? 'Produkt usunięty z katalogu'}</span>
                        <span className="block text-[11px] text-text-2">
                          {product?.price != null ? `${product.price.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł` : '—'}
                        </span>
                      </span>
                      {product?.status === 'draft' && <Badge tone="primary">szkic</Badge>}
                    </div>
                  )
                })}
              </div>
            </ObjectCard>
          )
        }
        case 'divider': {
          const style = value.style === 'paws' ? 'paws' : 'line'
          const next = DIVIDER_STYLES[(DIVIDER_STYLES.indexOf(style) + 1) % DIVIDER_STYLES.length]
          return (
            <ObjectCard
              selected={props.selected}
              label={`Separator · ${DIVIDER_STYLE_LABELS[style]}`}
              actions={actions(() => setBlock(key, { style: next }))}
              editLabel={`Zmień na: ${DIVIDER_STYLE_LABELS[next]}`}
              bare
            >
              {style === 'paws' ? (
                <div className="flex items-center justify-center gap-4 py-3 text-[#9CCFC7]">
                  <PawIcon className="size-5 -rotate-12" />
                  <PawIcon className="size-6" />
                  <PawIcon className="size-5 rotate-12" />
                </div>
              ) : (
                <hr className="my-4 h-px border-0 bg-border-strong" />
              )}
            </ObjectCard>
          )
        }
        default:
          // Blok tekstowy — przekazujemy dalej (styl i lista mają własne render*).
          return (
            <div
              className={cn(props.listItem && 'hau-li')}
              data-num={props.listItem === 'number' ? listNumbers.get(key) : undefined}
            >
              {props.children}
            </div>
          )
      }
    },
    [editor, listNumbers, productMap, setBlock],
  )

  return (
    <div ref={surfaceRef} className="hau-blog-editor relative">
      <Toolbar
        uploading={uploading}
        onLink={() => openLinkDialog()}
        onImage={() => imageInput.current?.click()}
        onVideo={() => setDialog({ kind: 'video' })}
        onCallout={() => setDialog({ kind: 'callout' })}
        onProducts={() => setDialog({ kind: 'products' })}
        onDivider={() => insertObject('divider', { style: 'line' })}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = event.target.files
          if (files?.length) void pickImages(Array.from(files))
          event.target.value = ''
        }}
      />

      <PortableTextEditable
        className="hau-blog-editable min-h-[420px] px-1 pt-4 pb-24 text-[16.5px] leading-[1.8] text-text outline-none"
        hotkeys={HOTKEYS}
        spellCheck
        renderBlock={renderBlock}
        renderStyle={renderStyle}
        renderDecorator={renderDecorator}
        renderAnnotation={renderAnnotation}
        renderListItem={renderListItem}
        renderPlaceholder={() => (
          <span className="pointer-events-none text-muted">
            Zacznij pisać… „## ” tworzy śródtytuł, „- ” listę, a przycisk <b>Wstaw</b> dodaje zdjęcia, filmy i ramki.
          </span>
        )}
        onPaste={(data) => {
          // Wklejone pliki graficzne (zrzut ekranu, zdjęcie z pulpitu) — wgrywamy
          // do Sanity zamiast gubić. Tekst i HTML obsługuje sam edytor.
          const files = Array.from(data.event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'))
          if (!files.length) return undefined
          void pickImages(files)
          return { insert: [] }
        }}
      />

      {dialog?.kind === 'link' && (
        <LinkDialog
          initialHref={dialog.href}
          products={products}
          guides={guides}
          onClose={closeDialog}
          onRemove={
            dialog.annotation
              ? () => {
                  if (dialog.selection) editor.send({ type: 'select', at: dialog.selection })
                  editor.send({ type: 'annotation.remove', annotation: { name: 'link' } })
                  closeDialog()
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
            closeDialog()
          }}
        />
      )}
      {dialog?.kind === 'video' && (
        <VideoDialog
          initial={dialog.value}
          onClose={closeDialog}
          onUploadFile={async (file) => {
            const result = await uploadVideo(file)
            return 'error' in result ? result : { ref: result.ref }
          }}
          onSubmit={(value) => {
            if (dialog.key) {
              const unset = ['url', 'file', 'caption'].filter((field) => !(field in value))
              setBlock(dialog.key, { ...value }, unset)
              closeDialog()
            } else {
              setDialog(null)
              insertObject('videoEmbed', { ...value })
            }
          }}
        />
      )}
      {dialog?.kind === 'callout' && (
        <CalloutDialog
          initial={dialog.value}
          onClose={closeDialog}
          onSubmit={(value) => {
            if (dialog.key) {
              setBlock(dialog.key, { ...value }, value.title ? [] : ['title'])
              closeDialog()
            } else {
              setDialog(null)
              insertObject('callout', { ...value })
            }
          }}
        />
      )}
      {dialog?.kind === 'products' && (
        <ProductEmbedDialog
          initial={dialog.value}
          products={products}
          makeKey={keyGenerator}
          onClose={closeDialog}
          onSubmit={(value) => {
            if (dialog.key) {
              setBlock(dialog.key, { ...value }, value.title ? [] : ['title'])
              closeDialog()
            } else {
              setDialog(null)
              insertObject('productEmbed', { ...value })
            }
          }}
        />
      )}
      {dialog?.kind === 'image' && (
        <ImageDialog
          imageRef={dialog.ref}
          initial={{ alt: dialog.alt, caption: dialog.caption }}
          onClose={closeDialog}
          onReplace={async (file) => {
            const result = await uploadImage(file)
            if ('error' in result) {
              toast.error(result.error)
              return null
            }
            return result.ref
          }}
          onSubmit={(value) => {
            const unset = [...(value.alt ? [] : ['alt']), ...(value.caption ? [] : ['caption'])]
            const props: Record<string, unknown> = {
              ...(value.alt && { alt: value.alt }),
              ...(value.caption && { caption: value.caption }),
            }
            // Nowe zdjęcie = nowy kadr; stary hotspot/crop z Studio nie pasuje.
            if (value.ref !== dialog.ref) {
              props.asset = { _type: 'reference', _ref: value.ref }
              unset.push('hotspot', 'crop')
            }
            setBlock(dialog.key, props, unset)
            closeDialog()
          }}
        />
      )}
    </div>
  )
}

const CALLOUT_CLASS: Record<string, string> = {
  tip: 'bg-[#EEF7F5] border-[#BCDFDB] text-[#1F5E54]',
  info: 'bg-[#EEF3FB] border-[#CFDDF3] text-[#274C85]',
  warning: 'bg-[#FDF6E7] border-[#F2DDAA] text-[#7A5410]',
  important: 'bg-[#FCEFEC] border-[#F3CCC3] text-[#8A2E1C]',
}

// ─── renderowanie tekstu w edytorze ──────────────────────────────────────────

const renderStyle: RenderStyleFunction = (props) => {
  switch (props.schemaType.value) {
    case 'h1':
    case 'h2':
      return <h2 className="m-0 mt-8 mb-1 text-[26px] font-semibold leading-tight tracking-[-0.01em] text-text">{props.children}</h2>
    case 'h3':
      return <h3 className="m-0 mt-6 mb-1 text-[21px] font-semibold leading-snug text-text">{props.children}</h3>
    case 'h4':
      return <h4 className="m-0 mt-5 mb-0.5 text-[18px] font-semibold text-text">{props.children}</h4>
    case 'blockquote':
      return (
        <blockquote className="m-0 my-3 border-l-[3px] border-[#9CCFC7] pl-5 text-[19px] font-medium italic leading-relaxed text-text">
          {props.children}
        </blockquote>
      )
    default:
      return <p className="m-0 my-2.5">{props.children}</p>
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
    case 'strike-through':
      return <s>{props.children}</s>
    case 'code':
      return <code className="rounded-[5px] bg-surface-muted px-1 py-0.5 font-mono text-[0.9em]">{props.children}</code>
    default:
      return <>{props.children}</>
  }
}

const renderAnnotation: RenderAnnotationFunction = (props) => {
  if (props.schemaType.name === 'link') {
    const href = String((props.value as { href?: string }).href ?? '')
    return (
      <span className="text-[#1F7A6A] underline decoration-[#1F7A6A]/40 underline-offset-2" title={href}>
        {props.children}
      </span>
    )
  }
  return <>{props.children}</>
}

const renderListItem: RenderListItemFunction = (props) => <>{props.children}</>

// ─── karty bloków ────────────────────────────────────────────────────────────

function ObjectCard({
  label,
  selected,
  actions,
  onDoubleClick,
  bare,
  editLabel,
  children,
}: {
  label: string
  selected: boolean
  actions: React.ReactNode
  onDoubleClick?: () => void
  bare?: boolean
  editLabel?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'group/card relative my-4 rounded-[16px] border transition-colors',
        bare ? 'border-transparent p-1' : 'border-border bg-surface-muted p-3',
        selected ? 'ring-2 ring-primary' : 'hover:border-border-strong'
      )}
      onDoubleClick={onDoubleClick}
      title={editLabel}
    >
      <div
        className={cn(
          'absolute -top-3 right-3 z-10 flex items-center gap-1 rounded-full border border-border bg-bg px-1.5 py-0.5 shadow-pill transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100 focus-within:opacity-100'
        )}
      >
        <span className="px-1 text-[11px] font-medium text-text-2">{label}</span>
        {actions}
      </div>
      {children}
    </div>
  )
}

function BlockActions({ onEdit, onUp, onDown, onDelete }: { onEdit?: () => void; onUp: () => void; onDown: () => void; onDelete: () => void }) {
  const button = 'grid size-6 place-items-center rounded-full text-text-2 hover:bg-surface-muted hover:text-text'
  return (
    <>
      {onEdit && (
        <button type="button" className={button} onClick={onEdit} aria-label="Edytuj blok" title="Edytuj">
          <Pencil size={12} strokeWidth={1.75} />
        </button>
      )}
      <button type="button" className={button} onClick={onUp} aria-label="Przesuń w górę" title="W górę">
        <ArrowUp size={12} strokeWidth={1.75} />
      </button>
      <button type="button" className={button} onClick={onDown} aria-label="Przesuń w dół" title="W dół">
        <ArrowDown size={12} strokeWidth={1.75} />
      </button>
      <button type="button" className={cn(button, 'hover:text-danger')} onClick={onDelete} aria-label="Usuń blok" title="Usuń">
        <Trash2 size={12} strokeWidth={1.75} />
      </button>
    </>
  )
}

// ─── pasek narzędzi ──────────────────────────────────────────────────────────

function Toolbar({
  uploading,
  onLink,
  onImage,
  onVideo,
  onCallout,
  onProducts,
  onDivider,
}: {
  uploading: boolean
  onLink: () => void
  onImage: () => void
  onVideo: () => void
  onCallout: () => void
  onProducts: () => void
  onDivider: () => void
}) {
  const editor = useEditor()
  const activeStyle = useEditorSelector(editor, selectors.getActiveStyle) as GuideStyle | undefined
  const bold = useEditorSelector(editor, selectors.isActiveDecorator('strong'))
  const italic = useEditorSelector(editor, selectors.isActiveDecorator('em'))
  const underline = useEditorSelector(editor, selectors.isActiveDecorator('underline'))
  const strike = useEditorSelector(editor, selectors.isActiveDecorator('strike-through'))
  const code = useEditorSelector(editor, selectors.isActiveDecorator('code'))
  const bullet = useEditorSelector(editor, selectors.isActiveListItem('bullet'))
  const number = useEditorSelector(editor, selectors.isActiveListItem('number'))
  const link = useEditorSelector(editor, selectors.isActiveAnnotation('link', { mode: 'partial' }))
  const inText = useEditorSelector(editor, (snapshot) => Boolean(selectors.getFocusTextBlock(snapshot)))
  const [insertOpen, setInsertOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!insertOpen) return
    const close = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setInsertOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setInsertOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [insertOpen])

  const run = (event: Parameters<Editor['send']>[0]) => {
    editor.send(event)
    editor.send({ type: 'focus' })
  }

  const styleValue = activeStyle && EDITOR_STYLES.includes(activeStyle) ? activeStyle : activeStyle === 'h1' ? 'h2' : 'normal'

  const insertItems = [
    { label: 'Zdjęcie', hint: 'JPG, PNG, WebP — można kilka naraz', icon: ImageIcon, onClick: onImage },
    { label: 'Film', hint: 'YouTube, Vimeo albo plik', icon: Film, onClick: onVideo },
    { label: 'Ramka', hint: 'Wskazówka, uwaga, ważne', icon: Megaphone, onClick: onCallout },
    { label: 'Polecane produkty', hint: 'Kafelki z ceną i linkiem', icon: ShoppingBag, onClick: onProducts },
    { label: 'Separator', hint: 'Oddziela sekcje („---”)', icon: Minus, onClick: onDivider },
  ]

  return (
    <div className="sticky top-[var(--blog-bar,0px)] z-20 -mx-1 flex flex-wrap items-center gap-1 border-b border-border bg-bg/95 px-1 py-2 backdrop-blur">
      <ToolButton label="Cofnij (Ctrl+Z)" onClick={() => run({ type: 'history.undo' })}>
        <Undo2 size={15} strokeWidth={1.75} />
      </ToolButton>
      <ToolButton label="Ponów (Ctrl+Y)" onClick={() => run({ type: 'history.redo' })}>
        <Redo2 size={15} strokeWidth={1.75} />
      </ToolButton>
      <Divider />

      <span className="relative inline-flex">
        <select
          aria-label="Styl akapitu"
          value={styleValue}
          disabled={!inText}
          onChange={(event) => run({ type: 'style.toggle', style: event.target.value })}
          className="pill h-8 w-[172px] cursor-pointer rounded-xs border border-border bg-surface pr-7 pl-2.5 text-xs font-medium text-text outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          {EDITOR_STYLES.map((style) => (
            <option key={style} value={style}>
              {GUIDE_STYLE_LABELS[style]}
            </option>
          ))}
        </select>
        <ChevronDown size={13} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted" />
      </span>
      <Divider />

      <ToolButton label="Pogrubienie (Ctrl+B)" active={bold} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'strong' })}>
        <Bold size={15} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Kursywa (Ctrl+I)" active={italic} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'em' })}>
        <Italic size={15} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Podkreślenie (Ctrl+U)" active={underline} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'underline' })}>
        <Underline size={15} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Przekreślenie (Ctrl+Shift+X)" active={strike} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'strike-through' })}>
        <Strikethrough size={15} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Kod (Ctrl+')" active={code} disabled={!inText} onClick={() => run({ type: 'decorator.toggle', decorator: 'code' })}>
        <Code size={15} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Link (Ctrl+K)" active={link} disabled={!inText} onClick={onLink}>
        <Link2 size={15} strokeWidth={2} />
      </ToolButton>
      <Divider />

      <ToolButton label="Lista punktowana („- ”)" active={bullet} disabled={!inText} onClick={() => run({ type: 'list item.toggle', listItem: 'bullet' })}>
        <List size={15} strokeWidth={2} />
      </ToolButton>
      <ToolButton label="Lista numerowana („1. ”)" active={number} disabled={!inText} onClick={() => run({ type: 'list item.toggle', listItem: 'number' })}>
        <ListOrdered size={15} strokeWidth={2} />
      </ToolButton>
      <Divider />

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setInsertOpen((value) => !value)}
          aria-expanded={insertOpen}
          aria-haspopup="menu"
          className="inline-flex h-8 items-center gap-1.5 rounded-xs bg-text px-3 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={uploading}
        >
          <Plus size={14} strokeWidth={2.25} />
          {uploading ? 'Wgrywanie…' : 'Wstaw'}
        </button>
        {insertOpen && (
          <div role="menu" className="absolute top-10 left-0 z-30 w-64 rounded-md border border-border bg-bg p-1.5 shadow-2 animate-fade-in">
            {insertItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setInsertOpen(false)
                  item.onClick()
                }}
                className="flex w-full items-start gap-3 rounded-xs px-2.5 py-2 text-left hover:bg-surface-muted"
              >
                <item.icon size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-text-2" />
                <span>
                  <span className="block text-xs font-semibold text-text">{item.label}</span>
                  <span className="block text-[11px] text-text-2">{item.hint}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
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
      // mousedown bez preventDefault zabrałby fokus (i zaznaczenie) edytorowi.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-8 place-items-center rounded-xs transition-colors disabled:opacity-40',
        active ? 'bg-text text-bg' : 'text-text-2 hover:bg-surface-muted hover:text-text'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}
