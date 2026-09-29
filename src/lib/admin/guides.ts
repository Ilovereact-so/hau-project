import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import {
  assertDocId,
  baseId,
  deleteDocument,
  draftId,
  publishDocument,
  unpublishDocument,
  uploadImageAsset,
  type PublishState,
} from '@/lib/admin/catalog'
import {
  GUIDE_AUTHOR_MAX,
  GUIDE_EXCERPT_MAX,
  GUIDE_SEO_DESCRIPTION_MAX,
  GUIDE_SEO_TITLE_MAX,
  GUIDE_TITLE_MAX,
  WORDS_PER_MINUTE,
  guideKey,
  publishBlockers,
  sanitizeCover,
  sanitizeGuideBody,
  sanitizeVideo,
  slugifyGuide,
} from '@/lib/guides/content'

/*
 * Blog (poradniki) w panelu admina — warstwa Sanity.
 *
 * Czytamy w perspektywie `raw` (obie wersje dokumentu), tak jak katalog.
 * Różnica względem produktów: artykuł edytuje się jak w Studio —
 *
 *   „Zapisz” (i autozapis)  → zmiany trafiają WYŁĄCZNIE do szkicu `drafts.<id>`,
 *                              opublikowana wersja w sklepie się nie zmienia,
 *   „Opublikuj”              → szkic zastępuje wersję opublikowaną.
 *
 * Dzięki temu można spokojnie przepisywać opublikowany tekst (autozapis co
 * kilka sekund), a czytelnicy widzą zmiany dopiero po publikacji.
 *
 * Współbieżność: klient wysyła `_rev` wersji, którą edytuje. Gdy w międzyczasie
 * ktoś zmienił dokument (Studio, druga karta), zapis kończy się błędem
 * konfliktu zamiast po cichu nadpisać cudzą pracę.
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })
const DRAFT = 'drafts.'
const NOT_VERSION = '!(_id in path("versions.**"))'

export class GuideConflictError extends Error {
  constructor() {
    super('Ten artykuł został zmieniony w innym miejscu (Studio albo inna karta). Wczytaj najnowszą wersję albo nadpisz ją swoją.')
    this.name = 'GuideConflictError'
  }
}

// ─── typy ────────────────────────────────────────────────────────────────────

export type AdminGuideRow = {
  id: string
  status: PublishState
  /** Opublikowany, ale z datą w przyszłości — sklep pokaże go dopiero wtedy. */
  scheduled: boolean
  title: string
  slug: string | null
  excerpt: string | null
  category: { id: string; title: string } | null
  coverRef: string | null
  author: string | null
  publishedAt: string | null
  featured: boolean
  hasVideo: boolean
  words: number
  readingTime: number
  updatedAt: string
}

export type AdminGuideCategory = {
  id: string
  title: string
  slug: string | null
  description: string | null
  order: number
  guideCount: number
  status: PublishState
}

export type GuideImageValue = {
  ref: string
  alt: string
  hotspot?: Record<string, number>
  crop?: Record<string, number>
}

export type GuideVideoValue = {
  provider: 'external' | 'file'
  url?: string
  fileRef?: string
  caption?: string
  poster?: GuideImageValue | null
}

/** Stan artykułu dla edytora (treść szkicu, jeśli istnieje — to ją się edytuje). */
export type GuideEditorDoc = {
  id: string
  rev: string
  status: PublishState
  title: string
  slug: string
  excerpt: string
  categoryId: string | null
  author: string
  publishedAt: string | null
  featured: boolean
  readingTime: number | null
  seoTitle: string
  seoDescription: string
  cover: GuideImageValue | null
  heroVideo: GuideVideoValue | null
  body: unknown[]
  updatedAt: string
  /** Kiedy ostatnio publikowano (data zmiany wersji opublikowanej). */
  publishedVersionAt: string | null
}

export type GuideInput = {
  title: string
  slug: string
  excerpt: string
  categoryId: string | null
  author: string
  publishedAt: string | null
  featured: boolean
  readingTime: number | null
  seoTitle: string
  seoDescription: string
  cover: GuideImageValue | null
  heroVideo: GuideVideoValue | null
  body: unknown[]
}

