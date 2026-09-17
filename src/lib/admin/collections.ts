import 'server-only'
import type { PatchOperations } from '@sanity/client'
import { sanityClient } from '@/sanity/sanityClient.server'
import {
  addCollectionRefMutations,
  baseDocId,
  collectionIdForSlug,
  collectionRef,
  removeCollectionRefMutations,
  slugifyCollection,
  type CollectionPatchMutation,
} from '@/sanity/lib/collectionRefs'
import {
  assertDocId,
  deleteDocument,
  draftId,
  invalidateCatalogCache,
  patchAllVersions,
  uploadImageAsset,
  type PublishState,
} from '@/lib/admin/catalog'

/*
 * Kolekcje w panelu admina i w imporcie CSV.
 *
 * Przynależność produktu = słaba referencja w `product.collections`
 * (jedno źródło prawdy — patrz sanity/schemaTypes/collection.ts).
 * Czytamy w perspektywie `raw`, żeby widzieć także szkice kolekcji
 * utworzone automatycznie.
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })
const DRAFT = 'drafts.'

export const COLLECTION_TITLE_MAX = 120

export type AdminCollection = {
  id: string
  status: PublishState
  title: string
  slug: string | null
  description: string | null
  imageUrl: string | null
  imageAlt: string | null
  sort: string | null
  productCount: number
  updatedAt: string
}

export type CollectionOption = { id: string; title: string; status: PublishState }

type RawCollection = {
  _id: string
  _updatedAt: string
  title?: string
  slug?: string
  description?: string
  imageUrl?: string
  imageAlt?: string
  sort?: string
}

/** Kolekcje z obu wersji (opublikowana ma pierwszeństwo w danych, szkic → status). */
export async function listAdminCollections(): Promise<AdminCollection[]> {
  const data = await raw.fetch<{ docs: RawCollection[]; refs: string[][] }>(
    `{
      "docs": *[_type == "collection" && !(_id in path("versions.**"))]{
        _id, _updatedAt, title, "slug": slug.current, description, sort,
        "imageUrl": imageWithAlt.asset->url, "imageAlt": imageWithAlt.alt
      },
      "refs": *[_type == "product" && !(_id in path("drafts.**")) && !(_id in path("versions.**")) && count(collections) > 0].collections[]._ref
    }`,
  )

  // `refs` to spłaszczona lista referencji z opublikowanych produktów.
  const counts = new Map<string, number>()
  for (const ref of (data.refs ?? []).flat()) {
    if (typeof ref === 'string') counts.set(ref, (counts.get(ref) ?? 0) + 1)
  }

  const published = new Map<string, RawCollection>()
  const drafts = new Map<string, RawCollection>()
  for (const doc of data.docs ?? []) {
    if (doc._id.startsWith(DRAFT)) drafts.set(baseDocId(doc._id), doc)
    else published.set(doc._id, doc)
  }

  const toRow = (id: string, doc: RawCollection, status: PublishState): AdminCollection => ({
    id,
    status,
    title: doc.title?.trim() || '(bez nazwy)',
    slug: doc.slug ?? null,
    description: doc.description ?? null,
    imageUrl: doc.imageUrl ?? null,
    imageAlt: doc.imageAlt ?? null,
    sort: doc.sort ?? null,
    productCount: counts.get(id) ?? 0,
    updatedAt: doc._updatedAt,
  })

  const rows: AdminCollection[] = []
  for (const [id, doc] of published) {
    // Szkic zawiera nowsze zmiany — pokazujemy jego treść (to ona trafi do sklepu po publikacji).
    const draft = drafts.get(id)
    rows.push(toRow(id, draft ?? doc, draft ? 'changed' : 'published'))
  }
  for (const [id, doc] of drafts) if (!published.has(id)) rows.push(toRow(id, doc, 'draft'))
  return rows.sort((a, b) => a.title.localeCompare(b.title, 'pl'))
}

export async function listCollectionOptions(): Promise<CollectionOption[]> {
  const rows = await listAdminCollections()
  return rows.map((row) => ({ id: row.id, title: row.title, status: row.status }))
}

