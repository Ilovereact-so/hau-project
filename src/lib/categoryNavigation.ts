import { NON_PRODUCT_CATEGORY_SLUGS } from '@/constants'

/**
 * Normalizacja pod porównanie nazw kategorii: małe litery, bez polskich
 * znaków diakrytycznych, bez spacji na brzegach. `ł` nie rozkłada się przez
 * NFD (to osobny znak, nie l + kreska), więc trzeba je podmienić ręcznie.
 */
const normalize = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()

type MaybeCategory = { title?: string | null; slug?: string | null }

/**
 * Czy dana kategoria z Sanity jest realną kategorią PRODUKTOWĄ (czyli taką,
 * która ma prawo pojawić się w menu i prowadzić do listy produktów).
 *
 * Poradniki historycznie były dokumentem `category`, więc menu pokazywało je
 * obok Karmienia czy Zabawek — z pustym submenu, bo nigdy nie miały
 * podkategorii ani produktów. Teraz są osobnym typem (`guide`) pod /poradniki,
 * a ta funkcja pilnuje, żeby stary dokument (jeśli nadal jest w datasecie) nie
 * wrócił do menu tylnymi drzwiami. Sprawdzamy i slug, i tytuł, bo dokument mógł
 * zostać dodany ręcznie bez sensownego sluga.
 */
export const isProductCategory = (category: MaybeCategory): boolean => {
  const slug = normalize(category.slug)
  const title = normalize(category.title)
  return !NON_PRODUCT_CATEGORY_SLUGS.some((excluded) => excluded === slug || excluded === title)
}

export const filterProductCategories = <T extends MaybeCategory>(categories: T[]): T[] =>
  categories.filter(isProductCategory)
