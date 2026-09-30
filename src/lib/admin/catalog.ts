import 'server-only'
import { randomUUID } from 'crypto'
import { sanityClient } from '@/sanity/sanityClient.server'
import { redis } from '@/lib/redis'
import { LOW_STOCK_THRESHOLD, invalidateLowStockCounter } from '@/lib/admin/counters'

/*
 * Warstwa Sanity dla panelu admina.
 *
 * Sklep czyta dane w perspektywie `published`, więc to, czy produkt jest
 * „w sklepie”, zależy od istnienia OPUBLIKOWANEJ wersji dokumentu:
 *
 *   tylko `<id>`                → published (w sklepie)
 *   `<id>` + `drafts.<id>`      → changed   (w sklepie, w Studio czekają zmiany)
 *   tylko `drafts.<id>`         → draft     (niewidoczny w sklepie)
 *
 * Dlatego panel czyta katalog w perspektywie `raw` (widzi obie wersje),
 * a każda edycja z panelu trafia do OBU istniejących wersji — inaczej
 * późniejsza publikacja szkicu w Studio cofnęłaby zmianę z panelu.
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })

const DRAFT_PREFIX = 'drafts.'
const PRODUCTS_CACHE_KEY = 'admin:products:list:v4'
const PRODUCTS_CACHE_TTL = 60

export const baseId = (id: string) => (id.startsWith(DRAFT_PREFIX) ? id.slice(DRAFT_PREFIX.length) : id)
export const draftId = (id: string) => `${DRAFT_PREFIX}${baseId(id)}`

/** Sanity dopuszcza w `_id` litery, cyfry, `-`, `_` i `.` — nic innego nie wpuszczamy do zapytań. */
export function assertDocId(id: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) throw new Error('Nieprawidłowy identyfikator dokumentu.')
  return baseId(id)
}

function assertKey(key: string): string {
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(key)) throw new Error('Nieprawidłowy klucz elementu.')
  return key
}

export type PublishState = 'published' | 'changed' | 'draft'

export type AdminVariant = {
  key: string
  sku: string | null
  label: string
  price: number | null
  stock: number | null
  /** opcje wariantu (np. Kolor: mint) — skróty przypisywania zdjęć w panelu */
  options: Array<{ key: string; label: string; value: string; slug: string }>
}

export type AdminProductImage = {
  key: string
  url: string
  alt: string | null
  /** `_key` wariantów, do których należy zdjęcie; puste = wspólne (src/lib/variantImages.ts) */
  variantKeys: string[]
}

export type AdminProduct = {
  id: string
  status: PublishState
  title: string
  subtitle: string | null
  sku: string | null
  slug: string | null
  brand: string | null
  price: number | null
  compareAtPrice: number | null
  stock: number | null
  isFeatured: boolean
  isBestseller: boolean
  intro: string | null
  shortDescription: string | null
  category: { id: string; title: string } | null
  subcategory: { id: string; title: string; slug: string | null } | null
  /** Identyfikatory kolekcji (bazowe `_id`, także szkiców) — nazwy dokleja widok z listy kolekcji. */
  collectionIds: string[]
  images: AdminProductImage[]
  variants: AdminVariant[]
  /** Warianty (albo sam produkt bez wariantów) poniżej progu stanu. */
  lowStock: Array<{ key: string | null; sku: string | null; stock: number }>
  totalStock: number | null
  updatedAt: string
}

type RawProduct = {
  _id: string
  _updatedAt: string
  title?: string
  subtitle?: string
  sku?: string
  slug?: string
  brand?: string
  price?: number
  compareAtPrice?: number
  stock?: number
  isFeatured?: boolean
  isBestseller?: boolean
  intro?: string
  shortDescription?: string
  category?: { _id: string; title?: string } | null
  subcategory?: { _id: string; title?: string; slug?: string } | null
  collectionIds?: Array<string | null> | null
  images?: Array<{ _key?: string; url?: string; alt?: string; variantKeys?: string[] | null }> | null
  variants?: Array<{
    _key?: string; sku?: string; price?: number; stock?: number; label?: string
    options?: Array<{ key?: string; label?: string; value?: string; slug?: string } | null> | null
  }> | null
}

