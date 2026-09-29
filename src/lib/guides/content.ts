import { parseVideoUrl } from '../video'

/*
 * Kontrakt treści poradnika (bloga) — JEDNO źródło dla trzech miejsc:
 *
 *   - schematu Sanity (sanity/schemaTypes/guide.ts, guideBlocks.ts),
 *   - edytora w panelu admina (components/admin/blog/*),
 *   - renderera sklepu (components/guides/GuideBody.tsx) i spisu treści.
 *
 * Moduł jest czysty (bez importów serwerowych i Reacta): używa go przeglądarka
 * (edytor liczy statystyki i SEO na żywo), serwer (sanityzacja przed zapisem)
 * i Studio. Import względny do `../video`, bo schemat Sanity bywa budowany
 * przez CLI Sanity, które nie zna aliasu `@/`.
 */

// ─── słowniki ────────────────────────────────────────────────────────────────

/** Style akapitu zapisane w schemacie. `h1` zostaje dla starszych wpisów — edytor go nie proponuje. */
export const GUIDE_STYLES = ['normal', 'h1', 'h2', 'h3', 'h4', 'blockquote'] as const
export type GuideStyle = (typeof GUIDE_STYLES)[number]

export const GUIDE_STYLE_LABELS: Record<GuideStyle, string> = {
  normal: 'Akapit',
  h1: 'Nagłówek 1',
  h2: 'Nagłówek sekcji (H2)',
  h3: 'Podtytuł (H3)',
  h4: 'Mały nagłówek (H4)',
  blockquote: 'Cytat',
}

/** Style dostępne w pasku narzędzi edytora (bez H1 — tytuł wpisu jest już H1 strony). */
export const EDITOR_STYLES: GuideStyle[] = ['normal', 'h2', 'h3', 'h4', 'blockquote']

export const GUIDE_DECORATORS = ['strong', 'em', 'underline', 'strike-through', 'code'] as const
export type GuideDecorator = (typeof GUIDE_DECORATORS)[number]

export const GUIDE_LISTS = ['bullet', 'number'] as const
export type GuideList = (typeof GUIDE_LISTS)[number]

export const GUIDE_BLOCK_OBJECTS = ['image', 'videoEmbed', 'callout', 'productEmbed', 'divider'] as const
export type GuideBlockObject = (typeof GUIDE_BLOCK_OBJECTS)[number]

export const CALLOUT_TONES = ['tip', 'info', 'warning', 'important'] as const
export type CalloutTone = (typeof CALLOUT_TONES)[number]
export const CALLOUT_TONE_LABELS: Record<CalloutTone, string> = {
  tip: 'Wskazówka',
  info: 'Dobrze wiedzieć',
  warning: 'Uwaga',
  important: 'Ważne',
}

export const DIVIDER_STYLES = ['line', 'paws'] as const
export type DividerStyle = (typeof DIVIDER_STYLES)[number]
export const DIVIDER_STYLE_LABELS: Record<DividerStyle, string> = {
  line: 'Linia',
  paws: 'Łapki',
}

// Limity — te same co walidacja w schemacie Sanity.
export const GUIDE_TITLE_MAX = 140
export const GUIDE_EXCERPT_MAX = 200
export const GUIDE_SEO_TITLE_MAX = 70
export const GUIDE_SEO_DESCRIPTION_MAX = 160
export const GUIDE_AUTHOR_MAX = 80
export const GUIDE_ALT_MAX = 300
export const GUIDE_CAPTION_MAX = 300
export const GUIDE_BODY_MAX_BLOCKS = 1500
export const PRODUCT_EMBED_MAX = 4
/** Sufiks dokładany do tytułu przez szablon metadanych (`%s — HAU`). */
export const SITE_TITLE_SUFFIX = ' — HAU'

// ─── pomocnicze ──────────────────────────────────────────────────────────────

type Loose = Record<string, unknown>
const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')

