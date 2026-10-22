'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, ExternalLink, House, ImageOff, LayoutList, Loader2, PawPrint, Pin, Plus, RotateCcw, Save, Trash2,
} from 'lucide-react'
import { adminPreviewHomeSection, adminSaveHomeLayout } from '@/actions/adminHome'
import { AboutEditor, SocialLinksCard } from './HomeAboutEditor'
import { ProductListPicker } from './ProductListPicker'
import type { HomeEditorData, PreviewItem } from '@/lib/admin/homeLayout'
import {
  HOME_ORDERS, HOME_ORDER_LABELS, HOME_STATIC_LABELS, LIMIT_MAX, LIMIT_MIN, PRODUCT_SOURCES, PRODUCT_SOURCE_LABELS,
  defaultHomeLayout, describeSection, newProductsSection, sectionProblems,
  type HomeAbout, type HomeLayoutData, type HomeProductsSection, type HomeSection,
} from '@/lib/homeLayout'
import { Badge } from '../kit/Badge'
import { Button, IconButton } from '../kit/Button'
import { Card, CardHeader } from '../kit/Card'
import { ErrorBox, NoticeBox } from '../kit/EmptyState'
import { SelectField, TextField } from '../kit/TextField'
import { Toggle } from '../kit/Toggle'
import { formatCurrencyPrecise } from '../kit/format'
import { cn } from '../kit/utils'

/*
 * Marketing → Strona główna. Lista sekcji pod banerem (kolejność, włącz/wyłącz)
 * i edytor karuzeli z podglądem liczonym przez serwer tą samą funkcją co sklep
 * (lib/homeLayout.server.ts). Zmiany trafiają do sklepu po „Zapisz”.
 */

const SNAPSHOT = (layout: Pick<HomeLayoutData, 'sections' | 'about'>) => JSON.stringify({ sections: layout.sections, about: layout.about })