const PRODUCT_PROJECTION = `{
  _id, _updatedAt, title, subtitle, sku, "slug": slug.current, brand,
  price, compareAtPrice, stock, isFeatured, isBestseller, intro, shortDescription,
  "category": category->{ _id, title },
  "subcategory": type->{ _id, title, "slug": slug.current },
  "collectionIds": collections[]._ref,
  "images": images[]{ _key, "url": asset->url, alt, variantKeys },
  "variants": variants[]{
    _key, sku, price, stock, "label": array::join(optionValues[].label, " · "),
    "options": optionValues[]{ "key": name->key, "label": name->label, "value": value->value, "slug": value->slug.current }
  }
}`

function toAdminProduct(doc: RawProduct, status: PublishState): AdminProduct {
  const variants: AdminVariant[] = (doc.variants ?? [])
    .filter((variant) => variant?._key)
    .map((variant) => ({
      key: variant._key!,
      sku: variant.sku ?? null,
      label: variant.label || variant.sku || 'Wariant',
      price: typeof variant.price === 'number' ? variant.price : null,
      stock: typeof variant.stock === 'number' ? variant.stock : null,
      options: (variant.options ?? [])
        .filter((option) => option?.key && option.slug)
        .map((option) => ({
          key: option!.key!,
          label: option!.label || option!.key!,
          value: option!.value || option!.slug!,
          slug: option!.slug!,
        })),
    }))

  const lowStock = variants.length
    ? variants
        .filter((variant) => variant.stock !== null && variant.stock < LOW_STOCK_THRESHOLD)
        .map((variant) => ({ key: variant.key, sku: variant.sku, stock: variant.stock! }))
    : typeof doc.stock === 'number' && doc.stock < LOW_STOCK_THRESHOLD
      ? [{ key: null, sku: doc.sku ?? null, stock: doc.stock }]
      : []

  const stockValues = variants.length
    ? variants.map((variant) => variant.stock).filter((value): value is number => value !== null)
    : typeof doc.stock === 'number'
      ? [doc.stock]
      : []

  return {
    id: baseId(doc._id),
    status,
    title: doc.title || '(bez nazwy)',
    subtitle: doc.subtitle ?? null,
    sku: doc.sku ?? null,
    slug: doc.slug ?? null,
    brand: doc.brand ?? null,
    price: typeof doc.price === 'number' ? doc.price : null,
    compareAtPrice: typeof doc.compareAtPrice === 'number' ? doc.compareAtPrice : null,
    stock: typeof doc.stock === 'number' ? doc.stock : null,
    isFeatured: Boolean(doc.isFeatured),
    isBestseller: Boolean(doc.isBestseller),
    intro: doc.intro ?? null,
    shortDescription: doc.shortDescription ?? null,
    category: doc.category?._id ? { id: doc.category._id, title: doc.category.title || '—' } : null,
    subcategory: doc.subcategory?._id
      ? { id: doc.subcategory._id, title: doc.subcategory.title || '—', slug: doc.subcategory.slug ?? null }
      : null,
    collectionIds: [...new Set((doc.collectionIds ?? []).filter((id): id is string => typeof id === 'string'))],
    images: (doc.images ?? [])
      .filter((image) => image?._key && image.url)
      .map((image) => ({
        key: image._key!,
        url: image.url!,
        alt: image.alt ?? null,
        variantKeys: Array.isArray(image.variantKeys) ? image.variantKeys.filter((k): k is string => typeof k === 'string') : [],
      })),
    variants,
    lowStock,
    totalStock: stockValues.length ? stockValues.reduce((sum, value) => sum + value, 0) : null,
    updatedAt: doc._updatedAt,
  }
}

/**
 * Pełny katalog z informacją o publikacji. Opublikowana wersja ma
 * pierwszeństwo (to ją widzi klient); szkic pokazujemy tylko, gdy produkt
 * jeszcze nigdy nie trafił do sklepu.
 */
