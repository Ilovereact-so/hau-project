import {
  Boxes,
  ChartNoAxesCombined,
  Database,
  LayoutDashboard,
  Megaphone,
  MessageSquareText,
  NotebookPen,
  PackageOpen,
  PlugZap,
  ShoppingBag,
  Truck,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/** Ciasteczko z motywem panelu (czytane w layoucie, żeby nie migało). */
export const THEME_COOKIE = 'hau_admin_theme'

export type NavChild = {
  label: string
  href: string
}

export type NavItem = {
  label: string
  icon: LucideIcon
  href: string
  /** Pozycje rozwijane — sidebar rysuje je z pionową prowadnicą. */
  children?: NavChild[]
  /** Klucz licznika z `AdminCounters` pokazywanego jako czerwona plakietka. */
  badgeKey?: keyof AdminCounters
  /** Otwiera się w nowej karcie (np. Sanity Studio). */
  external?: boolean
}

/** Liczniki „do zrobienia” liczone w layoucie panelu. */
export type AdminCounters = {
  toShip: number
  failedPayments: number
  lowStock: number
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  {
    label: 'Zamówienia',
    icon: ShoppingBag,
    href: '/admin/orders',
    badgeKey: 'toShip',
    children: [
      { label: 'Wszystkie', href: '/admin/orders' },
      { label: 'Do wysyłki', href: '/admin/orders?status=paid' },
      { label: 'W realizacji', href: '/admin/orders?status=processing' },
      { label: 'Oczekujące na płatność', href: '/admin/orders?status=awaiting_payment' },
      { label: 'Eksport CSV', href: '/admin/orders/export' },
    ],
  },
  {
    label: 'Produkty',
    icon: PackageOpen,
    href: '/admin/products',
    children: [
      { label: 'Katalog', href: '/admin/products' },
      { label: 'Kategorie', href: '/admin/categories' },
      { label: 'Kolekcje', href: '/admin/collections' },
      { label: 'Import CSV', href: '/admin/import' },
    ],
  },
  { label: 'Magazyn', icon: Boxes, href: '/admin/products?filter=low', badgeKey: 'lowStock' },
  {
    label: 'Blog',
    icon: NotebookPen,
    href: '/admin/blog',
    children: [
      { label: 'Artykuły', href: '/admin/blog' },
      { label: 'Nowy artykuł', href: '/admin/blog/new' },
      { label: 'Kategorie', href: '/admin/blog/categories' },
    ],
  },
  { label: 'Klienci', icon: UsersRound, href: '/admin/customers' },
  { label: 'Opinie', icon: MessageSquareText, href: '/admin/reviews' },
  { label: 'Płatności', icon: WalletCards, href: '/admin/payments', badgeKey: 'failedPayments' },
  { label: 'Dostawy', icon: Truck, href: '/admin/shipping' },
  { label: 'Marketing', icon: Megaphone, href: '/admin/marketing' },
  { label: 'Analityka', icon: ChartNoAxesCombined, href: '/admin/insights' },
  { label: 'Integracje', icon: PlugZap, href: '/admin/settings' },
  { label: 'Sanity Studio', icon: Database, href: '/studio', external: true },
]

/**
 * Pozycja do podświetlenia dla bieżącego adresu. Uwzględnia parametry
 * zapytania, bo „Magazyn” to `/admin/products?filter=low`, a „Produkty”
 * to ta sama ścieżka bez filtra.
 */
export function activeLabelFor(pathname: string, search: URLSearchParams): string {
  if (pathname === '/admin/products' && search.get('filter') === 'low') return 'Magazyn'
  if (pathname === '/admin' || pathname === '/admin/') return 'Dashboard'
  if (pathname.startsWith('/admin/categories') || pathname.startsWith('/admin/collections') || pathname.startsWith('/admin/import')) return 'Produkty'
  if (pathname.startsWith('/admin/newsletter')) return 'Marketing'

  let best: NavItem | undefined
  for (const item of NAV_ITEMS) {
    const base = item.href.split('?')[0]
    if (base === '/admin' || item.external) continue
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      if (!best || base.length > best.href.split('?')[0].length) best = item
    }
  }
  return best?.label ?? 'Dashboard'
}

/** Czy podpozycja jest bieżącym widokiem (porównanie ścieżki i parametrów). */
export function isChildActive(child: NavChild, pathname: string, search: URLSearchParams): boolean {
  const [base, query] = child.href.split('?')
  if (pathname !== base) return false
  const expected = new URLSearchParams(query ?? '')
  const keys = new Set([...expected.keys(), 'status', 'filter'])
  for (const key of keys) {
    if ((expected.get(key) ?? '') !== (search.get(key) ?? '')) return false
  }
  return true
}