export type SaveResult = { id: string; rev: string; status: PublishState; updatedAt: string; dropped: string[] }

// ─── lista ───────────────────────────────────────────────────────────────────

type RawGuideRow = {
  _id: string
  _updatedAt: string
  title?: string
  slug?: string
  excerpt?: string
  categoryId?: string
  coverRef?: string
  author?: string
  publishedAt?: string
  featured?: boolean
  readingTime?: number
  hasVideo?: boolean
  text?: string
}

export async function listAdminGuides(): Promise<AdminGuideRow[]> {
  const data = await raw.fetch<{ docs: RawGuideRow[]; categories: Array<{ _id: string; title?: string }> }>(
    `{
      "docs": *[_type == "guide" && ${NOT_VERSION}]{
        _id, _updatedAt, title, "slug": slug.current, excerpt, "categoryId": category._ref,
        "coverRef": coverImage.asset._ref, author, publishedAt, featured, readingTime,
        "hasVideo": defined(heroVideo.url) || defined(heroVideo.file) || count(body[_type == "videoEmbed"]) > 0,
        "text": pt::text(body)
      },
      "categories": *[_type == "guideCategory" && ${NOT_VERSION}]{ _id, title }
    }`,
  )

  const categoryTitles = new Map<string, string>()
  for (const category of data.categories ?? []) {
    const id = baseId(category._id)
    // Szkic kategorii ma nowszą nazwę — nadpisuje opublikowaną.
    if (category._id.startsWith(DRAFT) || !categoryTitles.has(id)) categoryTitles.set(id, category.title?.trim() || '(bez nazwy)')
  }

  const published = new Map<string, RawGuideRow>()
  const drafts = new Map<string, RawGuideRow>()
  for (const doc of data.docs ?? []) {
    if (doc._id.startsWith(DRAFT)) drafts.set(baseId(doc._id), doc)
    else published.set(doc._id, doc)
  }

  const now = Date.now()
  const toRow = (id: string, doc: RawGuideRow, status: PublishState, publishedDoc?: RawGuideRow): AdminGuideRow => {
    const words = (doc.text ?? '').split(/\s+/).filter(Boolean).length
    const categoryId = doc.categoryId ? baseId(doc.categoryId) : null
    // „Zaplanowany” liczymy z wersji OPUBLIKOWANEJ — to ona decyduje o sklepie.
    const livePublishedAt = publishedDoc?.publishedAt
    return {
      id,
      status,
      scheduled: Boolean(publishedDoc && livePublishedAt && new Date(livePublishedAt).getTime() > now),
      title: doc.title?.trim() || '(bez tytułu)',
      slug: doc.slug ?? null,
      excerpt: doc.excerpt ?? null,
      category: categoryId ? { id: categoryId, title: categoryTitles.get(categoryId) ?? '(usunięta kategoria)' } : null,
      coverRef: doc.coverRef ?? null,
      author: doc.author ?? null,
      publishedAt: doc.publishedAt ?? null,
      featured: Boolean(doc.featured),
      hasVideo: Boolean(doc.hasVideo),
      words,
      readingTime: doc.readingTime ?? Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
      updatedAt: doc._updatedAt,
    }
  }

  const rows: AdminGuideRow[] = []
  for (const [id, doc] of published) {
    const draft = drafts.get(id)
    rows.push(toRow(id, draft ?? doc, draft ? 'changed' : 'published', doc))
  }
  for (const [id, doc] of drafts) if (!published.has(id)) rows.push(toRow(id, doc, 'draft'))

  // Najnowsze na górze: data publikacji, a bez niej — ostatnia zmiana.
  const sortKey = (row: AdminGuideRow) => new Date(row.publishedAt ?? row.updatedAt).getTime() || 0
  return rows.sort((a, b) => sortKey(b) - sortKey(a) || a.title.localeCompare(b.title, 'pl'))
}

// ─── pojedynczy artykuł ──────────────────────────────────────────────────────