/** Slug z polskimi znakami („Żywienie szczeniąt” → „zywienie-szczeniat”). */
export function slugifyGuide(value: string, max = 96): string {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/
const DOC_ID_RE = /^[A-Za-z0-9._-]{1,128}$/
const IMAGE_REF_RE = /^image-[A-Za-z0-9]+-\d+x\d+-[a-z0-9]+$/
const FILE_REF_RE = /^file-[A-Za-z0-9]+-[a-z0-9]+$/

/** Klucz elementu tablicy Sanity (12 znaków hex) — działa w przeglądarce i w Node. */
export function guideKey(): string {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Adres odnośnika: dozwolone http(s), mailto, tel, ścieżki sklepu („/…”)
 * i kotwice („#…”). `null` = odrzucony (np. `javascript:`).
 * „www.przyklad.pl” uzupełniamy o https:// — tak wkleja się linki z paska.
 */
export function normalizeHref(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const href = input.trim()
  if (!href || href.length > 2000) return null
  if (href.startsWith('/')) return href.startsWith('//') ? null : href
  if (href.startsWith('#')) return href.length > 1 ? href : null
  if (/^www\./i.test(href)) return `https://${href}`
  if (/^(mailto|tel):/i.test(href)) return /\s/.test(href) ? null : href
  try {
    const url = new URL(href)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString()
  } catch {
    return null
  }
}

export const isInternalHref = (href: string) => href.startsWith('/') || href.startsWith('#')

/** Tekst bloku tekstowego (spany sklejone). */
export function blockPlainText(block: unknown): string {
  if (!isObject(block) || block._type !== 'block' || !Array.isArray(block.children)) return ''
  return block.children.map((child) => (isObject(child) && typeof child.text === 'string' ? child.text : '')).join('')
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

// ─── spis treści / kotwice ───────────────────────────────────────────────────

export type GuideHeading = { key: string; level: 2 | 3 | 4; text: string; id: string }

/**
 * Nagłówki H2–H4 z identyfikatorami kotwic (unikalne w obrębie wpisu).
 * Ta sama funkcja zasila spis treści w sklepie, atrybuty `id` nagłówków
 * i konspekt w edytorze — dzięki temu link „#sekcja” zawsze trafia.
 * Starsze `h1` w treści traktujemy jak H2 (strona ma już H1 = tytuł).
 */
export function guideHeadings(body: unknown): GuideHeading[] {
  if (!Array.isArray(body)) return []
  const used = new Map<string, number>()
  const result: GuideHeading[] = []
  for (const block of body) {
    if (!isObject(block) || block._type !== 'block' || block.listItem) continue
    const style = block.style
    const level = style === 'h1' || style === 'h2' ? 2 : style === 'h3' ? 3 : style === 'h4' ? 4 : null
    if (!level) continue
    const text = blockPlainText(block).replace(/\s+/g, ' ').trim()
    if (!text) continue
    const base = slugifyGuide(text, 60) || 'sekcja'
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    result.push({
      key: typeof block._key === 'string' ? block._key : `h-${result.length}`,
      level,
      text,
      id: seen ? `${base}-${seen + 1}` : base,
    })
  }
  return result
}

// ─── statystyki ──────────────────────────────────────────────────────────────

export type GuideStats = {
  words: number
  characters: number
  readingTime: number
  headings: number
  images: number
  imagesWithoutAlt: number
  videos: number
  callouts: number
  productEmbeds: number
  internalLinks: number
  externalLinks: number
  paragraphs: number
}

/** 200 słów/min — ta sama stała co `estimateReadingTime` w lib/video.ts. */
export const WORDS_PER_MINUTE = 200

export function guideStats(body: unknown): GuideStats {
  const stats: GuideStats = {
    words: 0,
    characters: 0,
    readingTime: 1,
    headings: 0,
    images: 0,
    imagesWithoutAlt: 0,
    videos: 0,
    callouts: 0,
    productEmbeds: 0,
    internalLinks: 0,
    externalLinks: 0,
    paragraphs: 0,
  }
  if (!Array.isArray(body)) return stats
  for (const block of body) {
    if (!isObject(block)) continue
    switch (block._type) {
      case 'block': {
        const text = blockPlainText(block)
        stats.words += countWords(text)
        stats.characters += text.length
        if (typeof block.style === 'string' && /^h[1-4]$/.test(block.style)) stats.headings++
        else if (text.trim()) stats.paragraphs++
        if (Array.isArray(block.markDefs)) {
          for (const def of block.markDefs) {
            if (!isObject(def) || def._type !== 'link' || typeof def.href !== 'string') continue
            if (isInternalHref(def.href)) stats.internalLinks++
            else stats.externalLinks++
          }
        }
        break
      }
      case 'image':
        stats.images++
        if (!str(block.alt, GUIDE_ALT_MAX).trim()) stats.imagesWithoutAlt++
        break
      case 'videoEmbed':
        stats.videos++
        break
      case 'callout': {
        stats.callouts++
        const text = `${str(block.title, 200)} ${str(block.text, 2000)}`
        stats.words += countWords(text)
        stats.characters += text.trim().length
        break
      }
      case 'productEmbed':
        stats.productEmbeds++
        break
    }
  }
  stats.readingTime = Math.max(1, Math.round(stats.words / WORDS_PER_MINUTE))
  return stats
}

// ─── sanityzacja treści przed zapisem ────────────────────────────────────────

export type SanitizeResult = { body: Loose[]; dropped: string[] }

function uniqueKey(candidate: unknown, used: Set<string>): string {
  let key = typeof candidate === 'string' && KEY_RE.test(candidate) ? candidate : guideKey()
  while (used.has(key)) key = guideKey()
  used.add(key)
  return key
}

function sanitizeImageValue(value: unknown): Loose | null {
  if (!isObject(value) || !isObject(value.asset)) return null
  const ref = value.asset._ref
  if (typeof ref !== 'string' || !IMAGE_REF_RE.test(ref)) return null
  const image: Loose = { _type: 'image', asset: { _type: 'reference', _ref: ref } }
  // Kadrowanie z Studio (hotspot/crop) przepuszczamy tylko jako liczby.
  for (const field of ['hotspot', 'crop'] as const) {
    const source = value[field]
    if (!isObject(source)) continue
    const clean: Loose = { _type: field === 'hotspot' ? 'sanity.imageHotspot' : 'sanity.imageCrop' }
    let valid = true
    for (const prop of field === 'hotspot' ? ['x', 'y', 'height', 'width'] : ['top', 'bottom', 'left', 'right']) {
      const number = source[prop]
      if (typeof number !== 'number' || !Number.isFinite(number)) valid = false
      else clean[prop] = number
    }
    if (valid) image[field] = clean
  }
  return image
}

function sanitizeTextBlock(block: Loose, used: Set<string>): Loose {
  const markKeys = new Set<string>()
  const markDefs: Loose[] = []
  if (Array.isArray(block.markDefs)) {
    for (const def of block.markDefs) {
      if (!isObject(def) || def._type !== 'link') continue
      const href = normalizeHref(def.href)
      if (!href || typeof def._key !== 'string' || !KEY_RE.test(def._key) || markKeys.has(def._key)) continue
      markKeys.add(def._key)
      const clean: Loose = { _type: 'link', _key: def._key, href }
      if (def.blank === true && !isInternalHref(href)) clean.blank = true
      markDefs.push(clean)
    }
  }

  const decorators = new Set<string>(GUIDE_DECORATORS)
  const childKeys = new Set<string>()
  const children: Loose[] = []
  if (Array.isArray(block.children)) {
    for (const child of block.children) {
      // Obiekty śródliniowe nie są w schemacie — zostawiamy tylko tekst.
      if (!isObject(child) || child._type !== 'span') continue
      const marks = Array.isArray(child.marks)
        ? [...new Set(child.marks.filter((mark): mark is string => typeof mark === 'string' && (decorators.has(mark) || markKeys.has(mark))))]
        : []
      children.push({ _type: 'span', _key: uniqueKey(child._key, childKeys), text: str(child.text, 20000), marks })
    }
  }
  if (!children.length) children.push({ _type: 'span', _key: uniqueKey(null, childKeys), text: '', marks: [] })

  // Nieużywane definicje linków (po usunięciu tekstu) nie mają sensu w danych.
  const usedMarks = new Set(children.flatMap((child) => child.marks as string[]))
  const style = GUIDE_STYLES.includes(block.style as GuideStyle) ? (block.style as GuideStyle) : 'normal'
  const clean: Loose = {
    _type: 'block',
    _key: uniqueKey(block._key, used),
    style,
    markDefs: markDefs.filter((def) => usedMarks.has(def._key as string)),
    children,
  }
  if (GUIDE_LISTS.includes(block.listItem as GuideList)) {
    clean.listItem = block.listItem
    const level = Number(block.level)
    clean.level = Number.isInteger(level) && level >= 1 && level <= 6 ? level : 1
  }
  return clean
}

/**
 * Doprowadza treść z edytora (albo z dowolnego żądania) do postaci zgodnej
 * ze schematem: tylko znane typy bloków, style, dekoratory i listy, bezpieczne
 * adresy linków, poprawne referencje do zasobów, unikalne `_key`. Bloki,
 * których nie da się naprawić, są pomijane i wymienione w `dropped`.
 */
export function sanitizeGuideBody(input: unknown): SanitizeResult {
  const dropped: string[] = []
  if (!Array.isArray(input)) return { body: [], dropped: input == null ? [] : ['treść nie jest listą bloków'] }
  if (input.length > GUIDE_BODY_MAX_BLOCKS) {
    throw new Error(`Treść jest zbyt długa (${input.length} bloków, limit ${GUIDE_BODY_MAX_BLOCKS}). Podziel ją na dwa wpisy.`)
  }

  const used = new Set<string>()
  const body: Loose[] = []
  for (const raw of input) {
    if (!isObject(raw) || typeof raw._type !== 'string') {
      dropped.push('nieznany element')
      continue
    }
    switch (raw._type) {
      case 'block':
        body.push(sanitizeTextBlock(raw, used))
        break
      case 'image': {
        const image = sanitizeImageValue(raw)
        if (!image) {
          dropped.push('zdjęcie bez pliku')
          break
        }
        const alt = str(raw.alt, GUIDE_ALT_MAX).trim()
        const caption = str(raw.caption, GUIDE_CAPTION_MAX).trim()
        body.push({ ...image, _key: uniqueKey(raw._key, used), ...(alt && { alt }), ...(caption && { caption }) })
        break
      }
      case 'videoEmbed': {
        const video = sanitizeVideo(raw)
        if (!video) {
          dropped.push('film bez poprawnego linku lub pliku')
          break
        }
        body.push({ ...video, _key: uniqueKey(raw._key, used) })
        break
      }
      case 'callout': {
        const text = str(raw.text, 1500).trim()
        const title = str(raw.title, 120).trim()
        if (!text) {
          dropped.push('pusta ramka')
          break
        }
        const tone = CALLOUT_TONES.includes(raw.tone as CalloutTone) ? raw.tone : 'tip'
        body.push({ _type: 'callout', _key: uniqueKey(raw._key, used), tone, text, ...(title && { title }) })
        break
      }
      case 'productEmbed': {
        const products = sanitizeProductRefs(raw.products)
        if (!products.length) {
          dropped.push('ramka produktów bez produktów')
          break
        }
        const title = str(raw.title, 120).trim()
        body.push({ _type: 'productEmbed', _key: uniqueKey(raw._key, used), products, ...(title && { title }) })
        break
      }
      case 'divider': {
        const style = DIVIDER_STYLES.includes(raw.style as DividerStyle) ? raw.style : 'line'
        body.push({ _type: 'divider', _key: uniqueKey(raw._key, used), style })
        break
      }
      default:
        dropped.push(`nieobsługiwany blok „${raw._type.slice(0, 40)}”`)
    }
  }

  // Końcowe puste akapity (Enter na końcu tekstu) nie niosą treści.
  while (body.length) {
    const last = body[body.length - 1]
    if (last._type === 'block' && !last.listItem && !blockPlainText(last).trim()) body.pop()
    else break
  }
  return { body, dropped }
}

/** Film (otwierający albo w treści). `null` = brak poprawnego źródła. */
export function sanitizeVideo(raw: unknown): Loose | null {
  if (!isObject(raw)) return null
  const caption = str(raw.caption, 200).trim()
  const poster = sanitizeImageValue(raw.poster)
  if (poster && isObject(raw.poster)) {
    const alt = str(raw.poster.alt, GUIDE_ALT_MAX).trim()
    if (alt) poster.alt = alt
  }
  const extras: Loose = { ...(caption && { caption }), ...(poster && { poster }) }

  if (raw.provider === 'file') {
    const file = isObject(raw.file) && isObject(raw.file.asset) ? raw.file.asset._ref : null
    if (typeof file !== 'string' || !FILE_REF_RE.test(file)) return null
    return { _type: 'videoEmbed', provider: 'file', file: { _type: 'file', asset: { _type: 'reference', _ref: file } }, ...extras }
  }
  const url = typeof raw.url === 'string' ? raw.url.trim().slice(0, 500) : ''
  if (!url || !parseVideoUrl(url).embedUrl) return null
  return { _type: 'videoEmbed', provider: 'external', url, ...extras }
}

function sanitizeProductRefs(input: unknown): Loose[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const keys = new Set<string>()
  const refs: Loose[] = []
  for (const item of input) {
    const ref = isObject(item) ? item._ref : item
    if (typeof ref !== 'string' || !DOC_ID_RE.test(ref)) continue
    const id = ref.replace(/^drafts\./, '')
    if (seen.has(id)) continue
    seen.add(id)
    refs.push({ _type: 'reference', _ref: id, _weak: true, _key: uniqueKey(isObject(item) ? item._key : null, keys) })
    if (refs.length >= PRODUCT_EMBED_MAX) break
  }
  return refs
}

/** Okładka wpisu: obraz z wymaganym (przy publikacji) tekstem alternatywnym. */
export function sanitizeCover(raw: unknown): Loose | null {
  const image = sanitizeImageValue(raw)
  if (!image) return null
  const alt = isObject(raw) ? str(raw.alt, GUIDE_ALT_MAX).trim() : ''
  if (alt) image.alt = alt
  return image
}

// ─── SEO i gotowość do publikacji ────────────────────────────────────────────

export type GuideDraftForChecks = {
  title: string
  slug: string
  excerpt: string
  seoTitle?: string | null
  seoDescription?: string | null
  categoryId?: string | null
  cover?: { hasImage: boolean; alt: string } | null
  publishedAt?: string | null
  body: unknown
}

export type CheckLevel = 'ok' | 'info' | 'warn' | 'error'
export type GuideCheck = { id: string; level: CheckLevel; label: string; detail?: string }

/** Tytuł i opis, jakie zobaczy Google (z nadpisaniem SEO, jeśli jest). */
export function effectiveSeo(input: Pick<GuideDraftForChecks, 'title' | 'excerpt' | 'seoTitle' | 'seoDescription'>) {
  const title = (input.seoTitle?.trim() || input.title.trim()) + SITE_TITLE_SUFFIX
  const description = input.seoDescription?.trim() || input.excerpt.trim()
  return { title, description }
}

/**
 * Warunki konieczne publikacji — te same, które wymusza schemat w Studio
 * (inaczej panel opublikowałby wpis, którego Studio potem nie da zapisać).
 */
export function publishBlockers(input: GuideDraftForChecks): string[] {
  const issues: string[] = []
  if (!input.title.trim()) issues.push('Brak tytułu.')
  if (!input.slug.trim()) issues.push('Brak adresu URL (slug).')
  if (!input.excerpt.trim()) issues.push('Brak zajawki (krótkiego opisu).')
  else if (input.excerpt.trim().length > GUIDE_EXCERPT_MAX) issues.push(`Zajawka jest dłuższa niż ${GUIDE_EXCERPT_MAX} znaków.`)
  if (!input.categoryId) issues.push('Nie wybrano kategorii.')
  if (!input.cover?.hasImage) issues.push('Brak okładki.')
  else if (!input.cover.alt.trim()) issues.push('Okładka nie ma tekstu alternatywnego.')
  if (!input.publishedAt || Number.isNaN(new Date(input.publishedAt).getTime())) issues.push('Brak daty publikacji.')
  const stats = guideStats(input.body)
  if (stats.words < 1 && stats.images < 1 && stats.videos < 1) issues.push('Treść jest pusta.')
  return issues
}

/** Lista kontrolna SEO i czytelności pokazywana w edytorze. */
export function guideChecks(input: GuideDraftForChecks): GuideCheck[] {
  const checks: GuideCheck[] = []
  const stats = guideStats(input.body)
  const seo = effectiveSeo(input)

  const titleLength = seo.title.length
  if (!input.title.trim()) checks.push({ id: 'title', level: 'error', label: 'Dodaj tytuł wpisu' })
  else if (titleLength > 60)
    checks.push({ id: 'title', level: 'warn', label: `Tytuł w Google ma ${titleLength} znaków`, detail: 'Powyżej ~60 znaków Google ucina tytuł. Skróć go albo ustaw krótszy „Tytuł SEO”.' })
  else if (titleLength < 30)
    checks.push({ id: 'title', level: 'warn', label: 'Tytuł jest bardzo krótki', detail: 'Dopisz, czego dotyczy poradnik — np. „… — jak to zrobić krok po kroku”.' })
  else checks.push({ id: 'title', level: 'ok', label: `Długość tytułu w Google: ${titleLength} znaków` })

  const descriptionLength = seo.description.length
  if (!descriptionLength) checks.push({ id: 'description', level: 'error', label: 'Dodaj zajawkę — to także opis w Google' })
  else if (descriptionLength > GUIDE_SEO_DESCRIPTION_MAX)
    checks.push({ id: 'description', level: 'warn', label: `Opis ma ${descriptionLength} znaków`, detail: `Google pokazuje ok. ${GUIDE_SEO_DESCRIPTION_MAX} znaków — resztę utnie.` })
  else if (descriptionLength < 70)
    checks.push({ id: 'description', level: 'warn', label: 'Opis jest krótki', detail: 'Najlepiej 120–160 znaków: o czym jest tekst i co czytelnik z niego wyniesie.' })
  else checks.push({ id: 'description', level: 'ok', label: `Opis w Google: ${descriptionLength} znaków` })

  if (!input.slug.trim()) checks.push({ id: 'slug', level: 'error', label: 'Brak adresu URL' })
  else if (input.slug.length > 70) checks.push({ id: 'slug', level: 'warn', label: 'Adres URL jest długi', detail: 'Krótszy adres łatwiej udostępnić — wystarczą 3–6 słów.' })
  else checks.push({ id: 'slug', level: 'ok', label: 'Adres URL jest czytelny' })

  if (!input.cover?.hasImage) checks.push({ id: 'cover', level: 'error', label: 'Dodaj okładkę', detail: 'Widać ją na kafelku, w module na stronie głównej i przy udostępnianiu linku.' })
  else if (!input.cover.alt.trim()) checks.push({ id: 'cover', level: 'error', label: 'Okładka bez tekstu alternatywnego' })
  else checks.push({ id: 'cover', level: 'ok', label: 'Okładka z opisem alternatywnym' })

  if (stats.words < 300)
    checks.push({ id: 'length', level: stats.words < 120 ? 'warn' : 'info', label: `Treść ma ${stats.words} słów`, detail: 'Poradniki, które dobrze się pozycjonują, mają zwykle 600+ słów.' })
  else checks.push({ id: 'length', level: 'ok', label: `Treść: ${stats.words} słów (${stats.readingTime} min czytania)` })

  const body = Array.isArray(input.body) ? input.body : []
  const styles = body
    .filter((block): block is Loose => isObject(block) && block._type === 'block' && !block.listItem)
    .map((block) => block.style)
  if (styles.includes('h1'))
    checks.push({ id: 'h1', level: 'warn', label: 'W treści jest nagłówek H1', detail: 'Tytuł wpisu jest już nagłówkiem H1 strony. W treści używaj H2 i H3.' })
  const levels = styles.filter((style): style is string => typeof style === 'string' && /^h[1-4]$/.test(style)).map((style) => Number(style.slice(1)))
  const skipped = levels.some((level, index) => index > 0 && level - Math.max(levels[index - 1], 1) > 1) || levels[0] > 2
  if (stats.words >= 300 && !levels.length)
    checks.push({ id: 'headings', level: 'warn', label: 'Brak śródtytułów', detail: 'Podziel tekst nagłówkami H2 co kilka akapitów — czytelnicy skanują tekst, a spis treści powstaje z nagłówków.' })
  else if (skipped)
    checks.push({ id: 'headings', level: 'warn', label: 'Nagłówki pomijają poziom', detail: 'Po H2 powinien przyjść H3, nie H4 — tak czytają stronę Google i czytniki ekranu.' })
  else if (levels.length) checks.push({ id: 'headings', level: 'ok', label: `Struktura nagłówków: ${levels.length}` })

  if (stats.imagesWithoutAlt)
    checks.push({ id: 'alt', level: 'warn', label: `Zdjęcia bez opisu alternatywnego: ${stats.imagesWithoutAlt}` })

  if (!stats.internalLinks)
    checks.push({ id: 'links', level: 'info', label: 'Brak linków do sklepu', detail: 'Podlinkuj produkty albo kategorie, o których piszesz — to pomaga i czytelnikom, i SEO.' })
  else checks.push({ id: 'links', level: 'ok', label: `Linki do sklepu: ${stats.internalLinks}` })

  if (!stats.productEmbeds)
    checks.push({ id: 'products', level: 'info', label: 'Brak ramki z produktami', detail: 'Blok „Polecane produkty” pokazuje kafelki z ceną prosto w tekście.' })

  return checks
}