export function HomeLayoutEditor({ data }: { data: HomeEditorData }) {
  const router = useRouter()
  const [sections, setSections] = useState<HomeSection[]>(data.layout.sections)
  const [about, setAbout] = useState<HomeAbout>(data.layout.about)
  const [aboutBusy, setAboutBusy] = useState(false)
  const [savedSnapshot, setSavedSnapshot] = useState(() => SNAPSHOT(data.layout))
  const [selectedKey, setSelectedKey] = useState<string | null>(
    () => data.layout.sections.find((s) => s.kind === 'products')?.key ?? null,
  )
  const [error, setError] = useState('')
  const [saving, startSaving] = useTransition()

  const dirty = SNAPSHOT({ sections, about }) !== savedSnapshot || !data.saved
  const selected = sections.find((s) => s.key === selectedKey && s.kind === 'products') as HomeProductsSection | undefined
  const aboutSelected = sections.some((s) => s.key === selectedKey && s.kind === 'about')

  // Ostrzeżenie przed utratą niezapisanych zmian.
  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const update = (key: string, patch: Partial<HomeProductsSection>) =>
    setSections((current) => current.map((s) => (s.key === key && s.kind === 'products' ? { ...s, ...patch } : s)))

  const move = (index: number, delta: number) =>
    setSections((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  const toggleEnabled = (key: string) =>
    setSections((current) => current.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)))

  const remove = (key: string) => {
    const section = sections.find((s) => s.key === key)
    if (!section || section.kind !== 'products') return
    if (!window.confirm(`Usunąć karuzelę „${section.title}”?`)) return
    setSections((current) => current.filter((s) => s.key !== key))
    if (selectedKey === key) setSelectedKey(null)
  }

  const add = () => {
    const section = newProductsSection()
    setSections((current) => [...current, section])
    setSelectedKey(section.key)
  }

  const duplicate = (section: HomeProductsSection) => {
    const copy = { ...newProductsSection(), ...section, key: newProductsSection().key, title: `${section.title} (kopia)` }
    setSections((current) => {
      const index = current.findIndex((s) => s.key === section.key)
      const next = [...current]
      next.splice(index + 1, 0, copy)
      return next
    })
    setSelectedKey(copy.key)
  }

  const resetDefaults = () => {
    if (!window.confirm('Przywrócić domyślny układ strony głównej? Twoje karuzele zostaną zastąpione (zmiana zapisze się dopiero po „Zapisz”).')) return
    const layout = defaultHomeLayout()
    setSections(layout.sections)
    setSelectedKey(layout.sections.find((s) => s.kind === 'products')?.key ?? null)
  }

  const save = () =>
    startSaving(async () => {
      setError('')
      const warnings = sections.filter((s) => s.enabled).flatMap((s) => sectionProblems(s).map((p) => `${s.kind === 'products' ? s.title : ''}: ${p}`))
      if (warnings.length && !window.confirm(`Uwagi przed zapisem:\n\n${warnings.join('\n')}\n\nZapisać mimo to?`)) return
      const result = await adminSaveHomeLayout({ sections, about })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setSections(result.data.sections)
      setAbout(result.data.about)
      setSavedSnapshot(SNAPSHOT(result.data))
      toast.success('Strona główna zapisana — sklep pokazuje nowy układ')
      router.refresh()
    })

  return (
    <section className="flex flex-col gap-4 animate-fade-in">
      <Card className="flex flex-col">
        <CardHeader
          icon={House}
          title="Sekcje strony głównej"
          subtitle="Kolejność od góry (pod banerem). Karuzele liczą produkty same z reguły — źródła, kolejności i filtrów."
          actions={
            <>
              <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-center text-xs font-medium text-text-2 hover:text-text">
                Zobacz stronę <ExternalLink size={12} strokeWidth={1.5} />
              </a>
              <Button size="sm" variant="ghost" onClick={resetDefaults}>
                <RotateCcw size={14} strokeWidth={1.5} />
                Domyślny układ
              </Button>
              <Button size="sm" onClick={save} disabled={saving || aboutBusy || !dirty}>
                <Save size={14} strokeWidth={1.5} />
                {saving ? 'Zapisuję…' : dirty ? 'Zapisz' : 'Zapisano'}
              </Button>
            </>
          }
        />
        <div className="grid gap-4 px-4 pt-3 pb-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-2">
            {!data.saved && (
              <NoticeBox className="border-primary/30 bg-primary/5">
                To domyślny układ — sklep używa go, dopóki nie zapiszesz własnego.
              </NoticeBox>
            )}
            <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
              {sections.map((section, index) => {
                const isProducts = section.kind === 'products'
                const editable = isProducts || section.kind === 'about'
                const active = section.key === selectedKey
                const problems = sectionProblems(section)
                return (
                  <li
                    key={section.key}
                    className={cn(
                      'flex items-center gap-2 rounded-xs border px-2 py-2 transition-colors',
                      active ? 'border-primary/50 bg-primary/5' : 'border-border bg-surface',
                      !section.enabled && 'opacity-60',
                    )}
                  >
                    <GripVertical size={14} strokeWidth={1.5} className="shrink-0 text-muted" aria-hidden />
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => setSelectedKey(section.key)}
                      className={cn('min-w-0 flex-1 text-left', editable ? 'cursor-pointer' : 'cursor-default')}
                    >
                      <span className="flex items-center gap-1.5">
                        {isProducts ? <LayoutList size={13} strokeWidth={1.5} className="shrink-0 text-primary" /> : null}
                        {section.kind === 'about' ? <PawPrint size={13} strokeWidth={1.5} className="shrink-0 text-primary" /> : null}
                        <strong className="truncate text-xs font-medium text-text">
                          {isProducts ? section.title || '(bez tytułu)' : HOME_STATIC_LABELS[section.kind].title}
                        </strong>
                        {problems.length > 0 && section.enabled && <Badge tone="danger">uwaga</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-text-2">
                        {isProducts ? describeSection(section) : HOME_STATIC_LABELS[section.kind].hint}
                      </span>
                    </button>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <IconButton label="W górę" className="size-7" disabled={index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp size={13} strokeWidth={1.5} />
                      </IconButton>
                      <IconButton label="W dół" className="size-7" disabled={index === sections.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown size={13} strokeWidth={1.5} />
                      </IconButton>
                      <IconButton label={section.enabled ? 'Ukryj na stronie' : 'Pokaż na stronie'} className="size-7" onClick={() => toggleEnabled(section.key)}>
                        {section.enabled ? <Eye size={13} strokeWidth={1.5} /> : <EyeOff size={13} strokeWidth={1.5} />}
                      </IconButton>
                      {isProducts && (
                        <IconButton label="Usuń karuzelę" className="size-7 text-danger" onClick={() => remove(section.key)}>
                          <Trash2 size={13} strokeWidth={1.5} />
                        </IconButton>
                      )}
                    </span>
                  </li>
                )
              })}
            </ol>
            <Button variant="secondary" onClick={add}>
              <Plus size={14} strokeWidth={1.5} />
              Dodaj karuzelę produktów
            </Button>
            {error && <ErrorBox>{error}</ErrorBox>}
          </div>

          {aboutSelected ? (
            <AboutEditor value={about} onChange={setAbout} onBusyChange={setAboutBusy} social={data.social} />
          ) : selected ? (
            <SectionEditor
              key={selected.key}
              section={selected}
              data={data}
              onChange={(patch) => update(selected.key, patch)}
              onDuplicate={() => duplicate(selected)}
            />
          ) : (
            <div className="grid place-items-center rounded-xs border border-dashed border-border-strong bg-bg p-8 text-center text-xs text-text-2">
              Wybierz karuzelę albo „O nas” z listy, albo dodaj nową karuzelę. Stałe moduły (pasek zalet, subkategorie, poradniki) można przestawiać i ukrywać.
            </div>
          )}
        </div>
      </Card>

      <SocialLinksCard initial={data.social} />
    </section>
  )
}

// ─── edytor jednej karuzeli ───────────────────────────────────────────────────

function SectionEditor({
  section,
  data,
  onChange,
  onDuplicate,
}: {
  section: HomeProductsSection
  data: HomeEditorData
  onChange: (patch: Partial<HomeProductsSection>) => void
  onDuplicate: () => void
}) {
  const refOptions =
    section.source === 'collection'
      ? data.collections.map((c) => ({ value: c.id, label: c.status === 'draft' ? `${c.title} (szkic — niewidoczna)` : c.title }))
      : section.source === 'category'
        ? data.categories.map((c) => ({ value: c.id, label: c.title }))
        : section.source === 'subcategory'
          ? data.subcategories.map((s) => {
              const parent = data.categories.find((c) => c.id === s.parentId)
              return { value: s.id, label: parent ? `${parent.title} › ${s.title}` : s.title }
            })
          : []
  const needsRef = section.source === 'collection' || section.source === 'category' || section.source === 'subcategory'
  const problems = sectionProblems(section)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Tytuł karuzeli" value={section.title} maxLength={80} onChange={(e) => onChange({ title: e.target.value })} />
        <TextField
          label="Podtytuł (opcjonalnie)"
          value={section.subtitle ?? ''}
          maxLength={160}
          placeholder="np. Wybór naszego zespołu na jesień"
          onChange={(e) => onChange({ subtitle: e.target.value })}
        />
      </div>

      <fieldset className="grid gap-3 rounded-xs border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-text">Skąd brać produkty</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRODUCT_SOURCES.map((source) => (
            <button
              key={source}
              type="button"
              onClick={() =>
                onChange({
                  source,
                  ref: null,
                  order: source === 'manual' ? 'manual' : section.order === 'manual' ? 'popular' : section.order,
                })
              }
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                section.source === source ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-2 hover:text-text',
              )}
            >
              {PRODUCT_SOURCE_LABELS[source]}
            </button>
          ))}
        </div>
        {needsRef && (
          <SelectField
            label={PRODUCT_SOURCE_LABELS[section.source]}
            value={section.ref?.id ?? ''}
            options={[{ value: '', label: '— wybierz —' }, ...refOptions]}
            onChange={(e) => {
              const option = refOptions.find((o) => o.value === e.target.value)
              onChange({ ref: option ? { id: option.value, title: option.label } : null })
            }}
          />
        )}
        {section.source === 'manual' && (
          <ProductListPicker
            label="Produkty karuzeli (w tej kolejności)"
            hint="Kolejność na liście = kolejność w karuzeli, gdy wybrana jest „Kolejność ręczna”."
            ids={section.productIds}
            products={data.products}
            sortable
            onChange={(productIds) => onChange({ productIds })}
          />
        )}
      </fieldset>

      <fieldset className="grid gap-3 rounded-xs border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-text">Kolejność i filtry</legend>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <SelectField
            label="Kolejność"
            value={section.order}
            hint={HOME_ORDER_LABELS[section.order].hint}
            options={HOME_ORDERS.filter((o) => o !== 'manual' || section.source === 'manual').map((o) => ({ value: o, label: HOME_ORDER_LABELS[o].title }))}
            onChange={(e) => onChange({ order: e.target.value as HomeProductsSection['order'] })}
          />
          <TextField
            label={`Ile produktów (${LIMIT_MIN}–${LIMIT_MAX})`}
            type="number"
            min={LIMIT_MIN}
            max={LIMIT_MAX}
            value={section.limit}
            onChange={(e) => onChange({ limit: Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Number(e.target.value) || LIMIT_MIN)) })}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          <ToggleRow label="Tylko dostępne (na stanie)" checked={section.onlyInStock} onChange={(v) => onChange({ onlyInStock: v })} />
          <ToggleRow label="Tylko promowane" checked={section.onlyFeatured} onChange={(v) => onChange({ onlyFeatured: v })} />
          <ToggleRow label="Tylko bestsellery" checked={section.onlyBestseller} onChange={(v) => onChange({ onlyBestseller: v })} />
          <ToggleRow label="Tylko w promocji (obniżka)" checked={section.onlyDiscounted} onChange={(v) => onChange({ onlyDiscounted: v })} />
          <ToggleRow label="Tylko nowości" checked={section.onlyNew} onChange={(v) => onChange({ onlyNew: v })} />
          {(section.source === 'collection' || section.source === 'subcategory') && (
            <ToggleRow label="Link „Zobacz wszystkie”" checked={section.showMoreLink} onChange={(v) => onChange({ showMoreLink: v })} />
          )}
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-xs border border-border p-3">
        <legend className="px-1 text-xs font-semibold text-text">Ręczne poprawki</legend>
        <ProductListPicker
          label="Przypięte na początek"
          hint="Zawsze pierwsze w karuzeli — niezależnie od źródła, kolejności i filtrów."
          icon={<Pin size={12} strokeWidth={1.5} />}
          ids={section.pinnedIds}
          products={data.products}
          sortable
          onChange={(pinnedIds) => onChange({ pinnedIds })}
        />
        <ProductListPicker
          label="Nigdy nie pokazuj"
          hint="Wykluczone z tej karuzeli, nawet jeśli pasują do reguły."
          icon={<EyeOff size={12} strokeWidth={1.5} />}
          ids={section.excludedIds}
          products={data.products}
          onChange={(excludedIds) => onChange({ excludedIds })}
        />
      </fieldset>

      {problems.length > 0 && (
        <NoticeBox className="border-danger/30 bg-danger/5">
          {problems.map((p) => (
            <p key={p} className="m-0 text-danger">
              {p}
            </p>
          ))}
        </NoticeBox>
      )}

      <SectionPreview section={section} />

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" onClick={onDuplicate}>
          <Plus size={14} strokeWidth={1.5} />
          Duplikuj karuzelę
        </Button>
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-text-2">
      <Toggle checked={checked} onChange={() => onChange(!checked)} label={label} />
      {label}
    </label>
  )
}