type RawImage = { asset?: { _ref?: string }; alt?: string; hotspot?: Record<string, number>; crop?: Record<string, number> }
type RawGuideDoc = {
  _id: string
  _rev: string
  _updatedAt: string
  title?: string
  slug?: { current?: string }
  excerpt?: string
  category?: { _ref?: string }
  author?: string
  publishedAt?: string
  featured?: boolean
  readingTime?: number
  seoTitle?: string
  seoDescription?: string
  coverImage?: RawImage
  heroVideo?: {
    provider?: 'external' | 'file'
    url?: string
    file?: { asset?: { _ref?: string } }
    caption?: string
    poster?: RawImage
  }
  body?: unknown[]
  [key: string]: unknown
}

function toImageValue(image?: RawImage | null): GuideImageValue | null {
  const ref = image?.asset?._ref
  if (!ref) return null
  const value: GuideImageValue = { ref, alt: image?.alt ?? '' }
  if (image?.hotspot) value.hotspot = stripUnderscore(image.hotspot)
  if (image?.crop) value.crop = stripUnderscore(image.crop)
  return value
}

function stripUnderscore(value: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [key, number] of Object.entries(value)) if (!key.startsWith('_') && typeof number === 'number') out[key] = number
  return out
}

async function loadVersions(id: string) {
  const safeId = assertDocId(id)
  const docs = await raw.fetch<RawGuideDoc[]>(`*[_id in [$id, $draft] && _type == "guide"]`, { id: safeId, draft: draftId(safeId) })
  return {
    id: safeId,
    published: docs.find((doc) => doc._id === safeId) ?? null,
    draft: docs.find((doc) => doc._id === draftId(safeId)) ?? null,
  }
}

export async function getGuideForEditor(id: string): Promise<GuideEditorDoc | null> {
  const { id: safeId, published, draft } = await loadVersions(id)
  const doc = draft ?? published
  if (!doc) return null
  const status: PublishState = published ? (draft ? 'changed' : 'published') : 'draft'
  const video = doc.heroVideo
  return {
    id: safeId,
    rev: doc._rev,
    status,
    title: doc.title ?? '',
    slug: doc.slug?.current ?? '',
    excerpt: doc.excerpt ?? '',
    categoryId: doc.category?._ref ? baseId(doc.category._ref) : null,
    author: doc.author ?? '',
    publishedAt: doc.publishedAt ?? null,
    featured: Boolean(doc.featured),
    readingTime: typeof doc.readingTime === 'number' ? doc.readingTime : null,
    seoTitle: doc.seoTitle ?? '',
    seoDescription: doc.seoDescription ?? '',
    cover: toImageValue(doc.coverImage),
    heroVideo:
      video && (video.url || video.file?.asset?._ref)
        ? {
            provider: video.provider === 'file' ? 'file' : 'external',
            url: video.url,
            fileRef: video.file?.asset?._ref,
            caption: video.caption,
            poster: toImageValue(video.poster),
          }
        : null,
    body: Array.isArray(doc.body) ? doc.body : [],
    updatedAt: doc._updatedAt,
    publishedVersionAt: published?._updatedAt ?? null,
  }
}

// ─── walidacja i zapis ───────────────────────────────────────────────────────

const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '')

function imageField(value: GuideImageValue | null | undefined) {
  if (!value) return null
  return sanitizeCover({
    asset: { _ref: value.ref },
    alt: value.alt,
    hotspot: value.hotspot,
    crop: value.crop,
  })
}

async function assertSlugFree(slug: string, exceptId?: string) {
  const count = await raw.fetch<number>(
    `count(*[_type == "guide" && slug.current == $slug && !(_id in [$id, $draft]) && ${NOT_VERSION}])`,
    { slug, id: exceptId ?? '', draft: exceptId ? draftId(exceptId) : '' },
  )
  if (count > 0) throw new Error(`Adres „/poradniki/${slug}” jest już zajęty przez inny artykuł. Zmień slug.`)
}

async function assertCategoryExists(categoryId: string) {
  const id = assertDocId(categoryId)
  const published = await raw.fetch<number>(`count(*[_id == $id && _type == "guideCategory"])`, { id })
  // Referencja jest silna, więc kategoria MUSI mieć wersję opublikowaną —
  // inaczej Sanity odrzuci publikację artykułu.
  if (!published) throw new Error('Wybrana kategoria nie istnieje albo nie jest opublikowana. Odśwież listę kategorii.')
  return id
}