export async function listAdminProducts({ fresh = false }: { fresh?: boolean } = {}): Promise<AdminProduct[]> {
  if (!fresh) {
    try {
      const cached = await redis.get(PRODUCTS_CACHE_KEY)
      if (cached) return JSON.parse(cached as string) as AdminProduct[]
    } catch {
      /* Redis niedostępny — czytamy bez cache */
    }
  }

  const docs = await raw.fetch<RawProduct[]>(
    `*[_type == "product"] | order(lower(title) asc) [0...2000] ${PRODUCT_PROJECTION}`
  )

  const published = new Map<string, RawProduct>()
  const drafts = new Map<string, RawProduct>()
  for (const doc of docs) {
    if (doc._id.startsWith(DRAFT_PREFIX)) drafts.set(baseId(doc._id), doc)
    else if (!doc._id.startsWith('versions.')) published.set(doc._id, doc)
    // wersje z Content Releases (`versions.*`) nie są ani szkicem, ani publikacją
  }

  const result: AdminProduct[] = []
  for (const [id, doc] of published) {
    result.push(toAdminProduct(doc, drafts.has(id) ? 'changed' : 'published'))
  }
  for (const [id, doc] of drafts) {
    if (!published.has(id)) result.push(toAdminProduct(doc, 'draft'))
  }
  result.sort((a, b) => a.title.localeCompare(b.title, 'pl'))

  try {
    await redis.setEx(PRODUCTS_CACHE_KEY, PRODUCTS_CACHE_TTL, JSON.stringify(result))
  } catch {
    /* jw. */
  }
  return result
}

export async function invalidateCatalogCache() {
  try {
    await redis.del([PRODUCTS_CACHE_KEY, 'admin:products:list:v2', 'admin:products:list', 'admin:insights:wishlistNames'])
  } catch {
    /* jw. */
  }
  await invalidateLowStockCounter()
}

/** Które wersje dokumentu istnieją (opublikowana / szkic). */
async function existingVersions(id: string): Promise<{ published: boolean; draft: boolean }> {
  const ids = await raw.fetch<string[]>(`*[_id in [$id, $draft]]._id`, { id, draft: draftId(id) })
  return { published: ids.includes(id), draft: ids.includes(draftId(id)) }
}

type PatchOps = {
  set?: Record<string, unknown>
  unset?: string[]
  setIfMissing?: Record<string, unknown>
  insertAfter?: { selector: string; items: unknown[] }
}

/** Ta sama zmiana na każdej istniejącej wersji dokumentu, w jednej transakcji. */
export async function patchAllVersions(id: string, ops: PatchOps) {
  const safeId = assertDocId(id)
  const versions = await existingVersions(safeId)
  const targets = [versions.published && safeId, versions.draft && draftId(safeId)].filter(Boolean) as string[]
  if (!targets.length) throw new Error('Dokument nie istnieje (mógł zostać usunięty w Studio).')

  const tx = raw.transaction()
  for (const target of targets) {
    tx.patch(target, (patch) => {
      let next = patch
      if (ops.setIfMissing) next = next.setIfMissing(ops.setIfMissing)
      if (ops.set) next = next.set(ops.set)
      if (ops.unset?.length) next = next.unset(ops.unset)
      if (ops.insertAfter) next = next.insert('after', ops.insertAfter.selector, ops.insertAfter.items)
      return next
    })
  }
  await tx.commit({ autoGenerateArrayKeys: true })
  await invalidateCatalogCache()
}

const SYSTEM_FIELDS = ['_rev', '_createdAt', '_updatedAt'] as const

function stripSystemFields<T extends Record<string, unknown>>(doc: T) {
  const copy: Record<string, unknown> = { ...doc }
  for (const field of SYSTEM_FIELDS) delete copy[field]
  return copy
}