function SectionPreview({ section }: { section: HomeProductsSection }) {
  const [state, setState] = useState<{ loading: boolean; items: PreviewItem[]; moreHref: string | null; error: string }>({
    loading: true,
    items: [],
    moreHref: null,
    error: '',
  })
  const requestId = useRef(0)
  const signature = JSON.stringify({ ...section, title: '', subtitle: '' })

  useEffect(() => {
    const id = ++requestId.current
    setState((s) => ({ ...s, loading: true }))
    const timer = setTimeout(async () => {
      const result = await adminPreviewHomeSection(JSON.parse(signature))
      if (id !== requestId.current) return
      setState(
        result.ok
          ? { loading: false, items: result.data.items, moreHref: result.data.moreHref, error: '' }
          : { loading: false, items: [], moreHref: null, error: result.error },
      )
    }, 450)
    return () => clearTimeout(timer)
  }, [signature])

  return (
    <div className="grid gap-2 rounded-xs border border-border bg-surface-muted/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-xs text-text">
          Podgląd — tak zobaczy to klient {state.loading && <Loader2 size={12} className="ml-1 inline animate-spin" />}
        </strong>
        <span className="text-[11px] text-text-2">
          {state.items.length} z maks. {section.limit}
          {state.moreHref && (
            <>
              {' · '}
              <a href={state.moreHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                Zobacz wszystkie
              </a>
            </>
          )}
        </span>
      </div>
      {state.error ? (
        <ErrorBox>{state.error}</ErrorBox>
      ) : !state.loading && !state.items.length ? (
        <p className="m-0 text-[11px] text-text-2">
          Żaden opublikowany produkt nie pasuje do reguły — pusta karuzela nie pojawi się na stronie. Poluzuj filtry albo zmień źródło.
        </p>
      ) : (
        <ol className={cn('m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 p-0', state.loading && 'opacity-50')}>
          {state.items.map((item, index) => (
            <li key={item.id} className="relative overflow-hidden rounded-xs border border-border bg-surface">
              <span className="absolute top-1 left-1 rounded-full bg-black/70 px-1.5 text-[10px] font-semibold text-white">{index + 1}</span>
              {item.pinned && (
                <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-primary text-white" title="Przypięty">
                  <Pin size={10} strokeWidth={2} />
                </span>
              )}
              <div className="aspect-square bg-surface-muted">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="grid size-full place-items-center text-muted">
                    <ImageOff size={16} strokeWidth={1.5} />
                  </span>
                )}
              </div>
              <div className="px-1.5 py-1">
                <p className="m-0 line-clamp-2 text-[11px] leading-tight text-text">{item.title}</p>
                <p className="m-0 mt-0.5 text-[10px] text-text-2">
                  {item.price !== null ? formatCurrencyPrecise(item.price) : '—'}
                  {item.badges.length > 0 && ` · ${item.badges.join(', ')}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="m-0 text-[11px] text-text-2">Podgląd pokazuje tylko opublikowane produkty — szkice nie trafiają na stronę główną.</p>
    </div>
  )
}
