import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import { isProductCategory } from '@/lib/categoryNavigation'
import { invalidateCatalogCache } from '@/lib/admin/catalog'
import { planMenuChanges, sortForMenu, type MenuDocState } from '@/lib/menuOrder'

/*
 * Produkty → Menu sklepu (`/admin/menu`): kolejność i ukrywanie kategorii
 * i podkategorii w nawigacji sklepu. Logika kolejności i walidacja zapisu
 * są czyste (`lib/menuOrder.ts`), tu tylko odczyt i zapis w Sanity.
 *
 * Panel pokazuje dokumenty OPUBLIKOWANE (szkic, którego nie ma w sklepie,
 * nie ma też w menu). Zapis trafia do obu wersji — opublikowanej i szkicu,
 * jeśli istnieje (jak `patchAllVersions` przy produktach), w JEDNEJ
 * transakcji: menu nigdy nie zostaje „w połowie” przestawione.
 */

const raw = sanityClient.withConfig({ perspective: 'raw', useCdn: false })

export type MenuEditorSubcategory = {
  id: string
  title: string
  slug: string | null
  hidden: boolean
  productCount: number
}

export type MenuEditorCategory = {
  id: string
  title: string
  slug: string | null
  hidden: boolean
  productCount: number
  subcategories: MenuEditorSubcategory[]
}

export type MenuEditorData = {
  categories: MenuEditorCategory[]
  /** Podkategorie bez (istniejącej) kategorii nadrzędnej — nie ma ich w menu. */
  orphans: Array<{ id: string; title: string }>
  /** Czy ktoś już zapisał własną kolejność (inaczej: kolejność domyślna). */
  customized: boolean
}

type RawDoc = {
  _id: string
  _type: 'category' | 'subcategory'
  title?: string | null
  slug?: string | null
  parentId?: string | null
  menuOrder?: number | null
  menuHidden?: boolean | null
  productCount?: number
}

export async function getMenuEditorData(): Promise<MenuEditorData> {
  const data = await sanityClient.fetch<{ categories: RawDoc[]; subcategories: RawDoc[] }>(
    `{
      "categories": *[_type == "category"] {
        _id, _type, title, "slug": slug.current, menuOrder, menuHidden,
        "productCount": count(*[_type == "product" && (category._ref == ^._id || type->parent._ref == ^._id)])
      },
      "subcategories": *[_type == "subcategory"] {
        _id, _type, title, "slug": slug.current, "parentId": parent._ref, menuOrder, menuHidden,
        "productCount": count(*[_type == "product" && type._ref == ^._id])
      }
    }`,
  )

  // Stary dokument „Poradniki” (NON_PRODUCT_CATEGORY_SLUGS) nie jest kategorią
  // sklepu — navbar i tak go pomija, więc w edytorze menu go nie pokazujemy.
  const categories = sortForMenu(data.categories).filter((doc) => isProductCategory(doc))
  const ids = new Set(data.categories.map((doc) => doc._id))
  const byParent = new Map<string, RawDoc[]>()
  const orphans: MenuEditorData['orphans'] = []
  for (const sub of data.subcategories) {
    if (sub.parentId && ids.has(sub.parentId)) byParent.set(sub.parentId, [...(byParent.get(sub.parentId) ?? []), sub])
    else orphans.push({ id: sub._id, title: sub.title || '(bez nazwy)' })
  }

  return {
    categories: categories.map((category) => ({
      id: category._id,
      title: category.title || '(bez nazwy)',
      slug: category.slug ?? null,
      hidden: category.menuHidden === true,
      productCount: category.productCount ?? 0,
      subcategories: sortForMenu(byParent.get(category._id) ?? []).map((sub) => ({
        id: sub._id,
        title: sub.title || '(bez nazwy)',
        slug: sub.slug ?? null,
        hidden: sub.menuHidden === true,
        productCount: sub.productCount ?? 0,
      })),
    })),
    orphans,
    customized: [...data.categories, ...data.subcategories].some((doc) => typeof doc.menuOrder === 'number'),
  }
}

/** Zapis układu z panelu. Zwraca liczbę zmienionych dokumentów (0 = nic do zapisania). */
export async function saveMenuLayout(input: unknown): Promise<number> {
  const docs = await raw.fetch<Array<RawDoc & { _id: string }>>(
    `*[_type in ["category", "subcategory"]] { _id, _type, "parentId": parent._ref, menuOrder, menuHidden }`,
  )
  const drafts = new Set(docs.filter((doc) => doc._id.startsWith('drafts.')).map((doc) => doc._id))
  const published: MenuDocState[] = docs
    .filter((doc) => !doc._id.startsWith('drafts.') && !doc._id.includes('.'))
    .map((doc) => ({
      id: doc._id,
      kind: doc._type,
      parentId: doc._type === 'subcategory' ? (doc.parentId ?? null) : null,
      menuOrder: typeof doc.menuOrder === 'number' ? doc.menuOrder : null,
      menuHidden: doc.menuHidden === true,
    }))

  const changes = planMenuChanges(published, input)
  if (!changes.length) return 0

  const tx = raw.transaction()
  for (const change of changes) {
    for (const target of [change.id, ...(drafts.has(`drafts.${change.id}`) ? [`drafts.${change.id}`] : [])]) {
      tx.patch(target, (patch) => {
        let next = patch
        if (Object.keys(change.set).length) next = next.set(change.set)
        if (change.unset.length) next = next.unset(change.unset)
        return next
      })
    }
  }
  await tx.commit({ visibility: 'sync' })
  await invalidateCatalogCache()
  return changes.length
}