type BuiltFields = { set: Record<string, unknown>; unset: string[]; dropped: string[]; slug: string }

async function buildFields(input: GuideInput, exceptId?: string): Promise<BuiltFields> {
  const title = clean(input.title, GUIDE_TITLE_MAX)
  if (!title) throw new Error('Podaj tytuł artykułu.')
  const slug = slugifyGuide(clean(input.slug, 120) || title)
  if (!slug) throw new Error('Nie da się zbudować adresu z tego tytułu — dodaj litery lub cyfry.')
  await assertSlugFree(slug, exceptId)

  const set: Record<string, unknown> = {
    title,
    slug: { _type: 'slug', current: slug },
    featured: Boolean(input.featured),
  }
  const unset: string[] = []
  const optional = (field: string, value: unknown) => {
    if (value === null || value === undefined || value === '') unset.push(field)
    else set[field] = value
  }

  // Zajawka to 1–2 zdania na kafelek — łamania linii spłaszczamy do spacji.
  optional('excerpt', clean(input.excerpt, GUIDE_EXCERPT_MAX))
  optional('author', clean(input.author, GUIDE_AUTHOR_MAX))
  optional('seoTitle', clean(input.seoTitle, GUIDE_SEO_TITLE_MAX))
  optional('seoDescription', clean(input.seoDescription, GUIDE_SEO_DESCRIPTION_MAX))

  if (input.categoryId) set.category = { _type: 'reference', _ref: await assertCategoryExists(input.categoryId) }
  else unset.push('category')

  if (input.publishedAt) {
    const date = new Date(input.publishedAt)
    if (Number.isNaN(date.getTime())) throw new Error('Nieprawidłowa data publikacji.')
    set.publishedAt = date.toISOString()
  } else unset.push('publishedAt')

  const minutes = input.readingTime === null || input.readingTime === undefined ? null : Math.round(Number(input.readingTime))
  if (minutes !== null && (!Number.isFinite(minutes) || minutes < 1 || minutes > 120)) throw new Error('Czas czytania: od 1 do 120 minut (albo puste = automatycznie).')
  optional('readingTime', minutes)

  optional('coverImage', imageField(input.cover))

  let heroVideo: Record<string, unknown> | null = null
  if (input.heroVideo) {
    const video = input.heroVideo
    heroVideo = sanitizeVideo({
      provider: video.provider,
      url: video.url,
      file: video.fileRef ? { asset: { _ref: video.fileRef } } : undefined,
      caption: video.caption,
      poster: video.poster ? { asset: { _ref: video.poster.ref }, alt: video.poster.alt } : undefined,
    })
    if (!heroVideo) throw new Error('Film otwierający: wklej link do YouTube/Vimeo albo usuń film.')
  }
  optional('heroVideo', heroVideo)

  const { body, dropped } = sanitizeGuideBody(input.body)
  set.body = body
  return { set, unset, dropped, slug }
}

function newGuideId(slug: string) {
  // Czytelne i unikalne: slug (do 40 znaków) + losowy sufiks.
  return `guide-${slug.slice(0, 40).replace(/-+$/, '')}-${guideKey().slice(0, 8)}`
}

async function readDraftMeta(id: string) {
  const meta = await raw.fetch<{ _rev: string; _updatedAt: string } | null>(`*[_id == $id][0]{ _rev, _updatedAt }`, { id: draftId(id) })
  if (!meta) throw new Error('Zapis nie został potwierdzony przez Sanity. Spróbuj ponownie.')
  return meta
}

/** Nowy artykuł — od razu jako szkic (do sklepu trafia dopiero po publikacji). */
export async function createGuide(input: GuideInput): Promise<SaveResult> {
  const fields = await buildFields(input)
  const id = newGuideId(fields.slug)
  await raw.create({ _id: draftId(id), _type: 'guide', ...fields.set })
  const meta = await readDraftMeta(id)
  return { id, rev: meta._rev, status: 'draft', updatedAt: meta._updatedAt, dropped: fields.dropped }
}

/**
 * Zapis zmian do szkicu. `baseRev` = `_rev` wersji, od której zaczęła się
 * edycja; `null` wymusza zapis (świadome nadpisanie po konflikcie).
 */