/** Publikacja: szkic zastępuje wersję opublikowaną (jak przycisk „Publish” w Studio). */
export async function publishDocument(id: string) {
  const safeId = assertDocId(id)
  const draft = await raw.getDocument(draftId(safeId))
  if (!draft) {
    const published = await raw.getDocument(safeId)
    if (published) return // już opublikowany, nie ma czego publikować
    throw new Error('Nie znaleziono dokumentu do publikacji.')
  }
  await raw
    .transaction()
    .createOrReplace({ ...stripSystemFields(draft), _id: safeId, _type: draft._type })
    .delete(draftId(safeId))
    .commit()
  await invalidateCatalogCache()
}

/**
 * Wycofanie ze sklepu: treść wraca do szkicu, wersja opublikowana znika.
 * Sanity odmówi, jeśli inny opublikowany dokument trzyma do niego silną
 * referencję — wtedy komunikat błędu mówi, co blokuje.
 */
export async function unpublishDocument(id: string) {
  const safeId = assertDocId(id)
  const published = await raw.getDocument(safeId)
  if (!published) return
  await raw
    .transaction()
    .createIfNotExists({ ...stripSystemFields(published), _id: draftId(safeId), _type: published._type })
    .delete(safeId)
    .commit()
  await invalidateCatalogCache()
}

/** Trwałe usunięcie obu wersji dokumentu. */
export async function deleteDocument(id: string) {
  const safeId = assertDocId(id)
  const versions = await existingVersions(safeId)
  const tx = raw.transaction()
  if (versions.published) tx.delete(safeId)
  if (versions.draft) tx.delete(draftId(safeId))
  await tx.commit()
  await invalidateCatalogCache()
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
}

export type ProductInput = {
  title: string
  subtitle?: string | null
  sku: string
  price: number
  /**
   * @deprecated Sklep nie pokazuje już ręcznej ceny przekreślonej — obniżkę
   * i cenę odniesienia wylicza rejestr cen (lib/priceHistory.ts).
   * `undefined` = pole bez zmian.
   */
  compareAtPrice?: number | null
  stock?: number | null
  brand?: string | null
  intro?: string | null
  shortDescription?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  isFeatured?: boolean
  isBestseller?: boolean
  /** Istniejące kolekcje (id). `undefined` = bez zmian. */
  collectionIds?: string[]
  /** Nowe kolekcje po nazwie — powstaną jako szkic. `undefined` = bez zmian. */
  newCollectionNames?: string[]
}

/** Gotowe referencje `product.collections` (liczone w akcji — patrz lib/admin/collections.ts). */
export type CollectionRefs = Array<{ _type: 'reference'; _ref: string; _weak: true; _key: string }>

function cleanText(value: string | null | undefined, max = 512) {
  const text = (value ?? '').trim()
  return text ? text.slice(0, max) : null
}

export function validateProductInput(input: ProductInput): ProductInput {
  const title = cleanText(input.title, 200)
  if (!title) throw new Error('Podaj nazwę produktu.')
  const sku = cleanText(input.sku, 64)
  if (!sku) throw new Error('Podaj SKU — sklep i import CSV rozpoznają po nim produkt.')
  if (!Number.isFinite(input.price) || input.price <= 0) throw new Error('Cena musi być większa od 0.')
  if (input.compareAtPrice !== null && input.compareAtPrice !== undefined) {
    if (!Number.isFinite(input.compareAtPrice) || input.compareAtPrice < 0) throw new Error('Nieprawidłowa cena przekreślona.')
  }
  if (input.stock !== null && input.stock !== undefined) {
    if (!Number.isInteger(input.stock) || input.stock < 0) throw new Error('Stan magazynowy musi być liczbą całkowitą ≥ 0.')
  }
  return {
    ...input,
    title,
    sku,
    subtitle: cleanText(input.subtitle, 200),
    brand: cleanText(input.brand, 128),
    intro: cleanText(input.intro, 1000),
    shortDescription: cleanText(input.shortDescription, 2000),
    price: Math.round(input.price * 100) / 100,
    compareAtPrice:
      input.compareAtPrice === null || input.compareAtPrice === undefined
        ? null
        : Math.round(input.compareAtPrice * 100) / 100,
  }
}