function cleanTitle(value: string): string {
  const title = value.replace(/\s+/g, ' ').trim().slice(0, COLLECTION_TITLE_MAX)
  if (!title) throw new Error('Podaj nazwę kolekcji.')
  return title
}

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const count = await raw.fetch<number>(
    `count(*[_type == "collection" && slug.current == $slug && !(_id in [$id, $draft])])`,
    { slug, id: exceptId ?? '', draft: exceptId ? `${DRAFT}${exceptId}` : '' },
  )
  return count > 0
}

/**
 * Znajduje kolekcje po nazwie albo slugu (bez względu na wielkość liter,
 * także wśród szkiców), a brakujące tworzy jako SZKIC z deterministycznym
 * `_id` (`collection-<slug>`) — równoległe/powtórne wywołania nie robią
 * duplikatów. Zwraca identyfikatory w kolejności wejścia, bez powtórzeń.
 */
export async function ensureCollectionsByName(
  names: string[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<{ ids: string[]; created: string[] }> {
  const wanted = new Map<string, string>() // slug → tytuł
  for (const name of names) {
    const title = name.replace(/\s+/g, ' ').trim().slice(0, COLLECTION_TITLE_MAX)
    const slug = slugifyCollection(title)
    if (title && slug && !wanted.has(slug)) wanted.set(slug, title)
  }
  if (!wanted.size) return { ids: [], created: [] }

  const existing = await raw.fetch<Array<{ _id: string; title?: string; slug?: string }>>(
    `*[_type == "collection" && !(_id in path("versions.**"))]{ _id, title, "slug": slug.current }`,
  )
  const bySlug = new Map<string, string>()
  const byTitle = new Map<string, string>()
  for (const doc of existing) {
    const id = baseDocId(doc._id)
    if (doc.slug && !bySlug.has(doc.slug)) bySlug.set(doc.slug, id)
    if (doc.title) {
      const key = slugifyCollection(doc.title)
      if (key && !byTitle.has(key)) byTitle.set(key, id)
    }
  }

  const ids: string[] = []
  const created: string[] = []
  const tx = raw.transaction()
  for (const [slug, title] of wanted) {
    const found = bySlug.get(slug) ?? byTitle.get(slug)
    if (found) {
      if (!ids.includes(found)) ids.push(found)
      continue
    }
    const id = collectionIdForSlug(slug)
    ids.push(id)
    created.push(title)
    tx.createIfNotExists({
      _id: `${DRAFT}${id}`,
      _type: 'collection',
      title,
      slug: { _type: 'slug', current: slug },
      sort: 'newest',
    })
  }
  if (created.length && !dryRun) await tx.commit()
  return { ids, created }
}

/** Referencje do zapisania w `product.collections` (unikalne, z kluczami). */
export function buildCollectionRefs(ids: string[]) {
  const unique = [...new Set(ids.map((id) => assertDocId(id)))]
  return unique.map((id) => collectionRef(id))
}

/**
 * Ustawia kolekcje produktu: istniejące wskazane po id + nowe po nazwie
 * (tworzone jako szkic). `undefined` w obu = bez zmian.
 */
export async function resolveProductCollections(input: {
  collectionIds?: string[] | null
  newCollectionNames?: string[] | null
}): Promise<ReturnType<typeof buildCollectionRefs> | undefined> {
  if (input.collectionIds === undefined && input.newCollectionNames === undefined) return undefined
  const ids = (input.collectionIds ?? []).filter(Boolean).slice(0, 50)
  const names = (input.newCollectionNames ?? []).filter((name) => name.trim()).slice(0, 20)
  if (ids.length) {
    const known = await raw.fetch<string[]>(
      `*[_type == "collection" && (_id in $ids || _id in $drafts)]._id`,
      { ids: ids.map((id) => assertDocId(id)), drafts: ids.map((id) => draftId(id)) },
    )
    const knownBase = new Set(known.map(baseDocId))
    const missing = ids.filter((id) => !knownBase.has(baseDocId(id)))
    if (missing.length) throw new Error('Wybrana kolekcja nie istnieje (mogła zostać usunięta). Odśwież listę.')
  }
  const { ids: createdIds } = await ensureCollectionsByName(names)
  return buildCollectionRefs([...ids, ...createdIds])
}

// ─── edycja kolekcji ──────────────────────────────────────────────────────────

export type CollectionInput = {
  title: string
  slug?: string | null
  description?: string | null
  sort?: string | null
}

const SORTS = new Set(['newest', 'price-asc', 'price-desc', 'title'])

function validateCollectionInput(input: CollectionInput) {
  const title = cleanTitle(input.title)
  const slug = slugifyCollection((input.slug ?? '').trim() || title)
  if (!slug) throw new Error('Nie da się utworzyć adresu z tej nazwy — dodaj litery lub cyfry.')
  const description = (input.description ?? '').trim().slice(0, 600) || null
  const sort = input.sort && SORTS.has(input.sort) ? input.sort : 'newest'
  return { title, slug, description, sort }
}

/** Nowa kolekcja z panelu — zawsze jako szkic (do sklepu po „Opublikuj”). */
export async function createCollectionDraft(input: CollectionInput): Promise<string> {
  const data = validateCollectionInput(input)
  if (await slugTaken(data.slug)) throw new Error(`Adres „${data.slug}” jest już zajęty przez inną kolekcję.`)
  const id = collectionIdForSlug(data.slug)
  const doc: Record<string, unknown> = {
    _id: `${DRAFT}${id}`,
    _type: 'collection',
    title: data.title,
    slug: { _type: 'slug', current: data.slug },
    sort: data.sort,
  }
  if (data.description) doc.description = data.description
  // Deterministyczne id mogło zostać zajęte przez kolekcję, której slug później zmieniono.
  const clash = await raw.fetch<number>(`count(*[_id in [$id, $draft]])`, { id, draft: `${DRAFT}${id}` })
  if (clash) {
    doc._id = `${DRAFT}${id}-${Date.now().toString(36)}`
  }
  await raw.create(doc as { _id: string; _type: string })
  return baseDocId(doc._id as string)
}

export async function updateCollection(id: string, input: CollectionInput) {
  const safeId = assertDocId(id)
  const data = validateCollectionInput(input)
  if (await slugTaken(data.slug, safeId)) throw new Error(`Adres „${data.slug}” jest już zajęty przez inną kolekcję.`)
  const set: Record<string, unknown> = {
    title: data.title,
    slug: { _type: 'slug', current: data.slug },
    sort: data.sort,
  }
  const unset: string[] = []
  if (data.description) set.description = data.description
  else unset.push('description')
  await patchAllVersions(safeId, { set, unset })
}

export async function setCollectionImage(id: string, file: File, alt: string) {
  const asset = await uploadImageAsset(file)
  await patchAllVersions(id, {
    set: {
      imageWithAlt: {
        _type: 'image',
        asset: { _type: 'reference', _ref: asset._id },
        alt: (alt.trim() || 'Zdjęcie kolekcji').slice(0, 200),
      },
    },
  })
  return asset.url
}

export async function removeCollectionImage(id: string) {
  await patchAllVersions(id, { unset: ['imageWithAlt'] })
}

/** Publikację blokuje brak adresu — strona kolekcji nie miałaby URL-a. */
export async function assertCollectionPublishable(id: string) {
  const safeId = assertDocId(id)
  const doc = await raw.fetch<{ title?: string; slug?: string } | null>(
    `coalesce(*[_id == $draft][0], *[_id == $id][0]){ title, "slug": slug.current }`,
    { id: safeId, draft: `${DRAFT}${safeId}` },
  )
  if (!doc) throw new Error('Kolekcja nie istnieje.')
  if (!doc.title?.trim()) throw new Error('Uzupełnij nazwę kolekcji przed publikacją.')
  if (!doc.slug) throw new Error('Uzupełnij adres (slug) kolekcji przed publikacją.')
}

// ─── produkty w kolekcji ──────────────────────────────────────────────────────

async function productVersionIds(productId: string): Promise<string[]> {
  const safeId = assertDocId(productId)
  const ids = await raw.fetch<string[]>(`*[_id in [$id, $draft]]._id`, { id: safeId, draft: `${DRAFT}${safeId}` })
  if (!ids.length) throw new Error('Produkt nie istnieje (mógł zostać usunięty).')
  return ids
}

export async function addProductsToCollection(collectionId: string, productIds: string[]) {
  const safeCollection = assertDocId(collectionId)
  const unique = [...new Set(productIds.map((id) => assertDocId(id)))].slice(0, 200)
  if (!unique.length) return 0
  const tx = raw.transaction()
  let count = 0
  for (const productId of unique) {
    for (const mutation of addCollectionRefMutations(await productVersionIds(productId), safeCollection)) {
      tx.patch(mutation.patch.id, stripId(mutation.patch))
    }
    count++
  }
  await tx.commit()
  await invalidateCatalogCache()
  return count
}

export async function removeProductFromCollection(collectionId: string, productId: string) {
  const safeCollection = assertDocId(collectionId)
  const tx = raw.transaction()
  for (const mutation of removeCollectionRefMutations(await productVersionIds(productId), safeCollection)) {
    tx.patch(mutation.patch.id, stripId(mutation.patch))
  }
  await tx.commit()
  await invalidateCatalogCache()
}

function stripId(patch: CollectionPatchMutation['patch']): PatchOperations {
  const { id, ...ops } = patch
  return ops
}

export type CollectionProduct = {
  id: string
  title: string
  sku: string | null
  imageUrl: string | null
  status: PublishState
}

export async function listCollectionProducts(collectionId: string): Promise<CollectionProduct[]> {
  const safeId = assertDocId(collectionId)
  const docs = await raw.fetch<Array<{ _id: string; title?: string; sku?: string; imageUrl?: string }>>(
    `*[_type == "product" && !(_id in path("versions.**")) && $id in collections[]._ref]{ _id, title, sku, "imageUrl": images[0].asset->url }`,
    { id: safeId },
  )
  const map = new Map<string, CollectionProduct & { hasPublished: boolean; hasDraft: boolean }>()
  for (const doc of docs) {
    const id = baseDocId(doc._id)
    const isDraft = doc._id.startsWith(DRAFT)
    const prev = map.get(id)
    const hasPublished = Boolean(prev?.hasPublished) || !isDraft
    const hasDraft = Boolean(prev?.hasDraft) || isDraft
    const base = prev && isDraft ? prev : { id, title: doc.title || '(bez nazwy)', sku: doc.sku ?? null, imageUrl: doc.imageUrl ?? null }
    map.set(id, {
      ...base,
      hasPublished,
      hasDraft,
      status: hasPublished ? (hasDraft ? 'changed' : 'published') : 'draft',
    })
  }
  return [...map.values()]
    .map(({ hasPublished: _p, hasDraft: _d, ...row }) => row)
    .sort((a, b) => a.title.localeCompare(b.title, 'pl'))
}

/**
 * Usunięcie kolekcji: najpierw zdejmujemy referencje z produktów (słabe
 * referencje nie blokują usunięcia, ale zostawiłyby „wiszące” wpisy),
 * potem oba warianty dokumentu. Banery tracą link (przycisk się ukryje).
 */
export async function deleteCollection(id: string) {
  const safeId = assertDocId(id)
  const productIds = await raw.fetch<string[]>(
    `*[_type == "product" && !(_id in path("versions.**")) && $id in collections[]._ref]._id`,
    { id: safeId },
  )
  if (productIds.length) {
    const tx = raw.transaction()
    for (const mutation of removeCollectionRefMutations(productIds, safeId)) {
      tx.patch(mutation.patch.id, stripId(mutation.patch))
    }
    await tx.commit()
  }
  await deleteDocument(safeId)
}