export async function saveGuideDraft(id: string, input: GuideInput, baseRev: string | null): Promise<SaveResult> {
  const { id: safeId, published, draft } = await loadVersions(id)
  const current = draft ?? published
  if (!current) throw new Error('Artykuł nie istnieje (mógł zostać usunięty).')
  if (baseRev && current._rev !== baseRev) throw new GuideConflictError()

  const fields = await buildFields(input, safeId)
  const tx = raw.transaction()
  if (draft) {
    // Patch z ifRevisionID: Sanity odrzuci zapis, jeśli szkic zmienił się
    // pomiędzy odczytem a zapisem (wyścig z Studio).
    tx.patch(draftId(safeId), (patch) => {
      let next = patch.set(fields.set)
      if (fields.unset.length) next = next.unset(fields.unset)
      return baseRev ? next.ifRevisionId(draft._rev) : next
    })
  } else if (published) {
    // Pierwsza zmiana opublikowanego artykułu — szkic powstaje z jego kopii,
    // więc pola spoza edytora (np. dodane w Studio) nie giną.
    const copy: Record<string, unknown> = { ...published, ...fields.set, _id: draftId(safeId), _type: 'guide' }
    for (const field of ['_rev', '_createdAt', '_updatedAt', ...fields.unset]) delete copy[field]
    tx.create(copy as { _id: string; _type: string })
  }
  try {
    await tx.commit()
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    // 409 z Sanity: rewizja się nie zgadza albo szkic powstał równolegle.
    if (/revision|already exists|409/i.test(message)) throw new GuideConflictError()
    throw error
  }
  const meta = await readDraftMeta(safeId)
  return { id: safeId, rev: meta._rev, status: published ? 'changed' : 'draft', updatedAt: meta._updatedAt, dropped: fields.dropped }
}

/**
 * Publikacja: sprawdza wymagania (te same co w Studio), uzupełnia brakującą
 * datę publikacji bieżącą chwilą i przenosi szkic do wersji opublikowanej.
 */
export async function publishGuide(id: string): Promise<{ scheduledFor: string | null }> {
  const { id: safeId, published, draft } = await loadVersions(id)
  const doc = draft ?? published
  if (!doc) throw new Error('Artykuł nie istnieje (mógł zostać usunięty).')

  const blockers = publishBlockers({
    title: doc.title ?? '',
    slug: doc.slug?.current ?? '',
    excerpt: doc.excerpt ?? '',
    categoryId: doc.category?._ref ?? null,
    cover: doc.coverImage?.asset?._ref ? { hasImage: true, alt: doc.coverImage.alt ?? '' } : null,
    publishedAt: doc.publishedAt ?? new Date().toISOString(),
    body: doc.body,
  })
  if (blockers.length) throw new Error(`Nie można opublikować: ${blockers.join(' ')}`)
  if (doc.category?._ref) await assertCategoryExists(doc.category._ref)
  if (doc.slug?.current) await assertSlugFree(doc.slug.current, safeId)

  if (!draft) {
    // Już opublikowany i bez zmian — publikacja nie ma czego przenieść.
    return { scheduledFor: futureDate(doc.publishedAt) }
  }
  if (!draft.publishedAt) {
    await raw.patch(draftId(safeId)).set({ publishedAt: new Date().toISOString() }).commit()
  }
  await publishDocument(safeId)
  const after = await raw.fetch<string | null>(`*[_id == $id][0].publishedAt`, { id: safeId })
  return { scheduledFor: futureDate(after) }
}

function futureDate(value?: string | null) {
  if (!value) return null
  return new Date(value).getTime() > Date.now() ? value : null
}

export async function unpublishGuide(id: string) {
  await unpublishDocument(id)
}

/** Odrzuca zmiany szkicu — zostaje wersja opublikowana. */
export async function discardGuideDraft(id: string) {
  const { id: safeId, published, draft } = await loadVersions(id)
  if (!published) throw new Error('Ten artykuł nie ma wersji opublikowanej — zamiast odrzucać zmiany, usuń szkic.')
  if (!draft) return
  await raw.delete(draftId(safeId))
}

export async function deleteGuide(id: string) {
  await deleteDocument(id)
}