async function assertSkuFree(sku: string, exceptId?: string) {
  const clash = await raw.fetch<string | null>(
    `*[_type == "product" && sku == $sku && !(_id in [$id, $draft])][0]._id`,
    { sku, id: exceptId ?? '', draft: exceptId ? draftId(exceptId) : '' }
  )
  if (clash) throw new Error(`SKU „${sku}” jest już używane przez inny produkt.`)
}

const ref = (id: string) => ({ _type: 'reference', _ref: assertDocId(id) })

/** Nowy produkt trafia do SZKICU — do sklepu wchodzi dopiero po „Opublikuj”. */
export async function createProductDraft(input: ProductInput, collections?: CollectionRefs) {
  const data = validateProductInput(input)
  await assertSkuFree(data.sku)
  const id = randomUUID()
  let slug = slugify(data.title) || slugify(data.sku)
  const taken = await raw.fetch<number>(`count(*[_type == "product" && slug.current == $slug])`, { slug })
  if (taken) slug = slugify(`${data.title}-${data.sku}`)
  const doc: Record<string, unknown> = {
    _id: draftId(id),
    _type: 'product',
    title: data.title,
    sku: data.sku,
    slug: { _type: 'slug', current: slug },
    price: data.price,
    currency: 'PLN',
    visibility: 'published',
    isFeatured: Boolean(data.isFeatured),
    isBestseller: Boolean(data.isBestseller),
  }
  if (data.subtitle) doc.subtitle = data.subtitle
  if (data.brand) doc.brand = data.brand
  if (data.intro) doc.intro = data.intro
  if (data.shortDescription) doc.shortDescription = data.shortDescription
  if (data.compareAtPrice) doc.compareAtPrice = data.compareAtPrice
  if (data.stock !== null && data.stock !== undefined) doc.stock = data.stock
  if (data.categoryId) doc.category = ref(data.categoryId)
  if (data.subcategoryId) doc.type = ref(data.subcategoryId)
  if (collections?.length) doc.collections = collections

  await raw.create(doc as { _id: string; _type: string })
  await invalidateCatalogCache()
  return id
}

export async function updateProduct(id: string, input: ProductInput, collections?: CollectionRefs) {
  const data = validateProductInput(input)
  await assertSkuFree(data.sku, assertDocId(id))
  const set: Record<string, unknown> = {
    title: data.title,
    sku: data.sku,
    price: data.price,
    isFeatured: Boolean(data.isFeatured),
    isBestseller: Boolean(data.isBestseller),
  }
  const unset: string[] = []
  const optional: Array<[string, unknown]> = [
    ['subtitle', data.subtitle],
    ['brand', data.brand],
    ['intro', data.intro],
    ['shortDescription', data.shortDescription],
    ['stock', data.stock ?? null],
  ]
  for (const [field, value] of optional) {
    if (value === null || value === undefined || value === '') unset.push(field)
    else set[field] = value
  }
  // Pole wycofane (obniżki liczy rejestr cen) — ruszamy je tylko, gdy formularz
  // jawnie je przysłał; brak w danych = bez zmian.
  if (input.compareAtPrice !== undefined) {
    if (data.compareAtPrice) set.compareAtPrice = data.compareAtPrice
    else unset.push('compareAtPrice')
  }
  if (data.categoryId) set.category = ref(data.categoryId)
  else unset.push('category')
  if (data.subcategoryId) set.type = ref(data.subcategoryId)
  else unset.push('type')
  if (collections !== undefined) {
    if (collections.length) set.collections = collections
    else unset.push('collections')
  }

  await patchAllVersions(id, { set, unset })
}

/** Ustawia (nie dodaje!) stan wariantu albo produktu bez wariantów. */
export async function setStock(id: string, variantKey: string | null, stock: number) {
  if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
    throw new Error('Stan magazynowy musi być liczbą całkowitą od 0 do 1 000 000.')
  }
  const path = variantKey ? `variants[_key=="${assertKey(variantKey)}"].stock` : 'stock'
  await patchAllVersions(id, { set: { [path]: stock } })
}

