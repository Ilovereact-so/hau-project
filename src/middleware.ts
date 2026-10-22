import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/verify-email(.*)',
  '/reset-password(.*)',
  '/sso-callback(.*)',
  '/403',
  '/404',
  '/api/sanity/(.*)',
  '/api/webhooks/(.*)',
  '/api/furgonetka/(.*)',
  // product browsing is public
  '/(products)/(.*)',
  '/subcategory/(.*)',
  // Strona kategorii głównej (klik w „Zabawki”, „Przysmaki”… w menu).
  '/category/(.*)',
  // wyniki wyszukiwania — publiczne tak samo jak przeglądanie subkategorii.
  // (Bez tego i tak przechodziło, bo trasa nie łapie się na isProtectedRoute
  // ani isAdminRoute i spada do końcowego next() — ale lepiej mieć to wprost.)
  '/search',
  // Strony kolekcji (baner na stronie głównej prowadzi właśnie tu).
  '/kolekcje',
  '/kolekcje/(.*)',
  // Centrum pomocy (regulamin, polityka prywatności, dostawa...) — dokumenty
  // muszą być dostępne bez logowania, m.in. dlatego że linkuje do nich
  // checkout i wymagają tego przepisy konsumenckie.
  '/help',
  '/help/(.*)',
  // Koszyk działa bez logowania (logowanie wymagane dopiero w /checkout),
  // a wishlista gościa żyje w profilu — to jedyna zakładka profilu dostępna
  // bez konta.
  '/cart',
  '/wishlist',
  '/profile',
  '/profile/wishlist(.*)',
  '/api/cart(.*)',
  '/api/wishlist(.*)',
  // Opinie o produktach: odczyt jest publiczny, a zapis idzie przez akcje
  // serwerowe, które same sprawdzają zalogowanie (actions/reviews.ts).
  '/api/reviews(.*)',
  // Najniższa cena z 30 dni dla kafelków — odczyt publiczny.
  '/api/prices(.*)',
  // Zadania okresowe — autoryzacja sekretem (CRON_SECRET) w samej trasie.
  '/api/cron/(.*)',
  // Zakup bez logowania: kasa, zamówienie gościa (dostęp po ciasteczku
  // guest_id albo podpisanym linku), status płatności i ustawienia koszyka.
  '/checkout',
  '/zamowienie/(.*)',
  '/orders/(.*)',
  '/api/orders/(.*)',
  '/api/autopay/(.*)',
  '/api/shop-settings',
  '/api/search',
  // Newsletter: potwierdzenie zapisu i wypisanie się linkiem z maila.
  '/newsletter/(.*)',
  // Wypisanie jednym kliknięciem z nagłówka List-Unsubscribe (RFC 8058).
  '/api/newsletter/(.*)',
])

// `/upload` to dawny uploader CSV z grupy (admin) — dziś tylko przekierowuje
// do /admin/import, ale nie może być dostępny bez roli admina.
// `/studio` — Sanity Studio (redakcja katalogu) tylko dla adminów sklepu.
// Wcześniej było na liście publicznych: otwierał je każdy, a jedyną ochroną
// było logowanie do Sanity.
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/upload(.*)', '/studio(.*)'])

// Sekcje konta w /profile (dane, zamówienia, płatności) wymagają logowania.
// /profile/wishlist jest publiczne (patrz wyżej) — publiczne trasy są
// sprawdzane wcześniej, więc tu wystarczy ogólny wzorzec.
const isProtectedRoute = createRouteMatcher(['/profile(.*)'])

// Prosta detekcja mobile po User-Agent — używana wyłącznie jako podpowiedź dla
// pierwszego SSR render (żeby navbar od razu wyrenderował właściwy wariant
// mobile/desktop i nie "przeskakiwał" po hydracji). Realna detekcja przez
// matchMedia w przeglądarce nadal działa jak dotąd i nadpisuje tę podpowiedź,
// więc błędna klasyfikacja UA nie psuje niczego — najwyżej jedna dodatkowa
// animowana zmiana layoutu zamiast żadnej.
const MOBILE_UA_RE = /Android|iPhone|iPod|iPad|Mobile|Windows Phone/i

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth()

  const isMobileUA = MOBILE_UA_RE.test(req.headers.get('user-agent') ?? '')
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-is-mobile', isMobileUA ? '1' : '0')
  const next = () => NextResponse.next({ request: { headers: requestHeaders } })

  // Scalanie koszyka gościa z kontem robi klient (StoreHydration →
  // hydrateUserSession) — middleware nic tu nie ustawia. Wcześniejszy blok
  // `needs_cart_merge` robił `return` przed sprawdzeniem roli admina.

  if (isPublicRoute(req)) return next()

  // Gość na zablokowanej sekcji profilu → profil (wishlista) z otwartym
  // modalem logowania; po zalogowaniu wraca na żądaną stronę.
  // Pozostałe chronione trasy (checkout, orders) mają własny auth()+redirect.
  if (!userId && isProtectedRoute(req)) {
    const url = new URL('/profile/wishlist', req.url)
    url.searchParams.set('login', '1')
    url.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search)
    return NextResponse.redirect(url)
  }

  // admin routes — require admin role
  if (isAdminRoute(req)) {
    // Niezalogowany → logowanie z powrotem pod żądany adres (zamiast 403).
    if (!userId) {
      const url = new URL('/sign-in', req.url)
      url.searchParams.set('redirect_url', req.nextUrl.pathname + req.nextUrl.search)
      return NextResponse.redirect(url)
    }
    const role = (sessionClaims?.metadata as { role?: string })?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/403', req.url))
    }
  }

  return next()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