/** Kopia artykułu jako nowy szkic (np. szablon serii poradników). */
export async function duplicateGuide(id: string): Promise<string> {
  const { published, draft } = await loadVersions(id)
  const doc = draft ?? published
  if (!doc) throw new Error('Artykuł nie istnieje (mógł zostać usunięty).')
  const title = clean(`Kopia — ${doc.title ?? 'artykuł'}`, GUIDE_TITLE_MAX)
  let slug = slugifyGuide(`${doc.slug?.current ?? title}-kopia`)
  for (let attempt = 2; attempt < 50; attempt++) {
    const taken = await raw.fetch<number>(`count(*[_type == "guide" && slug.current == $slug])`, { slug })
    if (!taken) break
    slug = slugifyGuide(`${doc.slug?.current ?? title}-kopia-${attempt}`)
  }
  const newId = newGuideId(slug)
  const copy: Record<string, unknown> = { ...doc, _id: draftId(newId), _type: 'guide', title, slug: { _type: 'slug', current: slug }, featured: false }
  for (const field of ['_rev', '_createdAt', '_updatedAt', 'publishedAt']) delete copy[field]
  await raw.create(copy as { _id: string; _type: string })
  return newId
}

/** Wyróżnienie na /poradniki — zmienia OBIE wersje od razu (jak flagi produktów). */
export async function setGuideFeatured(id: string, featured: boolean) {
  const { id: safeId, published, draft } = await loadVersions(id)
  if (!published && !draft) throw new Error('Artykuł nie istnieje (mógł zostać usunięty).')
  const tx = raw.transaction()
  if (published) tx.patch(safeId, (patch) => patch.set({ featured }))
  if (draft) tx.patch(draftId(safeId), (patch) => patch.set({ featured }))
  await tx.commit()
}

// ─── pliki ───────────────────────────────────────────────────────────────────

export async function uploadGuideImage(file: File) {
  const asset = await uploadImageAsset(file)
  return { ref: asset._id, url: asset.url }
}

/** Server Actions mają limit 12 MB na żądanie — większe filmy tylko przez YouTube/Vimeo albo Studio. */
export const GUIDE_VIDEO_MAX_BYTES = 11 * 1024 * 1024
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])

export async function uploadGuideVideo(file: File) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Nie wybrano pliku.')
  if (!VIDEO_TYPES.has(file.type)) throw new Error('Film musi być w formacie MP4, WebM albo MOV.')
  if (file.size > GUIDE_VIDEO_MAX_BYTES) throw new Error('Film jest większy niż 11 MB — wrzuć go na YouTube/Vimeo i wklej link.')
  const buffer = Buffer.from(await file.arrayBuffer())
  const asset = await sanityClient.assets.upload('file', buffer, { filename: file.name || 'film', contentType: file.type })
  return { ref: asset._id, url: asset.url }
}

// ─── kategorie ───────────────────────────────────────────────────────────────

export async function listGuideCategories(): Promise<AdminGuideCategory[]> {
  const data = await raw.fetch<{
    docs: Array<{ _id: string; title?: string; slug?: string; description?: string; order?: number }>
    refs: Array<{ id: string; ref?: string }>
  }>(
    `{
      "docs": *[_type == "guideCategory" && ${NOT_VERSION}]{ _id, title, "slug": slug.current, description, order },
      "refs": *[_type == "guide" && ${NOT_VERSION}]{ "id": _id, "ref": category._ref }
    }`,
  )
  // Artykuł liczymy raz, nawet gdy ma szkic i wersję opublikowaną.
  const perCategory = new Map<string, Set<string>>()
  for (const item of data.refs ?? []) {
    if (!item.ref) continue
    const key = baseId(item.ref)
    const set = perCategory.get(key) ?? new Set<string>()
    set.add(baseId(item.id))
    perCategory.set(key, set)
  }

  const published = new Map<string, (typeof data.docs)[number]>()
  const drafts = new Map<string, (typeof data.docs)[number]>()
  for (const doc of data.docs ?? []) {
    if (doc._id.startsWith(DRAFT)) drafts.set(baseId(doc._id), doc)
    else published.set(doc._id, doc)
  }
  const ids = new Set([...published.keys(), ...drafts.keys()])
  const rows: AdminGuideCategory[] = []
  for (const id of ids) {
    const doc = drafts.get(id) ?? published.get(id)!
    rows.push({
      id,
      title: doc.title?.trim() || '(bez nazwy)',
      slug: doc.slug ?? null,
      description: doc.description ?? null,
      order: typeof doc.order === 'number' ? doc.order : 100,
      guideCount: perCategory.get(id)?.size ?? 0,
      status: published.has(id) ? (drafts.has(id) ? 'changed' : 'published') : 'draft',
    })
  }
  return rows.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'pl'))
}