export async function setVariantPrice(id: string, variantKey: string, price: number | null) {
  if (price !== null && (!Number.isFinite(price) || price <= 0)) throw new Error('Cena wariantu musi być większa od 0.')
  const path = `variants[_key=="${assertKey(variantKey)}"].price`
  if (price === null) await patchAllVersions(id, { unset: [path] })
  else await patchAllVersions(id, { set: { [path]: Math.round(price * 100) / 100 } })
}

export async function setProductFlag(id: string, field: 'isFeatured' | 'isBestseller', value: boolean) {
  await patchAllVersions(id, { set: { [field]: value } })
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export async function uploadImageAsset(file: File) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Nie wybrano pliku.')
  if (!file.type.startsWith('image/')) throw new Error('Plik musi być obrazem (JPG, PNG, WebP…).')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Zdjęcie jest większe niż 10 MB.')
  const buffer = Buffer.from(await file.arrayBuffer())
  // Bez limitu czasu zawieszone połączenie z Sanity wisiało w nieskończoność,
  // a panel pokazywał „Wysyłam…” bez końca.
  const started = Date.now()
  const asset = await withTimeout(
    sanityClient.assets.upload('image', buffer, {
      filename: file.name || 'zdjecie',
      contentType: file.type,
    }),
    UPLOAD_TIMEOUT_MS,
    'Sanity nie odpowiedziało na wysyłkę zdjęcia w ciągu 90 s.',
  )
  console.info(`[images] upload ${file.name} ${(buffer.length / 1024).toFixed(0)} kB → ${asset._id} (${Date.now() - started} ms)`)
  return asset
}

const UPLOAD_TIMEOUT_MS = 90_000

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

export async function addProductImage(id: string, file: File, alt: string, variantKeys: string[] = []) {
  const asset = await uploadImageAsset(file)
  const keys = variantKeys.length ? await validVariantKeys(id, variantKeys) : []
  const image = {
    _type: 'image',
    _key: randomUUID().replace(/-/g, '').slice(0, 12),
    asset: { _type: 'reference', _ref: asset._id },
    alt: alt.slice(0, 200),
    ...(keys.length ? { variantKeys: keys } : {}),
  }
  await patchAllVersions(id, {
    setIfMissing: { images: [] },
    insertAfter: { selector: 'images[-1]', items: [image] },
  })
  return { key: image._key, url: asset.url, variantKeys: keys }
}

/** Klucze wariantów, które faktycznie istnieją w produkcie (szkic lub opublikowany). */
async function validVariantKeys(id: string, keys: string[]): Promise<string[]> {
  const safeId = assertDocId(id)
  const existing = await raw.fetch<string[] | null>(
    `array::unique(*[_id in [$id, $draft]].variants[]._key)`,
    { id: safeId, draft: draftId(safeId) },
  )
  const valid = new Set(existing ?? [])
  return [...new Set(keys.map(assertKey))].filter((key) => valid.has(key))
}

/**
 * Przypisanie zdjęć do wariantów — wiele zdjęć w jednej transakcji.
 * Pusta lista = zdjęcie wspólne. Nieistniejące warianty są pomijane.
 */
export async function setImagesVariants(id: string, updates: Array<{ imageKey: string; variantKeys: string[] }>) {
  if (!updates.length) return
  if (updates.length > 200) throw new Error('Za dużo zdjęć naraz.')
  const allKeys = updates.flatMap((update) => update.variantKeys)
  const valid = new Set(allKeys.length ? await validVariantKeys(id, allKeys) : [])
  const set: Record<string, unknown> = {}
  const unset: string[] = []
  for (const update of updates) {
    const path = `images[_key=="${assertKey(update.imageKey)}"].variantKeys`
    const keys = [...new Set(update.variantKeys)].filter((key) => valid.has(key))
    if (keys.length) set[path] = keys
    else unset.push(path)
  }
  await patchAllVersions(id, { set, unset })
}

export async function removeProductImage(id: string, imageKey: string) {
  await patchAllVersions(id, { unset: [`images[_key=="${assertKey(imageKey)}"]`] })
}

