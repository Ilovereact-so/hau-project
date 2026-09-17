# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Next.js + Turbopack)
npm run build     # Production build
npm run lint      # ESLint
npm run typegen   # Regenerate TypeScript types from Sanity schema
```

## Architecture

This is a Next.js 15 e-commerce app using the App Router. The three main data systems are:

- **Sanity CMS** — product catalog (products, categories, subcategories, collections, banners). Queried via GROQ from `src/sanity/helpers/`. The Sanity Studio is mounted at `/studio` via `src/app/studio/`.
- **MySQL via Drizzle ORM** — transactional data: cart items, wishlist, orders, product reviews, price history. Schema in `src/db/`. Config in `drizzle.config.ts`. Migracje SQL w `drizzle/` (`0001_product_price_history.sql` — rejestr cen).
- **Redis** — caching layer for cart and wishlist with TTL-based expiry. Client in `src/lib/`.

### Poradniki (sekcja blogowa)

Poradniki są osobną gałęzią treści w Sanity, celowo odciętą od drzewa produktów:

- Typy: `guide` (wpis: tekst Portable Text + opcjonalne wideo), `guideCategory` (kategoria wpisu), `videoEmbed` (obiekt osadzany: link do YouTube/Vimeo **albo** plik wgrany do Sanity). W Studio mają własną sekcję "Poradniki" (`src/sanity/structure.ts`).
- **Nie są kategorią sklepu.** Wcześniej "Poradniki" istniały jako dokument `category`, przez co menu traktowało je jak kategorię produktową z pustym submenu. Teraz navbar renderuje je jako osobny link do `/poradniki`, a `src/lib/categoryNavigation.ts` odfiltrowuje z menu każdą kategorię o slugu/tytule z `NON_PRODUCT_CATEGORY_SLUGS` (zabezpieczenie, gdyby stary dokument wrócił do datasetu).
- Wpisy z `publishedAt` w przyszłości są ukryte na froncie — to mechanizm planowania publikacji.
- Renderer treści (`components/guides/GuideBody.tsx`) rozszerza bazowy zestaw stylów Portable Text eksportowany z `components/PortableTextContent.tsx` — regulaminy i poradniki mają dzieloną typografię, więc nie kopiuj mapy komponentów, tylko ją rozszerzaj.
- Filmy z YouTube/Vimeo ładują się dopiero po kliknięciu (fasada z miniaturą w `components/guides/VideoPlayer.tsx`) — osadzony odtwarzacz to ~1 MB skryptów na film. Miniatury lecą z `i.ytimg.com`, host jest w `next.config.ts`.
- Moduł na stronie głównej (`components/guides/GuidesCarousel.tsx`, wstawiony w `ContentContainer` nad `AboutAs`) pobiera dane po stronie klienta przez `getLatestGuidesClient` — karuzele produktów, subkategorie i poradniki na stronie głównej są komponentami klienckimi (banery już NIE: patrz niżej), więc server-only `sanityFetch` tam nie działa.
- Po dodaniu tych typów odpal `npm run typegen`, żeby wygenerowane typy Sanity objęły `guide`/`guideCategory`.

### Wydajność Sanity + skeletony

- **Strona główna jest server componentem** (`src/app/(using)/page.tsx`): banery pobiera przez `getBaners()` (server-only `sanityFetch`) i przekazuje jako props do klientowej karuzeli `components/HomeCarousel.tsx`. Nie cofaj tego do client-fetch w `useEffect` — to właśnie to powodowało kilkusekundową pustkę po odświeżeniu.
- **Cache**: `sanity/lib/live.ts` ustawia `fetchOptions: { revalidate: 60 }` dla `defineLive` (next-sanity przy każdym `sanityFetch` robi dwa sekwencyjne requesty — cache je eliminuje; tagi `sanity:*` unieważniają cache przy zmianie treści). `hooks/categories.ts` cacheuje kategorie navbaru na 10 min przez `next: { revalidate }` (`export const revalidate` w komponencie NIE działa — tylko w page/layout/route). Pobrania client-side (`sanity/helpers/clientRequest.ts`) mają własny cache+dedup 60 s (karuzele, subkategorie, poradniki).
- **CDN**: klient przeglądarkowy (`sanity/lib/client.ts`) ma `useCdn: true` (dataset publiczny, perspektywa `published`).
- **Skeletony**: wspólne kształty ładowania w `components/ui/Skeleton.tsx` (produkt, karuzela, baner, subkategoria, poradnik) — używają ich komponenty klienckie oraz pliki `loading.tsx` w `(products)`. Nowe stany ładowania powinny korzystać z tej biblioteki zamiast własnych divów, żeby zachować identyczną geometrię z docelową treścią.

Authentication is handled by **Clerk**. A webhook at `src/app/api/webhooks/clerk/` assigns `role: "user"` on signup and syncs users to MySQL. The middleware (`src/middleware.ts`) enforces admin-only access to `/admin/*` routes and sends guests from protected profile sections to `/profile/wishlist?login=1`. The `guest_id` cookie is set by server actions (`lib/cartServer.ts`), not by the middleware.

## State Management

Zustand store (`store.ts` w katalogu głównym) trzyma koszyk i wishlistę. Logika przejść sesji: `src/lib/storeSession.ts`, wywoływana z `components/StoreHydration.tsx`.

- **Koszyk działa bez logowania.** Persist (`hau-store`, v1) zapisuje `cartItems`, `cartOwner` (`'guest'` | userId) i `guestWishlistIds`. Wishlista konta nigdy nie trafia do localStorage.
- **Sesja w store** (`session`: unknown/guest/user) ustawia wyłącznie StoreHydration. Do czasu jej ustalenia (start aplikacji, scalanie po zalogowaniu) synchronizacja jest zawieszona (`suspendSync`/`resumeSync`). Zmiany z tego okresu są zapamiętywane i nakładane po hydracji.
- **Synchronizacja** (debounce 500 ms) jest przypięta do właściciela: `syncCart(items, owner)` / `syncWishlist(ids, userId)`. Serwer ignoruje zapis, gdy sesja się zmieniła. Przy ukryciu/zamknięciu karty zaległe zapisy idą `fetch keepalive` na `PUT /api/cart` i `PUT /api/wishlist`. Wylogowanie idzie przez `useSafeSignOut` (najpierw `flushPendingSync`).
- **Po zalogowaniu** (i przy każdym starcie zalogowanego) `hydrateUserSession` (`actions/sync.ts`) scala koszyk i wishlistę gościa z kontem. Przy konflikcie ilości bierze **max** (scalanie jest idempotentne), dla wishlisty sumę. Usuwa pozycje, których nie ma już w Sanity, przycina ilość do stanu magazynu, zapisuje wynik, kasuje koszyk gościa i ciasteczko `guest_id`. Zwraca stan z produktami. Przy błędzie (także Sanity) nic nie nadpisuje, a klient ponawia (3 próby) i nie wznawia synchronizacji.
- **Wylogowanie / inne konto**: dane poprzedniego konta są czyszczone, nigdy scalane.
- `cartReady` — koszyk i kasa czekają na ustalenie właściciela koszyka.
- Warstwa danych: `src/lib/cartServer.ts` (Redis cache 30 dni → fallback MySQL, zapis w transakcji). Czysta logika i walidacja payloadów: `src/lib/cartMerge.ts` (limity: 100 pozycji, 99 szt., 200 polubionych).

### Profil i logowanie gościa

- Gość ma dostęp tylko do `/profile/wishlist` (wishlista z localStorage + produkty z `GET /api/wishlist?ids=`). Nagłówek konta i pozostałe zakładki są „przydymione” i otwierają modal logowania (`ProfileMenu`, `ProfileContainer`, `components/profile/ProfileSession.tsx`).
- Wejście gościa na `/profile/account|orders|payment` → middleware (i `requireUser` w stronach) przekierowuje na `/profile/wishlist?login=1&redirect_url=…`. `AuthQueryTrigger` (root layout) otwiera wtedy modal i po zalogowaniu wraca pod `redirect_url`.
- `openModal(view, { redirectTo })` — cel po zalogowaniu (brak = zostajemy na stronie). `/sign-in` i `/sign-up` honorują `?redirect_url`. OAuth i weryfikacja e-maila zapamiętują cel w sessionStorage (`lib/authRedirect.ts`, tylko ta sama domena).
- `/wishlist` → przekierowanie na `/profile/wishlist`; `/profile` → konto albo wishlista gościa.
- Koszyk gościa: „Zaloguj się i przejdź do kasy” (modal z `redirectTo: '/checkout'`). `/checkout` nadal wymaga konta.

Server actions for these operations live in `src/actions/`.

## Route Groups

App routes are organized into groups under `src/app/`:

| Group | Purpose |
|---|---|
| `(auth)` | Sign-in, sign-up, password reset, SSO callback |
| `(admin)` | Panel admina `/admin/*` (dashboard, zamówienia, produkty, kategorie, import, klienci, płatności, dostawy, marketing, analityka, integracje) |
| `(products)` | Product detail pages `[slug]`, subcategory listings |
| `(client)` | Cart (także dla gości), checkout, profil (`/profile/wishlist` publiczne), order success |
| `(errors)` | 403, 404 pages |
| `(using)` | Home page with banner |
| `help` | Centrum pomocy — regulaminy i dokumenty formalne (`helpDocument`) |
| `poradniki` | Poradniki: lista + wpis `[slug]` (`guide`, `guideCategory`) |

## Key Conventions

- **Prices**: Product prices live in Sanity. Order prices are snapshotted into the `order_items` MySQL table at purchase time — never recalculate from Sanity for historical orders.
- **Cena wariantu**: `effectivePrice(product, variantKey)` z `src/lib/omnibus.ts` (cena wariantu → cena produktu). Tej samej reguły używają koszyk, checkout, kafelki i rejestr cen — nie licz ceny inaczej.
- **Images**: All product images are served from `cdn.sanity.io` via the `urlFor()` helper from `src/lib/`.
- **Styling**: Tailwind CSS 4 is the default. `styled-components` is used for more complex component styling.
- **TypeScript path alias**: `@/` maps to `src/`.
- **Admin CSV import**: Products can be bulk-imported via CSV through `/admin`; the import pipeline is in `src/app/api/sanity/` and `src/sanity/helpers/`.

## Panel admina (`/admin`)

Design przeniesiony 1:1 z panelu meblove (`praktyki/meblove/apps/admin`): okno
aplikacji z sidebarem, topbarem, kartami, pigułkami filtrów i tabelami; paleta
Inter + akcent `#ec3013`, tryb ciemny. Dane — z integracji HAU (MySQL, Sanity,
Autopay/Przelewy24, Furgonetka, SMTP).

- **Tokeny stylu**: `@theme inline` w `src/app/globals.css` mapuje klasy
  (`bg-surface`, `text-text-2`, `rounded-xs`, `shadow-1`…) na zmienne `--adm-*`,
  które istnieją tylko pod `.hau-admin` (`src/app/(admin)/admin/admin-theme.css`).
  Poza panelem zmienne są niezdefiniowane, a promienie mają fallback do domyślnej
  skali — **sklep nie zmienia wyglądu**. Nie przenoś tych tokenów do zwykłego `@theme`.
- **Komponenty**: `src/components/admin/kit` (UI kit), `layout` (AdminShell, Sidebar,
  Topbar, nawigacja), oraz moduły: `dashboard`, `orders`, `products`, `categories`,
  `shipping`, `payments`, `marketing`, `import`, `settings`. Modale renderują się
  portalem do `.hau-admin`, żeby dziedziczyć tokeny.
- **Dane**: `src/lib/admin/*` (server-only) — `dashboardQueries`, `ordersQueries`,
  `catalog` (Sanity), `counters` (liczniki sidebaru), `integrations` (stan połączeń),
  `guard` (`requireAdmin`, `runAdminAction` → `{ ok, data | error }`).
- **Akcje**: `src/actions/admin*.ts` — każda sprawdza rolę admina i zwraca wynik
  zamiast rzucać (Next maskuje treść wyjątków na produkcji).
- **Publikacja w Sanity**: panel czyta katalog w perspektywie `raw`.
  Opublikowany = istnieje `<id>`; „zmiany w szkicu” = `<id>` + `drafts.<id>`;
  szkic = tylko `drafts.<id>`. Edycje z panelu trafiają do OBU wersji
  (`patchAllVersions`), „Wycofaj” przenosi dokument do szkicu, nowe produkty
  powstają jako szkic. Stan magazynu jest USTAWIANY (nie dodawany).
- **Statusy zamówień**: ręczne przejścia tylko wg `ORDER_TRANSITIONS`
  (`src/lib/admin/labels.ts`); `paid` ustawiają wyłącznie webhooki operatorów.
  „Zwrócone” zmienia tylko status — przelew zwrotny zleca się u operatora.
- **Dostawy**: checkout korzysta z dokumentów Sanity `shipping_methods`
  (`internal_price`, `furgonetka_service_id`, `type`, `active`) i tylko je edytuje
  zakładka Dostawy. Tabela MySQL `delivery_services` to pomocnicza kopia usług
  z konta Furgonetki (przycisk „Synchronizuj”). Checkout pokazuje wyłącznie
  metody z `active === true` (tak samo waliduje serwer).
- **Przesyłki**: kurier przez API Furgonetki; zamówienia do paczkomatu nadaje się
  w panelu Furgonetki i rejestruje numer ręcznie (status też ręcznie).
- `/api/sanity/import-csv` wymaga roli admina (middleware przepuszcza `/api/sanity/*`),
  ZIP ze zdjęciami jest opcjonalny. `/upload` przekierowuje do `/admin/import`.
- `next.config.ts`: `serverActions.bodySizeLimit = 12mb` (zdjęcia produktów i CSV).

## Environment Variables

```
NEXT_PUBLIC_SANITY_PROJECT_ID
NEXT_PUBLIC_SANITY_DATASET
NEXT_PUBLIC_SANITY_API_VERSION
SANITY_API_TOKEN, SANITY_API_READ_TOKEN, SANITY_API_DEPLOY_TOKEN
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
REDIS_URL
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL
NEXT_PUBLIC_CLERK_RESET_PASSWORD_URL, NEXT_PUBLIC_CLERK_VERIFY_EMAIL_URL
NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_BASE_URL
# Płatności
P24_MERCHANT_ID, P24_POS_ID, P24_API_KEY, P24_CRC_KEY
AUTOPAY_SERVICE_ID, AUTOPAY_HASH_KEY
AUTOPAY_ENV                 # test | production — wybiera testpay/pay.autopay.eu
AUTOPAY_BASE_URL            # opcjonalny override adresu bramki
AUTOPAY_HASH_ALGO           # domyślnie sha256
AUTOPAY_HASH_SEPARATOR      # domyślnie |
AUTOPAY_SEND_RETURN_URL     # true = wysyłamy dynamiczny ReturnURL (wymaga włączenia u Autopay)
AUTOPAY_RECURRING_ENABLED   # true = tokenizacja kart (wymaga włączenia usługi)
AUTOPAY_BLIK0_ENABLED       # false = powrót do przekierowania zamiast BLIK-0 (domyślnie true)
AUTOPAY_CARD_IFRAME_ENABLED # false = karta przez przekierowanie zamiast iframe (domyślnie true)
# Wysyłka — Furgonetka (InPost)
FURGONETKA_CLIENT_ID, FURGONETKA_CLIENT_SECRET
FURGONETKA_REDIRECT_URI, FURGONETKA_REFRESH_TOKEN, FURGONETKA_WEBHOOK_SECRET
NEXT_PUBLIC_FURGONETKA_MAP_API_KEY
# Newsletter — SMTP (wysyłka maili, np. Gmail/Brevo/Mailgun)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
# Rejestr cen (najniższa cena z 30 dni)
CRON_SECRET                  # Bearer dla /api/cron/price-history
SANITY_PRICE_WEBHOOK_SECRET  # sekret webhooka Sanity → /api/webhooks/sanity-prices
# Produkcja — SEO, analityka, bezpieczeństwo
NEXT_PUBLIC_GA_MEASUREMENT_ID        # G-XXXXXXXXXX — GA4; skrypt ładuje się DOPIERO po zgodzie
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION # kod z Google Search Console (opcjonalny)
CSP_MODE                             # report-only (domyślnie) | enforce | off
```

`src/lib/env.ts` sprawdza tę listę raz przy starcie procesu (woła to layout sklepu) i wypisuje raport w logu: „BŁĄD” dla braków krytycznych, „Uwaga” dla funkcji opcjonalnych. Świadomie nie rzuca wyjątkiem — brak SMTP-a nie może wywrócić sklepu. Tej samej funkcji (`findEnvIssues`) używa panel.

Uwaga: w `checkout.ts` brak `AUTOPAY_SERVICE_ID`/`AUTOPAY_HASH_KEY` poza produkcją włącza dev-bypass płatności Autopay (symuluje natychmiastowy sukces bez realnej transakcji) — w produkcji (`NODE_ENV=production`) jest to zablokowane i rzuca błąd zamiast fałszywie oznaczać zamówienie jako opłacone.

## Płatności — Autopay

Cała logika bramki siedzi w `src/lib/autopay.ts` (+ bezzależnościowy czytnik XML
w `src/lib/xml.ts`). Zasady, od których zależy działanie integracji:

- **Transakcja startuje POST-em**, nie przekierowaniem GET. `checkout()` zwraca
  `autopayForm = { url, fields }`, a `CheckoutClient` buduje ukryty formularz
  i wysyła go na `${AUTOPAY_BASE_URL}/payment`.
- **Hash** = `ALGO( wartości wszystkich wysyłanych pól, w kolejności ze specyfikacji,
  złączone separatorem, + klucz współdzielony )`. Kolejność pól trzyma
  `TRANSACTION_FIELD_ORDER` — dopisanie pola bez wstawienia go we właściwe miejsce
  tej listy zepsuje hash.
- **OrderID ma limit 32 znaków**, a `orders.id` to UUID (36). Wysyłamy UUID bez
  myślników (`toAutopayOrderId`) i odtwarzamy przy odbiorze (`fromAutopayOrderId`).
- **ITN** (`/api/webhooks/autopay`) przychodzi POST-em form-urlencoded z polem
  `transactions` = base64(XML). Jeden komunikat może nieść wiele transakcji.
  Hash liczony jest z wartości liści XML-a **w kolejności dokumentu**, z pominięciem
  `<hash>` — dlatego parser zachowuje kolejność i dlatego nie zastępuj go biblioteką
  zwracającą zwykły obiekt.
- **Odpowiedź na ITN musi być XML-em** `<confirmationList>` z własnym hashem
  (`ALGO(serviceID|orderID|CONFIRMED|klucz)`) i `Content-Type: text/xml`.
  Autopay ponawia komunikat aż do poprawnego potwierdzenia.
- **Statusem płatności rządzi ITN**, nie powrót klienta. `/api/autopay/return`
  tylko weryfikuje podpis (`ALGO(ServiceID|OrderID|klucz)`) i przekierowuje na
  zamówienie; gdy ITN jeszcze nie dotarł, pokazuje `payment=pending`.
- **Danych kartowych ani kodu BLIK nie zbieramy u siebie** — klient podaje je na
  stronie Autopay. Nie wprowadzaj z powrotem pól karty do checkoutu (PCI DSS).
- W panelu Autopay ustawione muszą być: adres powrotu → `/api/autopay/return`,
  adres ITN → `/api/webhooks/autopay`, oraz algorytm i separator zgodne z `.env`.
- Diagnostyka: `GET /api/autopay/diagnostics` (dev + rola admin) sprawdza konfigurację,
  łączność z `paywayList` i buduje przykładową transakcję z hashem.

### Trzy tryby uruchomienia płatności

`checkout()` zwraca jeden z trzech wariantów i klient decyduje, co z nim zrobić:

| Wariant | Kiedy | Co robi klient |
|---|---|---|
| `autopayForm` | pozostałe kanały i „Inne metody płatności” | ukryty formularz POST → strona Autopay |
| `autopayInline` `mode: 'blik'` | BLIK-0 (`AUTOPAY_BLIK0_ENABLED`) | panel „potwierdź w aplikacji” + odpytywanie statusu |
| `autopayInline` `mode: 'card'` | karta (`AUTOPAY_CARD_IFRAME_ENABLED`) | `<iframe>` z formularzem Autopay |
| `redirectUrl` | Przelewy24, pobranie, dev-bypass | zwykłe przekierowanie |

Oba tryby `autopayInline` idą przez `startTransactionInBackground()` — wywołanie
serwer-serwer z nagłówkiem `BmHeader: pay-bm-continue-transaction-url`. Odpowiedź
to XML `<transaction>`: albo `status` + `redirecturl`, albo `confirmation=NOTCONFIRMED`
+ `reason` (`WRONG_TICKET`, `TICKET_EXPIRED`, …). Hash odpowiedzi weryfikujemy tak
samo jak ITN — z liści XML-a w kolejności dokumentu.

Gdy przedtransakcja się nie powiedzie (usługa niewłączona, błąd bramki), checkout
**schodzi do zwykłego przekierowania** zamiast blokować płatność.

Ważne szczegóły:

- **Koszyk czyścimy dopiero po udanym starcie płatności.** BLIK-0 potrafi odrzucić
  transakcję (zły/wygasły kod) i klient musi mieć do czego wrócić. `CheckoutClient`
  ma z tego powodu wyjątek w warunku `EmptyCart`.
- **Kod BLIK zbieramy w kroku podsumowania**, nie przy wyborze metody — kod żyje ~2 minuty.
- `retryBlikPayment(orderId, code)` pozwala podać nowy kod do istniejącego zamówienia
  bez składania go od nowa.
- **Formularz karty jest hostowany przez Autopay** (`ScreenType: 'IFRAME'`). Nie
  wprowadzaj pól numeru karty ani CVV do naszego kodu — to natychmiast wciąga sklep
  w zakres PCI DSS SAQ D.
- `/api/orders/[id]/status` to jedyny sygnał o wyniku dla trybów inline (nie ma
  przekierowania, więc checkout odpytuje status aż ITN go rozstrzygnie). Dostęp ma
  właściciel zamówienia — zalogowany user albo gość po cookie `guest_id`.

## Profil klienta

Wszystko, co dotyczy konta, mieszka pod `/profile` (middleware wymusza tam logowanie):

| Ścieżka | Zawartość |
|---|---|
| `/profile/account` | dane konta |
| `/profile/orders` | lista zamówień |
| `/profile/orders/[id]` | szczegóły zamówienia |
| `/profile/wishlist` | polubione |
| `/profile/payment` | zapisane karty |

Stare `/orders` i `/orders/[id]` zostały jako przekierowania (linkują do nich maile
i historia przeglądarek) — `/orders/[id]` przenosi też parametry zapytania, żeby
`?payment=success` po powrocie z bramki nie ginęło.

`ProfileMenu` używa **ścieżek bezwzględnych** — przy adresach zagnieżdżonych
(`/profile/orders/[id]`) względne `href="orders"` rozwijało się do
`/profile/orders/orders`.

Zapisane karty: `saved_cards` trzyma wyłącznie token płatności automatycznej
i dane do wyświetlenia (maska, ważność, wydawca). Usunięcie karty dezaktywuje ją
u nas (`isActive = false`); wycofanie zgody po stronie Autopay
(`RecurringAction: DEACTIVATE`) czeka na włączenie usługi płatności automatycznych.

## Opinie o produktach

Każdy produkt z katalogu może mieć opinie (ocena 1–5 w łapkach, opcjonalny tytuł, treść 10–2000 znaków).

- **Dane**: tabela MySQL `product_reviews` (w migracji początkowej `drizzle/0000_*.sql`), `product_id` = `_id` produktu z Sanity. Jedna opinia na konto i produkt (unikalny indeks) — ponowne wysłanie formularza ją edytuje.
- **Kto**: tylko zalogowani (gość dostaje modal logowania). Opinia publikuje się od razu. `verified_purchase` liczone przy zapisie — konto ma zamówienie z produktem w statusie `paid|processing|shipped|delivered`. Podpis „Imię N.” zapisywany z Clerka w chwili dodania.
- **Moderacja**: `/admin/reviews` — ukryj/opublikuj, odpowiedź sklepu (publiczna), trwałe usunięcie. Ukryta opinia nie liczy się do średniej; edycja przez autora NIE zmienia statusu.
- **Warstwy**: `lib/reviewsShared.ts` (walidacja i typy, także w przeglądarce), `lib/reviews.ts` (server-only: zapytania, cache, limit zapisów 6/10 min na konto), `actions/reviews.ts` (dodanie/edycja/usunięcie), `actions/adminReviews.ts`, `lib/admin/reviewsQueries.ts`.
- **Cache**: podsumowanie (rozkład ocen) w Redisie `reviews:summary:<productId>` (10 min). KAŻDY zapis woła `invalidateReviewSummary` — dodając nowe miejsce zmieniające opinie, pamiętaj o tym.
- **API**: `GET /api/reviews?productId&sort&rating&offset` (lista, porcje po 5), `GET /api/reviews/summary?ids=a,b` (średnie dla kafelków, max 60 id).
- **Front**: kafelki (`ProductItem2`, `WishlistProduct`) używają `components/reviews/ProductRatingBadge` → `hooks/useReviewSummary` zbiera id z całej strony w jedno żądanie. Strona produktu liczy podsumowanie i pierwszą porcję na serwerze i renderuje `ProductReviews` (sekcja `#opinie`; `#napisz-opinie` otwiera formularz) + JSON-LD `aggregateRating`. Po zapisie `primeReviewSummary` odświeża oceny w nagłówku i kafelkach bez przeładowania.
- `components/reviews/PawRating` rysuje ułamkowe łapki przycinaniem (bez gradientów z `id`) — używaj go zamiast `Paw_Half`.

## Kolekcje produktów

Kolekcja (`collection` w Sanity) to tematyczny zbiór produktów ze stroną `/kolekcje/[slug]` (lista: `/kolekcje`). Baner strony głównej może wskazywać kolekcję — przycisk prowadzi na jej stronę.

- **Jedno źródło prawdy**: przynależność trzyma PRODUKT w polu `collections` (tablica **słabych** referencji). Dokument kolekcji nie ma listy produktów. Pole „Produkty w kolekcji” w Studio (`sanity/components/CollectionProductsInput.tsx`) to panel, który dopisuje/usuwa referencję w produktach (obie wersje: opublikowaną i szkic). Dzięki temu „dodaj produkt do kolekcji” i „wybierz kolekcję w produkcie” to ta sama operacja.
- **Słabe referencje** (`weak: true`, w danych `_weak: true`): produkt może wskazywać kolekcję istniejącą tylko jako szkic, a usunięcie kolekcji nie jest blokowane. W sklepie (perspektywa `published`) szkic kolekcji nie ma strony, a baner z nieopublikowaną kolekcją nie pokazuje przycisku.
- **Automatyczne szkice**: brakująca kolekcja podana przy produkcie powstaje jako `drafts.collection-<slug>` (deterministyczne `_id`, więc bez duplikatów). Działa w: formularzu produktu w panelu (`CollectionPicker`), imporcie CSV (kolumna `collections`, nazwy rozdzielone `;` lub `|`, przy aktualizacji kolekcje są DOKŁADANE) oraz w Studio (przycisk „Create new” w polu referencji). Dopasowanie do istniejącej kolekcji — po slugu z nazwy, bez względu na wielkość liter i polskie znaki.
- **Kod**: `sanity/lib/collectionRefs.ts` (wspólne: slugify, mutacje referencji, zapytania, sortowania — bez importów serwerowych), `lib/admin/collections.ts` (server-only: lista, tworzenie, przypisywanie, usuwanie ze sprzątaniem referencji), `actions/adminCollections.ts`, zakładka `/admin/collections` (Produkty → Kolekcje), filtr kolekcji w katalogu. Front: `getAllCollections`, `getCollectionBySlug`, `getBaners` (`collectionLink`) w `sanity/helpers/index.ts`.
- **Sortowanie** strony kolekcji: domyślne z pola `sort` kolekcji, nadpisywane `?sort=newest|price-asc|price-desc|title` (whitelista w `collectionOrderClause`).
- **Typy**: po zmianie schematu `npm run typegen`. Gdy `sanity schema extract` nie łączy się z siecią, `schema.json` można wygenerować lokalnie przez `extractSchema` z `@sanity/schema/_internal` (tak powstał obecny plik).

## Najniższa cena z 30 dni (Omnibus)

Sklep sam rejestruje historię cen i z niej wylicza „najniższą cenę z 30 dni” oraz obniżki. Ręczna „cena przekreślona” (`compareAtPrice`) jest wycofana — pole zostało w Sanity tylko do odczytu, sklep go nie używa.

- **Rejestr**: tabela MySQL `product_price_history` — przedziały `[valid_from, valid_to)` (DATETIME w UTC), osobno dla ceny bazowej produktu (`variant_key = ''`) i dla każdego wariantu (cena efektywna: wariant → produkt). `valid_to IS NULL` = cena bieżąca; unikalny indeks na kolumnie generowanej `open_marker` pilnuje jednej bieżącej ceny. Wierszy nie usuwamy.
- **Zapis** (`src/lib/priceHistory.ts`, `syncProductPrices`): uzgadnia rejestr ze ŚWIEŻYM (bez CDN) opublikowanym dokumentem — idempotentnie, w transakcji READ COMMITTED + `FOR UPDATE`, z ponawianiem przy konflikcie. Wywołują go:
  - panel admina (zapis produktu, cena wariantu, publikacja/wycofanie/usunięcie) i import CSV — `recordPriceChanges` (błąd rejestru nie psuje zapisu w Sanity),
  - webhook Sanity `POST /api/webhooks/sanity-prices` (zmiany w Studio),
  - `GET /api/cron/price-history` (`Authorization: Bearer $CRON_SECRET`, co godzinę — `.github/workflows/price-history-cron.yml` albo cron na hostingu; pierwsze wywołanie zakłada historię wszystkim produktom),
  - wyświetlenie produktu (strona produktu, `/api/prices/omnibus`) — najwyżej raz na 2 min na produkt (Redis `prices:checked:v1:<id>`).
  Nie rejestruj cen z danych z CDN/cache — rejestr cofnąłby świeżą zmianę.
- **Wyliczanie** (`src/lib/omnibus.ts`, czyste, testowalne): obniżka = bieżąca cena niższa od najniższej ceny z 30 dni PRZED jej wprowadzeniem; ta najniższa cena jest ceną przekreśloną i podstawą procentu (zaokrąglanego w dół), zamrożoną na czas obniżki. Obniżki stopniowe liczone ostrożnie (względem poprzedniej ceny). Bez obniżki — informacyjnie najniższa cena z ostatnich 30 dni (okno kroczące). Gdy cena z katalogu różni się od bieżącej w rejestrze (świeża zmiana), obniżki nie pokazujemy.
- **Odczyt**: `getOmnibusForProducts(ids, { reconcile })` (cache historii w Redisie `prices:history:v1:<id>`, 10 min, unieważniany przy zmianie). API dla kafelków: `GET /api/prices/omnibus?ids=a,b` (max 60).
- **Front**: `components/price/ProductPrice.tsx` — `useProductPrice` + `OmnibusNote` (dwie linijki „Najniższa cena z 30 dni[ przed obniżką]: …”), `PriceRow` (cena, przy obniżce przekreślona cena odniesienia i procent), `DiscountBadge`. Hook `hooks/useOmnibus` zbiera id z całej strony w jedno żądanie (jak oceny). Strona produktu liczy dane na serwerze (`ProductPagePrice`, cena WYBRANEGO wariantu). Używają tego: `ProductItem2`, `ProductItemWithoutBTN`, `WishlistProduct`, `ProductItem`, `PriceView`, karta wyszukiwarki.
- **Panel**: okno produktu → „Najniższa cena z 30 dni” (stan per wariant, historia zmian, ręczne uzgodnienie).
- **Konfiguracja webhooka** (sanity.io/manage → API → Webhooks): URL `https://<sklep>/api/webhooks/sanity-prices`, dataset `production`, trigger Create/Update/Delete, filtr `_type == "product"`, projekcja `{_id}`, bez draftów, secret = `SANITY_PRICE_WEBHOOK_SECRET`.
- **Testy**: logika Omnibus (przypadki brzegowe), rejestr na MariaDB + Redis (współbieżność, strefy czasowe, cache, wycofanie produktu) i podpis webhooka zgodny z `@sanity/webhook`.

## Sortowanie listingów

Listy produktów (`/subcategory/[slug]`, `/search`, `/kolekcje/[slug]`) mają wspólny mechanizm sortowania sterowany parametrem `?sort=`.

- **Opcje** (`src/lib/productSort.ts`, czyste, bez importów serwerowych): `popular` (domyślne), `price-asc`, `price-desc`, `discount`, `rating`, `newest`, `title`. `parseProductSort` przepuszcza tylko wartości z whitelisty, więc śmieci w adresie nie psują listy.
- **Kolejność liczy SERWER** — komponent tylko zmienia adres, dzięki czemu wynik da się zalinkować, odświeżyć i cofnąć. Sortowanie obejmuje całą listę (nie ma paginacji), więc kolejność jest pełna, a nie „per ekran”.
- **Sygnały** (`src/lib/productListing.ts`, server-only) pobierane są TYLKO dla wybranego sortowania (`signalsNeeded`):
  - popularność = sprzedane sztuki z ostatnich 90 dni (`order_items` + `orders` w statusach `paid|processing|shipped|delivered`), jedno zapytanie dla całego sklepu, cache w Redisie `products:popularity:v1` (30 min),
  - oceny = `getReviewSummaries` porcjami po 60 (ten sam cache co kafelki),
  - obniżki = procent z rejestru cen (`getOmnibusForProducts`, bez uzgadniania z Sanity).
  Awaria dowolnego źródła jest logowana i pomijana — lista zawsze się renderuje, najwyżej w słabszej kolejności.
- **Cena do sortowania** to cena widoczna na kafelku: wariant wybrany filtrami (`defaultVariant`) → pierwszy wariant → cena produktu (`listingPrice` na bazie `effectivePrice`).
- **Remisy** rozstrzyga nazwa, a na końcu `_id` — ta sama lista nigdy nie „skacze” między odświeżeniami. Produkty bez danej wartości (brak ceny, opinii, obniżki) lądują na końcu, nigdy nie znikają. Przy „Popularne” bez sprzedaży decyduje liczba opinii, potem świeżość.
- **UI**: `components/SortSelect.tsx` (klient) — pigułka w docku filtrów; zmiana zachowuje pozostałe parametry (filtry, `q`), a wybór domyślny usuwa `sort` z adresu. `SubcategoryFilterContainer` buduje adresy z bieżących `searchParams`, więc filtrowanie nie gubi sortowania.
- **Kolekcje**: domyślna kolejność nadal pochodzi z pola `sort` kolekcji w Studio (GROQ decyduje, co łapie się w limit 500), a wybór z adresu nakładany jest na wynik — dzięki temu kolekcja ma też opcje, których GROQ nie policzy (popularność, oceny, obniżki).
- **Testy**: kolejność dla każdej opcji i przypadki brzegowe (brak ceny/opinii, remisy, polskie znaki) oraz sygnały na MariaDB + Redis (okno 90 dni, statusy zamówień, cache, ponad 60 produktów, awaria bazy).


## Produkcja: zgody, SEO, nagłówki

Adres sklepu (`https://ehau.pl`) i wspólne teksty trzyma `src/lib/site.ts` (`SITE_URL`, `SITE_TITLE`, `SITE_DESCRIPTION`, `absoluteUrl`, `NOINDEX_PATHS`). `SITE_URL` bierze się z `NEXT_PUBLIC_APP_URL` — zmiana domeny to jedna zmienna, nie przeszukiwanie kodu.

### Zgody na cookies (RODO)

- **Bez zgody nie ładuje się nic opcjonalnego.** `components/consent/Analytics.tsx` wstawia najpierw `gtag('consent','default', …)` z wszystkim na `denied`, a skrypt GA4 dopiero po zgodzie na statystykę. Wycofanie zgody wysyła `consent update` od razu, bez przeładowania strony.
- **Stan zgody** to ciasteczko `hau_cookie_consent` (JSON: wersja, kategorie, `decidedAt` jako dowód zgody; 12 miesięcy, `SameSite=Lax`, `Secure` po HTTPS). Logika w `src/lib/consent.ts` — czysta, bez importów serwerowych, więc czyta ją i baner, i kod serwerowy. Podniesienie `CONSENT_VERSION` = ponowne zapytanie wszystkich.
- **Baner** (`components/consent/CookieConsent.tsx`) renderuje się dopiero po sprawdzeniu ciasteczka (nie mruga powracającym). „Odrzuć opcjonalne” jest równie łatwe jak „Akceptuję wszystkie” — tego wymaga UODO. Panel szczegółowy ma osobne przełączniki kategorii; Esc zamyka panel, ale przy pierwszej wizycie wraca do banera (decyzja musi zapaść).
- **Zmiana zdania**: przycisk „Ustawienia cookies” w stopce wysyła `CONSENT_OPEN_EVENT` (`openConsentSettings()`), baner otwiera panel z aktualnym wyborem.
- Dokument „Polityka cookies” jest w `HELP_DOCUMENTS` (`/help/polityka-cookies`) — treść wpisuje się w Sanity jak pozostałe regulaminy.

### SEO

- **Metadane**: `src/lib/seo/metadata.ts` — `pageMetadata({ title, description, path, images, index, type })` buduje tytuł, opis (przycięty do granicy zdania), kanoniczny adres i Open Graph/Twitter. Root layout ustawia `metadataBase`, szablon tytułu `%s — HAU` i domyślne `robots`. Nie wpisuj adresów ręcznie — `absoluteUrl` i `pageMetadata` pilnują jednej formy kanonicznej (m.in. strona produktu ma kanoniczny adres BEZ `?variant=`).
- **Dane strukturalne**: `organizationJsonLd()` (Organization + WebSite + SearchAction) na stronie głównej, `breadcrumbJsonLd()` na produkcie i subkategorii, pełny `Product` z `offers` (cena, waluta, dostępność) i `aggregateRating` na stronie produktu. Wstawiaj je przez `jsonLdScript(data)` — escapuje `<`, żeby treść z CMS-a nie zamknęła tagu `<script>`.
- **Mapa strony i robots**: `src/app/sitemap.ts` (produkty, subkategorie, kolekcje, poradniki, dokumenty pomocy; `revalidate = 3600`; awaria Sanity nie wywraca budowania — zostają sekcje stałe) i `src/app/robots.ts` (blokuje `NOINDEX_PATHS`, wskazuje mapę strony).
- **Nie do indeksu**: panel, Studio, kasa, koszyk, profil, logowanie, strony błędów i wyniki wyszukiwania — `robots: { index: false }` w layoutach grup tras plus `NOINDEX_PATHS` w `robots.txt`. Listingi z filtrami w adresie też idą `noindex` (duplikaty), same listingi bez parametrów — nie.
- **Obrazek podglądu**: `src/app/opengraph-image.tsx` generuje go przy budowaniu. Font ładujemy z `src/app/_og-fonts` (podzbiór Poppinsa) — wbudowany w `next/og` Noto Sans NIE MA polskich znaków i „ł/ś/ą” wychodziły jako puste prostokąty.
- `manifest.ts`, `not-found.tsx`, `error.tsx`, `global-error.tsx` — PWA i strony błędów w wyglądzie sklepu.

### Nagłówki bezpieczeństwa

`src/lib/securityHeaders.ts` (wpięte w `next.config.ts`) wysyła przy każdej odpowiedzi: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS (tylko produkcja) i CSP.

**CSP domyślnie idzie jako `Content-Security-Policy-Report-Only`** — przeglądarka tylko zgłasza naruszenia, nic nie blokuje. Po przeklikaniu kasy, mapy paczkomatów, logowania i Studio z czystą konsolą ustaw `CSP_MODE=enforce`. Lista dozwolonych źródeł odpowiada temu, co sklep faktycznie ładuje (Clerk, Sanity, Google, Autopay/P24, Furgonetka, YouTube/Vimeo) — dokładając integrację, dopisz jej hosty, inaczej po włączeniu `enforce` przestanie działać.

### Lint przy budowaniu

`next.config.ts` ma `eslint.ignoreDuringBuilds: false`, a `no-console` jest na produkcji **błędem** (dozwolone `warn`/`error`/`info`). Debugowy `console.log` nie przejdzie builda — i o to chodzi, bo wyciekał do konsoli klienta. Skrypty CLI z `src/scripts/**` mają wyjątek (konsola to ich jedyny interfejs); w płaskiej konfiguracji ESLinta ten blok musi być PO bloku ogólnym, bo wygrywa ostatnie dopasowanie.

### Gotowość produkcyjna — co sprawdzić po wdrożeniu

- `/admin/settings` pokazuje brakujące zmienne z `.env` (krytyczne vs opcjonalne) oraz gotowe adresy do wklejenia u operatorów — w tym webhook cen Sanity i zadanie cykliczne rejestru cen. Adresy MUSZĄ być pełne (`https://…`); sam `/api/…` Sanity odrzuci.
- Widżet mapy paczkomatów (`components/FurgonetkaMap.tsx`) wybiera środowisko tak samo jak `lib/furgonetka.ts`: produkcja → realne punkty, poza produkcją → piaskownica. Zaszyty na sztywno `env: 'sandbox'` pokazywał klientom testowe paczkomaty.
- Po pierwszym wdrożeniu: `/robots.txt` i `/sitemap.xml` odpowiadają 200, w Search Console dodaj mapę strony, a w konsoli przeglądarki sprawdź zgłoszenia CSP przed przełączeniem na `enforce`.

## Wdrożenie (GitHub Actions → FTP)

`.github/workflows/node.js.yml` buduje sklep i wgrywa go na staging
(`e-hau-prod.wibbly.pl`) przy każdym pushu na branch `staging` oraz ręcznie
(Actions → Deploy staging → Run workflow). Cztery rzeczy, które trzeba wiedzieć,
zanim się go ruszy:

- **Nieudany build nie jest wdrażany.** Poprzednia wersja miała `if: always()`
  przy każdym kroku, więc paczka z błędem i tak lądowała na serwerze.
- **Na serwer idzie kompletna paczka `standalone`.** `output: 'standalone'`
  celowo NIE kopiuje `.next/static` ani `public` — robi to osobny krok
  workflow. Bez niego strona wstaje bez CSS, JS i obrazków. `node_modules`
  ze `standalone` też musi trafić na serwer (`server.js` bez niego nie wstanie),
  dlatego workflow nadpisuje domyślną listę `exclude` akcji FTP.
- **`NEXT_PUBLIC_*` są wkompilowywane w paczkę przeglądarki**, więc muszą być
  ustawione PRZY BUDOWANIU (GitHub → Settings → Environments → `staging`).
  Dopisanie ich do `.env` na serwerze nic nie zmieni. Reszta konfiguracji
  (baza, Redis, klucze płatności, SMTP) to zmienne runtime — te idą do `.env`
  obok `server.js`; Next w trybie standalone czyta ten plik przy starcie.
- **Nagłówki z `next.config.ts` (w tym CSP) powstają przy budowaniu** i trafiają
  do manifestu. `CSP_MODE` ustawia się w środowisku builda, nie na serwerze.

Dodatkowo: **`SITE_INDEXABLE=false` wyłącza indeksowanie całego środowiska**
(`robots.txt` blokuje wszystko, każda strona dostaje `noindex`). Staging musi to
mieć ustawione — kopia sklepu pod inną domeną konkurowałaby z produkcją o te
same treści. Flaga musi być ustawiona i przy budowaniu, i w `.env` serwera, bo
metadane stron prerenderowanych powstają w CI.

Uwaga na `src/lib/redis.ts`: łączy się z Redisem **przy imporcie modułu**
(top-level `await connect()`). Dlatego build w CI dostaje kontener z Redisem —
bez tego `next build` stanąłby na ECONNREFUSED przy „Collecting page data”.
Ta sama właściwość oznacza, że proces serwera nie wstanie, jeśli Redis jest
niedostępny w momencie startu.