export type GuideCategoryInput = { title: string; slug?: string | null; description?: string | null; order?: number | null }

function categoryFields(input: GuideCategoryInput) {
  const title = clean(input.title, 80)
  if (!title) throw new Error('Podaj nazwę kategorii.')
  const slug = slugifyGuide(clean(input.slug ?? '', 96) || title)
  if (!slug) throw new Error('Nie da się zbudować adresu z tej nazwy — dodaj litery lub cyfry.')
  const order = input.order === null || input.order === undefined || Number.isNaN(Number(input.order)) ? 100 : Math.round(Number(input.order))
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 300) : ''
  return { title, slug, order: Math.max(0, Math.min(order, 9999)), description }
}

async function assertCategorySlugFree(slug: string, exceptId?: string) {
  const count = await raw.fetch<number>(
    `count(*[_type == "guideCategory" && slug.current == $slug && !(_id in [$id, $draft])])`,
    { slug, id: exceptId ?? '', draft: exceptId ? draftId(exceptId) : '' },
  )
  if (count) throw new Error(`Kategoria o adresie „${slug}” już istnieje.`)
}

/**
 * Kategoria powstaje od razu jako OPUBLIKOWANA — artykuł trzyma do niej silną
 * referencję, a Sanity nie pozwala opublikować dokumentu wskazującego szkic.
 * Pusta kategoria i tak nie pojawia się w filtrach sklepu (patrz GuidesGrid).
 */
export async function createGuideCategory(input: GuideCategoryInput): Promise<AdminGuideCategory> {
  const fields = categoryFields(input)
  await assertCategorySlugFree(fields.slug)
  let id = `guideCategory-${fields.slug}`.slice(0, 100)
  const clash = await raw.fetch<number>(`count(*[_id in [$id, $draft]])`, { id, draft: draftId(id) })
  if (clash) id = `${id}-${guideKey().slice(0, 6)}`
  await raw.create({
    _id: id,
    _type: 'guideCategory',
    title: fields.title,
    slug: { _type: 'slug', current: fields.slug },
    order: fields.order,
    ...(fields.description && { description: fields.description }),
  })
  return { id, title: fields.title, slug: fields.slug, description: fields.description || null, order: fields.order, guideCount: 0, status: 'published' }
}

export async function updateGuideCategory(id: string, input: GuideCategoryInput) {
  const safeId = assertDocId(id)
  const fields = categoryFields(input)
  await assertCategorySlugFree(fields.slug, safeId)
  const ids = await raw.fetch<string[]>(`*[_id in [$id, $draft]]._id`, { id: safeId, draft: draftId(safeId) })
  if (!ids.length) throw new Error('Kategoria nie istnieje (mogła zostać usunięta).')
  const tx = raw.transaction()
  for (const target of ids) {
    tx.patch(target, (patch) => {
      const next = patch.set({ title: fields.title, slug: { _type: 'slug', current: fields.slug }, order: fields.order })
      return fields.description ? next.set({ description: fields.description }) : next.unset(['description'])
    })
  }
  await tx.commit()
}

export async function deleteGuideCategory(id: string) {
  const safeId = assertDocId(id)
  const used = await raw.fetch<number>(`count(*[_type == "guide" && category._ref in [$id, $draft]])`, { id: safeId, draft: draftId(safeId) })
  if (used) throw new Error(`Kategorii używa ${used} ${used === 1 ? 'artykuł' : used < 5 ? 'artykuły' : 'artykułów'} — najpierw przenieś je do innej kategorii.`)
  await deleteDocument(safeId)
}