/** Przenosi zdjęcie na pierwsze miejsce — to ono jest miniaturą w sklepie. */
export async function makeImagePrimary(id: string, imageKey: string) {
  const safeId = assertDocId(id)
  const key = assertKey(imageKey)
  for (const target of [safeId, draftId(safeId)]) {
    const doc = await raw.getDocument<{ _id: string; _type: string; images?: Array<{ _key: string }> }>(target)
    if (!doc?.images?.length) continue
    const index = doc.images.findIndex((image) => image._key === key)
    if (index <= 0) continue
    const reordered = [doc.images[index], ...doc.images.filter((_, i) => i !== index)]
    await raw.patch(target).set({ images: reordered }).commit()
  }
  await invalidateCatalogCache()
}

// ─── kategorie ────────────────────────────────────────────────────────────────

export type AdminCategory = {
  id: string
  title: string
  slug: string | null
  description: string | null
  productCount: number
  subcategories: AdminSubcategory[]
}

export type AdminSubcategory = {
  id: string
  title: string
  slug: string | null
  description: string | null
  parentId: string | null
  imageUrl: string | null
  productCount: number
  minPrice: number | null
}

export async function listAdminCategories(): Promise<{ categories: AdminCategory[]; orphans: AdminSubcategory[] }> {
  const data = await sanityClient.fetch<{
    categories: Array<Omit<AdminCategory, 'subcategories'>>
    subcategories: AdminSubcategory[]
  }>(
    `{
      "categories": *[_type == "category"] | order(lower(title) asc) {
        "id": _id, "title": coalesce(title, "(bez nazwy)"), "slug": slug.current, description,
        "productCount": count(*[_type == "product" && category._ref == ^._id])
      },
      "subcategories": *[_type == "subcategory"] | order(lower(title) asc) {
        "id": _id, "title": coalesce(title, "(bez nazwy)"), "slug": slug.current, description,
        "parentId": parent._ref,
        "imageUrl": imageWithAlt.asset->url,
        "productCount": count(*[_type == "product" && type._ref == ^._id]),
        "minPrice": math::min(*[_type == "product" && type._ref == ^._id && defined(price)].price)
      }
    }`
  )

  const byParent = new Map<string, AdminSubcategory[]>()
  const orphans: AdminSubcategory[] = []
  const categoryIds = new Set(data.categories.map((category) => category.id))
  for (const sub of data.subcategories) {
    if (sub.parentId && categoryIds.has(sub.parentId)) {
      const list = byParent.get(sub.parentId) ?? []
      list.push(sub)
      byParent.set(sub.parentId, list)
    } else {
      orphans.push(sub)
    }
  }

  return {
    categories: data.categories.map((category) => ({
      ...category,
      subcategories: byParent.get(category.id) ?? [],
    })),
    orphans,
  }
}

/** Lekka lista do selectów w formularzu produktu. */
export async function listCategoryOptions() {
  const { categories, orphans } = await listAdminCategories()
  return {
    categories: categories.map((category) => ({ id: category.id, title: category.title })),
    subcategories: [
      ...categories.flatMap((category) =>
        category.subcategories.map((sub) => ({ id: sub.id, title: sub.title, parentId: category.id }))
      ),
      ...orphans.map((sub) => ({ id: sub.id, title: sub.title, parentId: null as string | null })),
    ],
  }
}

export async function renameTaxonomy(id: string, title: string) {
  const value = title.trim().slice(0, 120)
  if (!value) throw new Error('Nazwa nie może być pusta.')
  await patchAllVersions(id, { set: { title: value } })
}

export async function setSubcategoryImage(id: string, file: File, alt: string) {
  const asset = await uploadImageAsset(file)
  await patchAllVersions(id, {
    set: {
      imageWithAlt: {
        _type: 'image',
        asset: { _type: 'reference', _ref: asset._id },
        alt: (alt.trim() || 'Zdjęcie kategorii').slice(0, 200),
      },
    },
  })
  return asset.url
}

export async function removeSubcategoryImage(id: string) {
  await patchAllVersions(id, { unset: ['imageWithAlt'] })
}