type Heading = { title: string; subtitle: string }

/** Nagłówki topbaru — kolejność ma znaczenie (dłuższe prefiksy wcześniej). */
const HEADINGS: Array<[prefix: string, heading: Heading]> = [
  ['/admin/orders/export', { title: 'Eksport zamówień', subtitle: 'Plik CSV dla księgowości i arkuszy — jeden wiersz na pozycję zamówienia.' }],
  ['/admin/orders/', { title: 'Zamówienie', subtitle: 'Dane klienta, płatności, przesyłka i zmiana statusu.' }],
  ['/admin/orders', { title: 'Zamówienia', subtitle: 'Lista zamówień z bazy sklepu — filtry, statusy i realizacja.' }],
  ['/admin/products', { title: 'Produkty', subtitle: 'Katalog z Sanity: publikacja, stany magazynowe, flagi i edycja.' }],
  ['/admin/categories', { title: 'Kategorie', subtitle: 'Kategorie i subkategorie sklepu z Sanity — nazwy, zdjęcia, liczniki produktów.' }],
  ['/admin/collections', { title: 'Kolekcje', subtitle: 'Kolekcje produktów z Sanity — strony /kolekcje, przypisanie produktów i link z banera.' }],
  ['/admin/import', { title: 'Import CSV', subtitle: 'Hurtowe dodawanie i aktualizacja produktów w Sanity z pliku CSV (+ ZIP ze zdjęciami).' }],
  ['/admin/blog/new', { title: 'Nowy artykuł', subtitle: 'Pisz, formatuj i wstawiaj zdjęcia, filmy, ramki i produkty. Autozapis do szkicu — sklep widzi tekst dopiero po publikacji.' }],
  ['/admin/blog/categories', { title: 'Kategorie bloga', subtitle: 'Kategorie poradników — filtry na /poradniki.' }],
  ['/admin/blog/', { title: 'Edycja artykułu', subtitle: 'Autozapis do szkicu co kilka sekund (Ctrl+S — od razu). Zmiany trafiają do sklepu po „Opublikuj”.' }],
  ['/admin/blog', { title: 'Blog', subtitle: 'Poradniki sklepu — pisanie, publikacja, planowanie i wyróżnienia.' }],
  ['/admin/customers', { title: 'Klienci', subtitle: 'Klienci zagregowani z zamówień — wartość zakupów i historia.' }],
  ['/admin/reviews', { title: 'Opinie', subtitle: 'Opinie klientów o produktach — moderacja, odpowiedzi sklepu i niskie oceny.' }],
  ['/admin/payments', { title: 'Płatności', subtitle: 'Transakcje Autopay i Przelewy24 — nieudane i oczekujące wymagają uwagi.' }],
  ['/admin/shipping', { title: 'Dostawy', subtitle: 'Metody dostawy z Furgonetki — ceny, aktywność i kolejność w checkoucie.' }],
  ['/admin/marketing', { title: 'Marketing', subtitle: 'Newsletter: subskrybenci i szablon maila powitalnego.' }],
  ['/admin/newsletter', { title: 'Marketing', subtitle: 'Newsletter: subskrybenci i szablon maila powitalnego.' }],
  ['/admin/insights', { title: 'Analityka', subtitle: 'Popyt, aktywność klientów, porzucone koszyki i porównanie miesięcy.' }],
  ['/admin/settings', { title: 'Integracje', subtitle: 'Stan połączeń sklepu: Sanity, baza, Redis, płatności, wysyłka i poczta.' }],
]

export function headingFor(pathname: string, firstName?: string | null): Heading {
  if (pathname === '/admin' || pathname === '/admin/') {
    return {
      title: `Witaj ponownie${firstName ? `, ${firstName}` : ''}!`,
      subtitle: 'Oto podsumowanie Twojego sklepu z ostatnich 30 dni.',
    }
  }
  for (const [prefix, heading] of HEADINGS) {
    if (pathname.startsWith(prefix)) return heading
  }
  return { title: 'Panel', subtitle: 'Zarządzanie sklepem HAU.' }
}

/** Sekcje, w których wyszukiwarka z topbaru filtruje bieżącą listę. */
export const SEARCHABLE_PATHS = ['/admin/blog', '/admin/orders', '/admin/products', '/admin/customers', '/admin/categories', '/admin/reviews', '/admin/collections']