// ─── metody dostawy (Sanity `shipping_methods`) ───────────────────────────────
//
// To z TYCH dokumentów korzysta checkout (lista metod, cena `internal_price`,
// kod usługi Furgonetki). Tabela MySQL `delivery_services` to tylko kopia
// usług z konta Furgonetki — pomocnicza przy wyborze kodu.

export type ShippingType = 'kurier' | 'automat'

export type AdminShippingMethod = {
  id: string
  status: PublishState
  name: string
  slug: string | null
  price: number | null
  serviceId: string | null
  type: ShippingType | null
  /** `null` = pole nieustawione. Checkout pokazuje taką metodę, ale odrzuca zamówienie. */
  active: boolean | null
  orderCount?: number
}

type RawShipping = {
  _id: string
  name?: string
  slug?: string
  internal_price?: number
  furgonetka_service_id?: string
  type?: string
  active?: boolean
}

export async function listShippingMethods(): Promise<AdminShippingMethod[]> {
  const docs = await raw.fetch<RawShipping[]>(
    `*[_type == "shipping_methods"] | order(lower(name) asc) {
      _id, name, "slug": slug.current, internal_price, furgonetka_service_id, type, active
    }`
  )
  const published = new Map<string, RawShipping>()
  const drafts = new Map<string, RawShipping>()
  for (const doc of docs) {
    if (doc._id.startsWith(DRAFT_PREFIX)) drafts.set(baseId(doc._id), doc)
    else if (!doc._id.startsWith('versions.')) published.set(doc._id, doc)
  }
  const map = (doc: RawShipping, status: PublishState): AdminShippingMethod => ({
    id: baseId(doc._id),
    status,
    name: doc.name || '(bez nazwy)',
    slug: doc.slug ?? null,
    price: typeof doc.internal_price === 'number' ? doc.internal_price : null,
    serviceId: doc.furgonetka_service_id ?? null,
    type: doc.type === 'kurier' || doc.type === 'automat' ? doc.type : null,
    active: typeof doc.active === 'boolean' ? doc.active : null,
  })
  return [
    ...[...published].map(([id, doc]) => map(doc, drafts.has(id) ? 'changed' : 'published')),
    ...[...drafts].filter(([id]) => !published.has(id)).map(([, doc]) => map(doc, 'draft')),
  ]
}

export type ShippingInput = {
  name: string
  price: number
  serviceId: string
  type: ShippingType
  active: boolean
}

function validateShipping(input: ShippingInput): ShippingInput {
  const name = input.name.trim().slice(0, 120)
  if (!name) throw new Error('Podaj nazwę metody dostawy.')
  if (!Number.isFinite(input.price) || input.price < 0) throw new Error('Cena dostawy nie może być ujemna.')
  const serviceId = input.serviceId.trim().slice(0, 64)
  if (!serviceId) throw new Error('Podaj kod usługi Furgonetki (np. inpost, dpd).')
  if (input.type !== 'kurier' && input.type !== 'automat') throw new Error('Wybierz rodzaj: kurier albo paczkomat.')
  return { name, serviceId, type: input.type, active: Boolean(input.active), price: Math.round(input.price * 100) / 100 }
}

/** Nowa metoda od razu jako opublikowana, ale nieaktywna, dopóki admin jej nie włączy. */
export async function createShippingMethod(input: ShippingInput) {
  const data = validateShipping(input)
  const id = randomUUID()
  await raw.create({
    _id: id,
    _type: 'shipping_methods',
    name: data.name,
    slug: { _type: 'slug', current: slugify(data.name) },
    internal_price: data.price,
    furgonetka_service_id: data.serviceId,
    type: data.type,
    active: data.active,
  })
  return id
}

export async function updateShippingMethod(id: string, input: ShippingInput) {
  const data = validateShipping(input)
  await patchAllVersions(id, {
    set: {
      name: data.name,
      internal_price: data.price,
      furgonetka_service_id: data.serviceId,
      type: data.type,
      active: data.active,
    },
  })
}

export async function setShippingActive(id: string, active: boolean) {
  await patchAllVersions(id, { set: { active } })
}
