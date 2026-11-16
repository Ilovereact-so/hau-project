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

- **Sanity CMS** — product catalog (products, categories, subcategories, collections, banners). Queried via GROQ from `src/sanity/helpers/`. The Sanity Studio is mounted at `/studio` via `src/app/studio/` — **tylko dla adminów** (middleware: `/studio(.*)` jest w `isAdminRoute`; niezalogowany → `/sign-in?redirect_url=…`, bez roli → `/403`). Strona Studio jest `force-dynamic` — pod `force-static` renderowała się bez kontekstu clerkMiddleware, a główny `not-found.tsx` (navbar → `currentUser()`) jest renderowany w drzewie KAŻDEJ strony, więc Clerk rzucał i było 500 (`ServerUser` łapie teraz ten błąd i pokazuje wersję gościa). Studio w przeglądarce rozmawia wprost z API Sanity, więc domena sklepu musi być w sanity.io/manage → API → CORS origins z „Allow credentials”.
- **MySQL via Drizzle ORM** — transactional data: cart items, wishlist, orders, product reviews, price history. Schema in `src/db/`. Config in `drizzle.config.ts`. Migracje SQL w `drizzle/` (`0001_product_price_history.sql` — rejestr cen).
- **Redis** — caching layer for cart and wishlist with TTL-based expiry. Client in `src/lib/`.

### Poradniki (sekcja blogowa)

Poradniki są osobną gałęzią treści w Sanity, celowo odciętą od drzewa produktów:

- Typy: `guide` (wpis: tekst Portable Text + opcjonalne wideo), `guideCategory` (kategoria wpisu), `videoEmbed` (obiekt osadzany: link do YouTube/Vimeo **albo** plik wgrany do Sanity). W Studio mają własną sekcję "Poradniki" (`src/sanity/structure.ts`).
- **Nie są kategorią sklepu.** Wcześniej "Poradniki" istniały jako dokument `category`, przez co menu traktowało je jak kategorię produktową z pustym submenu. Teraz navbar renderuje je jako osobny link do `/poradniki`, a `src/lib/categoryNavigation.ts` odfiltrowuje z menu każdą kategorię o slugu/tytule z `NON_PRODUCT_CATEGORY_SLUGS` (zabezpieczenie, gdyby stary dokument wrócił do datasetu).
- Wpisy z `publishedAt` w przyszłości są ukryte na froncie — to mechanizm planowania publikacji.
- Renderer treści (`components/guides/GuideBody.tsx`) rozszerza bazowy zestaw stylów Portable Text eksportowany z `components/PortableTextContent.tsx` — regulaminy i poradniki mają dzieloną typografię, więc nie kopiuj mapy komponentów, tylko ją rozszerzaj.
- Filmy z YouTube/Vimeo ładują się dopiero po kliknięciu (fasada z miniaturą w `components/guides/VideoPlayer.tsx`) — osadzony odtwarzacz to ~1 MB skryptów na film. Miniatury lecą z `i.ytimg.com`, host jest w `next.config.ts`.
- Moduł na stronie głównej (`components/guides/GuidesCarousel.tsx`, sekcja „guides” w `HomeSections` — kolejność ustawia panel, patrz „Strona główna”) pobiera dane po stronie klienta przez `getLatestGuidesClient` — karuzele produktów, subkategorie i poradniki na stronie głównej są komponentami klienckimi (banery już NIE: patrz niżej), więc server-only `sanityFetch` tam nie działa.
- Po dodaniu tych typów odpal `npm run typegen`, żeby wygenerowane typy Sanity objęły `guide`/`guideCategory`.
- **Karta poradnika** (`components/guides/GuideCard.tsx`) układa się przez container queries (`@container`, próg 560 px SZEROKOŚCI KARTY): węższa = pionowa (okładka 16:9, kategoria na okładce), szersza = pozioma (okładka 40% / max 320 px). Ta sama karta działa w siatce `/poradniki` (`GuidesGrid`: 1 → 2 → 3 kolumny od `sm`/`2xl`, równe wysokości w rzędzie), w „Zobacz też”, na stronie głównej i w wyróżnionych. Rodzic musi dawać karcie szerokość z układu (`w-full`, `minmax(0,1fr)`), nie z treści — w kolumnie `auto` kontener zapada się do zera (stąd kolumny `#guides` w `globals.css`). Szkielet `GuideCardSkeleton` ma tę samą geometrię.
- **Blog w panelu admina** — patrz sekcja „Blog (poradniki) w panelu” niżej. Tam też bloki treści `callout`, `productEmbed`, `divider` i pola `seoTitle`/`seoDescription`.

### Centrum pomocy (`/help`)

Dokumenty `helpDocument` (regulamin, dostawa, płatności, zwroty, prywatność, cookies). Wygląd spięty z resztą sklepu: tło `patern` (jak `/poradniki`), białe karty `rounded-[30px]` z ramką `#E8E8E8`, miętowe koło z ikoną (`#e2f3f0` + `#6EB0A6`), ciemny panel w stylu stopki.

- **Lista i grupy**: `HELP_DOCUMENTS` (`constants`) ma `group` (`zakupy` | `dokumenty`) i `description` (opis na kafelku, gdy w Sanity brak `lead`); kolejność grup — `HELP_GROUPS`. Dokumenty dodane w Studio spoza listy trafiają do grupy „Pozostałe dokumenty”. Scalanie z Sanity: `lib/helpNavigation.ts` (`getHelpNavigation`, `groupHelpNavigation`, `flattenHelpNavigation` — ta ostatnia wyznacza „Poprzedni / Następny”). `column` zostaje tylko dla układu stopki.
- **Ikony** po slugu: `components/help/helpIcons.tsx` (nowy dokument bez wpisu dostaje `FileText`).
- **Strona dokumentu**: okruszki (bez `<h1>`), `HelpSidebar` (desktop: przyklejona kolumna z grupami; telefon: rząd pigułek, który `HelpChipScroller` przewija do aktywnego dokumentu), karta z nagłówkiem (ikona, tytuł, `lead`, data aktualizacji, czas czytania), spis treści `GuideToc` (wariant `inline`, od 3 nagłówków H2/H3), treść, „Poprzedni / Następny”, `HelpSupportPanel` (zamówienia, poradniki, ustawienia cookies). Pusta treść = stan „w przygotowaniu”, nie 404.
- **Kotwice**: `PortableTextContent` przyjmuje `anchors` (mapa `_key` → `id` z `guideHeadings`), więc spis treści trafia w nagłówki tak samo jak w poradnikach. `h1` z treści renderuje się jako `<h2>` (wygląd bez zmian) — strona ma jeden H1 = tytuł dokumentu.
- **Ładowanie**: `app/help/loading.tsx` i `app/help/[slug]/loading.tsx` (biblioteka `ui/Skeleton`, geometria 1:1 ze stronami).

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
- Koszyk gościa: „Kup bez logowania” → `/checkout` (kasa przyjmuje gości) + link „Masz konto? Zaloguj się” (modal z `redirectTo: '/checkout'`). Patrz „Zakup bez logowania”.

Server actions for these operations live in `src/actions/`.

## Route Groups

App routes are organized into groups under `src/app/`:

| Group | Purpose |
|---|---|
| `(auth)` | Sign-in, sign-up, password reset, SSO callback |
| `(admin)` | Panel admina `/admin/*` (dashboard, zamówienia, produkty, kategorie, import, blog, klienci, płatności, dostawy, marketing, kampanie, analityka, integracje) |
| `(products)` | Product detail pages `[slug]`, subcategory listings |
| `(client)` | Cart (także dla gości), checkout, profil (`/profile/wishlist` publiczne), order success |
| `(errors)` | 403, 404 pages |
| `(using)` | Home page with banner |
| `help` | Centrum pomocy — regulaminy i dokumenty formalne (`helpDocument`); patrz „Centrum pomocy” |
| `poradniki` | Poradniki: lista + wpis `[slug]` (`guide`, `guideCategory`) |

## Key Conventions

- **Prices**: Product prices live in Sanity. Order prices are snapshotted into the `order_items` MySQL table at purchase time — never recalculate from Sanity for historical orders.
- **Cena wariantu**: `effectivePrice(product, variantKey)` z `src/lib/omnibus.ts` (cena wariantu → cena produktu, z aktywną promocją — `lib/promotion.ts`). Tej samej reguły używają koszyk, checkout, kafelki, filtry, sortowanie i rejestr cen — nie licz ceny inaczej. Każda projekcja GROQ, z której liczysz cenę, musi zawierać `promotion` (projekcje z `...` mają je same). Cena bez promocji: `regularPrice`.
- **Images**: All product images are served from `cdn.sanity.io` via the `urlFor()` helper from `src/lib/`.
- **Styling**: Tailwind CSS 4 is the default. `styled-components` is used for more complex component styling.
- **Fonty są w repozytorium** (`src/fonts/*.woff2`, `next/font/local` w `app/layout.tsx` i `app/(admin)/layout.tsx`): Poppins 400/500/600, Fredoka (zmienna 400–600), Inter i JetBrains Mono (panel). NIE wracaj do `next/font/google` — pobierał fonty z Google przy każdym buildzie i zmiana odpowiedzi Google wywaliła build w CI (`next/font`: „Cannot read properties of null (reading '1')”). Pliki odtwarza `scripts/build-fonts.py` (google/fonts, podzbiór latin + latin-ext, zmienne przycięte do używanych wag). Fredoka nie ma polskich liter z ogonkami/kreskami (także u Google) — przeglądarka bierze je z fontu zapasowego.
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
- **Sesja w panelu** (16.11.2026): token Clerka żyje ~60 s i jest odświeżany TYLKO przy wejściu na stronę (handshake) albo przez clerk-js w tle. Żądania w tle (RSC przy nawigacji i `router.refresh()`, prefetch, server action) z przeterminowanym ciasteczkiem miały pusty `userId` i middleware przekierowywał do `/sign-in` — „losowe wylogowanie”, zwykle po powrocie do karty (AdminShell odświeża dane na `visibilitychange`). Teraz: (1) middleware przy takim żądaniu, gdy przeglądarka ma sesję (`__client_uat` ≠ 0), zwraca 401 `text/plain` → Next przeładowuje stronę w całości, Clerk odświeża sesję i panel zostaje w tym samym miejscu (`isBackgroundRequest`, `hasClientSession`); (2) AdminShell przed `router.refresh()` bierze świeży token; (3) `AdminSessionGuard` podtrzymuje token po powrocie do karty i co 45 s.
- **Wylogowanie po bezczynności**: `ADMIN_IDLE_MINUTES` = 15 (`lib/adminRequest.ts`), minutę wcześniej okno „Zostaję zalogowany / Wyloguj teraz”. Aktywność = mysz, klawiatura, przewijanie, przejście na inną podstronę i każde żądanie przez `freshSessionToken` (import, zdjęcia — trwający import nie wyloguje). Zapis w localStorage `hau_admin_last_activity:<sessionId>` — wspólny dla kart panelu, nowe logowanie liczy od zera; samo przeładowanie strony NIE jest aktywnością. Automatyczne odświeżanie panelu celowo NIE używa `freshSessionToken`. Po wylogowaniu `/sign-in?reason=idle&redirect_url=…` (komunikat na stronie logowania, powrót w to samo miejsce). Działa tylko w panelu, nie w sklepie.
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
- **Autoryzacja Furgonetki (OAuth)**: Furgonetka przyjmuje tylko adres przekierowania zapisany w jej aplikacji OAuth — inny kończy się od razu `invalid_client` (bez logowania). Aplikacja HAU ma zarejestrowany `http://localhost:3000/api/furgonetka/callback`. Adres wybiera się w `/admin/settings` przy „Autoryzuj konto” (Redis `furgonetka:oauth_redirect_uri`, `FURGONETKA_REDIRECT_URI` to tylko zapas). Po zatwierdzeniu przeglądarka ląduje na `localhost…?code=…`; ten adres wkleja się w panelu, a serwer wymienia kod z `redirect_uri` wziętym z wklejonego linku (musi być identyczny z tym z `/oauth/authorize`). Refresh token jest rotowany i żyje w Redisie; martwy (`invalid_grant`) jest usuwany. Tokenów nie wypisujemy do logu ani na stronę (`/api/furgonetka/callback` pokazuje tylko wynik).
- **Furgonetka — wersje API**: wersję operacji wybiera typ mediów `application/vnd.furgonetka.vN+json` w `Accept`/`Content-Type` (nieznana wersja jest po cichu ignorowana). `POST /packages`, `GET /packages/{id}` i `/tracking` — v2, reszta v1 (`furgonetkaRequest` w `lib/furgonetka.ts`).
- **Przesyłki kurierskie** (`adminCreateShipment`): `createShipment` (`POST /packages`: `service_id` = LICZBOWE id usługi wyliczone z kodu przez `/account/services` → `resolveServiceId`, `parcels[].type: package` — w v2 typ jest w paczce, nie na górze, `pickup`, `receiver.name`/`postcode`; puste pola pomijamy). Przesyłka ląduje w **KOSZYKU Furgonetki** (stan `waiting`) — sklep jej NIE zamawia: zamawia i opłaca się ją w panelu Furgonetki (zamawianie przez API wymagało akceptacji regulaminów przewoźników na koncie → 409 `terms_and_conditions_not_valid`, i pobierało opłatę bez kontroli admina).
- **Zamówiona = ma numer listu** (`shipments.tracking_number`, bez zmiany schematu). Numer zapisują: webhook (każdy stan poza `waiting`/`canceled`), „Odśwież status” i otwarcie zamówienia w panelu (`syncFurgonetkaShipment` w `lib/shipmentStatus.ts`: `GET /packages/{id}` → stan poza `waiting`/`queued` + `parcels[].package_no`; strona zamówienia czeka na to najwyżej 4 s). Dopiero wtedy panel pokazuje „Etykieta (PDF)”, a trasa etykiety bez numeru zwraca 409. Nieopłaconą przesyłkę można usunąć (`adminDiscardShipment` → `DELETE /packages/{id}` + wiersz w bazie) i utworzyć od nowa.
- **Adres odbioru** (`pickup`) = wpis z KSIĄŻKI ADRESOWEJ Furgonetki wybrany w `/admin/settings` (select; Redis `furgonetka:pickup_address_id`, pobierany świeżo przy każdej przesyłce). Bez wyboru: wpis z `default_pickup` w Furgonetce, na końcu `FURGONETKA_SENDER_*` z `.env`.
- **Etykieta** to PLIK, nie JSON: `GET /packages/{id}/label` (PDF albo ZPL jako tekst; 204 = jeszcze nie ma). Panel otwiera ją przez `GET /api/admin/orders/[id]/label` (admin; token API nie wychodzi do przeglądarki).
- **Statusy przesyłek są automatyczne**: webhook (`/api/webhooks/furgonetka`, logika `lib/furgonetkaWebhook.ts`) + przycisk „Odśwież status” (`adminRefreshShipment` → `GET /packages/{id}/tracking`, najświeższe zdarzenie po dacie). Oba nakładają stan przez `applyShipmentState` (`lib/shipmentStatus.ts`): przesyłka się nie cofa, zamówienie → „wysłane” po odbiorze/transporcie, → „doręczone” po doręczeniu. Przy przesyłce z Furgonetki panel NIE pokazuje ręcznych „Oznacz jako wysłane/Potwierdź doręczenie”.
- **Webhook**: JSON lub XML, suma `control` = `md5(package_id . package_no . partner_order_id . state . description . datetime . branch . sól)` (to NIE HMAC). Sól = `FURGONETKA_WEBHOOK_SECRET`, a bez niej — pobierana z API (`GET /account/settings/notification/webhook`, cache Redis 10 min, przy niezgodności pobierana ponownie). Odpowiedź ZAWSZE w formacie powiadomienia: HTTP 200 + `{"status":"OK"}` / `<status>OK</status>` (gołe „OK” = test adresu nieudany). Powiadomienie o NIEZNANEJ przesyłce dostaje OK bez weryfikacji (nic nie zmienia; tak wygląda test adresu przy zapisie, gdy API nie zna jeszcze nowej soli). Stany z myślnikami (`collected`, `transit`, `delivery`, `delivered`, `delivery-problem`…) mapuje `TRACKING_STATE_MAP`. `/admin/settings` pokazuje, czy webhook w Furgonetce wskazuje na ten sklep.
- Zamówienia do paczkomatu nadaje się w panelu Furgonetki i rejestruje numer ręcznie (status też ręcznie).
- **Kasa — dostawa do punktu jest pierwsza i domyślna** (kurier, gdy żadna metoda `automat` nie jest aktywna; `DeliveryTypeCard` ma `side`). Wyszukiwarka punktów (`Step2DeliveryPayment`) startuje sama z kodem pocztowym adresata i po wpisaniu pełnego kodu (debounce 400 ms), pokazuje **3 najbliższe punkty każdego przewoźnika** (`nearestByCarrier` w `lib/pickupPoints.ts`) + „Pokaż więcej punktów”. Kody usług normalizuje `normalizeServiceCode` (paczkomat = inpost, kiosk/ruch = orlen…) — po obu stronach, bo konfiguracja i API używają różnych nazw. Przewoźnik bez logo w repo (np. ORLEN Paczka) dostaje nazwę tekstem. `/api/furgonetka/points/search` pyta API w środowisku `FURGONETKA_API_URL` (wcześniej NODE_ENV → 403 na stagingu) i zwraca do 50 punktów od najbliższego.
- `/api/sanity/import-csv` wymaga roli admina (middleware przepuszcza `/api/sanity/*`),
  ZIP ze zdjęciami jest opcjonalny. `/upload` przekierowuje do `/admin/import`.
- `next.config.ts`: `serverActions.bodySizeLimit = 12mb` (zdjęcia produktów i CSV).
- **Zdjęcia z panelu idą przez `POST /api/admin/images`** (`target`: `product` | `collection` | `subcategory` | `home` | `campaign` | `guide` — trzy ostatnie tylko wgrywają plik), NIE przez server action: na hostingu akcja z plikiem potrafiła zawisnąć bez odpowiedzi („Wysyłam…” w nieskończoność, pusta konsola; blog miał to jeszcze do 12.11.2026 — 2 MB przechodziło, 3 MB „mieliło”). Klient (`lib/adminImageUpload.ts` → `uploadAdminImage`) ma limit 150 s, serwer — 60 s na odbiór pliku i 90 s na wysyłkę do Sanity (`withTimeout` w `catalog.ts`); błąd wraca z nazwą etapu, a log serwera ma linie `[images]` z czasami. Pliki wideo poradników: `POST /api/admin/guide-video` (`uploadGuideVideoFile`, ≤ 11 MB — `GUIDE_VIDEO_MAX_BYTES` w `lib/guides/content.ts`, sprawdzane też w przeglądarce; Sanity 120 s, log `[guide-video]`). Przed wysyłką zdjęcie przechodzi przez `prepareImageForUpload` (`lib/imageUpload.ts`): domyślnie zmniejsza tylko pliki > 9,5 MB, blog podaje `BLOG_IMAGE_PREP` (≤ 2560 px, ~2,5 MB → WebP/JPEG); GIF i SVG idą bez zmian. Nowe miejsca z uploadem plików podpinaj pod te trasy.

## Blog (poradniki) w panelu (`/admin/blog`)

Pisanie i publikacja poradników bez wchodzenia do Studio. Dane to te same dokumenty `guide`/`guideCategory` co w Studio — obie drogi działają równolegle.

- **Trasy**: `/admin/blog` (lista: filtry statusu/kategorii, wyszukiwarka + `?q=` z paska, wyróżnianie, duplikowanie), `/admin/blog/new` (po pierwszym zapisie adres zmienia się bez nawigacji na `/admin/blog/new?id=…` — NIE na `/admin/blog/<id>`, bo odświeżanie danych panelu co 60 s zamontowałoby wtedy edytor od nowa), `/admin/blog/[id]`, `/admin/blog/categories`.
- **Numeracja list jest ciągła** (`numberedListIndexes` w `lib/guides/content.ts`): akapit, zdjęcie, film, ramka, produkty albo lista punktowana MIĘDZY punktami listy numerowanej nie zaczyna liczenia od 1 („1. krok, akapit z wyjaśnieniem, 2. krok”) — od 1 zaczyna dopiero śródtytuł (H2–H4) albo separator. Portable Text nie zna „kontynuacji listy” (każdy przerwany fragment to osobna lista), więc sklep (`GuideBody`) ustawia `<ol start>` z numeru pierwszego punktu, a edytor rysuje numery z `data-num` na `.hau-li` (nie z `data-list-index` PTE, który liczy od 1 po każdym akapicie). Centrum pomocy (`PortableTextContent`) liczy po staremu.
- **Edytor treści** (`components/admin/blog/ArticleEditor.tsx`) to `@portabletext/editor` — ten sam silnik co Studio, więc treść jest zapisywana 1:1 jako Portable Text (bez konwersji HTML). Pasek: style (akapit, H2–H4, cytat), pogrubienie/kursywa/podkreślenie/przekreślenie/kod, listy, link (Ctrl+K; wyszukiwarka produktów i poradników), „Wstaw”: zdjęcie (także wklejone ze schowka), film (YouTube/Vimeo albo plik ≤ 11 MB), ramka, polecane produkty, separator. Skróty Markdown (`## `, `- `, `1. `, `> `, `**…**`, `---`). Wklejanie z Worda/Docs zachowuje nagłówki, listy i linki. Bloki można edytować (okno), przesuwać i przeciągać. Renderowany tylko w przeglądarce (`next/dynamic` z `ssr:false`) — SSR dawał losowe klucze bloków i błąd hydracji.
- **Zdarzenie `mutation` edytora przychodzi z opóźnieniem** (edytor grupuje zmiany). Zapis czyta treść przez `ArticleEditorHandle.getValue()` (stan edytora), a nie z ostatniego `onChange` — inaczej ostatnie sekundy pisania by przepadły.
- **Zapis = szkic**: `saveGuideDraft` pisze wyłącznie do `drafts.<id>` (pierwsza zmiana opublikowanego artykułu kopiuje go do szkicu, więc pola dodane w Studio nie giną). Sklep widzi zmiany dopiero po „Opublikuj” (`publishGuide` → `publishDocument`). To celowo INNE niż przy produktach (`patchAllVersions`) — tekst przepisuje się długo, z autozapisem. Wyjątek: przełącznik „Wyróżniony” na liście działa od razu na obu wersjach.
- **Autozapis** 2,5 s po zmianie + Ctrl+S; kopia robocza w `localStorage` (`hau-blog-backup:<id|new>`) z propozycją przywrócenia po ponownym wejściu; ostrzeżenie przy zamykaniu karty i przy kliknięciu linku w panelu. Edytor liczy zmiany dopiero po interakcji użytkownika (`interactedRef`) — PTE potrafi przy wczytaniu znormalizować wartość i bez tego samo otwarcie opublikowanego artykułu tworzyło szkic.
- **Konflikty**: klient wysyła `_rev` wersji, którą edytuje; gdy dokument zmienił się w Studio albo innej karcie → `GuideConflictError` i baner „Wczytaj wersję z serwera / Nadpisz moją wersją” (autozapis staje do decyzji). Patch szkicu idzie z `ifRevisionId`.
- **Sanityzacja** (`lib/guides/content.ts` → `sanitizeGuideBody`): tylko znane bloki/style/dekoratory/listy, bezpieczne adresy linków (`normalizeHref` odrzuca `javascript:`, `data:`, `//…`), poprawne referencje `image-…`/`file-…`, unikalne `_key`, limit 1500 bloków. Pominięte elementy wracają w `dropped` (toast).
- **Publikacja** wymaga tego samego co schemat w Studio (`publishBlockers`): tytuł, slug, zajawka ≤ 200, kategoria (opublikowana — referencja jest silna), okładka z alt, data (pusta = „teraz”). Data w przyszłości = zaplanowany (sklep i tak filtruje `publishedAt <= now()`).
- **Kategorie z panelu powstają od razu jako opublikowane** — Sanity nie opublikuje artykułu z silną referencją do samego szkicu. Usunięcie kategorii w użyciu jest blokowane.
- **Kontrola jakości / SEO** (`guideChecks`): długość tytułu i opisu w Google (z nadpisaniem `seoTitle`/`seoDescription`), okładka i alt, liczba słów, struktura nagłówków (H1 w treści, pominięty poziom), zdjęcia bez alt, linki do sklepu, ramka produktów. Podgląd wyniku Google i wynik 0–100.
- **Podgląd** w edytorze to ten sam `components/guides/GuideArticle.tsx`, którego używa strona `/poradniki/[slug]` (linki w podglądzie są wyłączone). Układ reaguje na szerokość KONTENERA (`@container`), nie okna.
- **Nowe bloki treści** (`sanity/schemaTypes/guideBlocks.ts`): `callout` (ton: tip/info/warning/important, tytuł, tekst), `productEmbed` (tytuł + 1–4 SŁABE referencje do produktów; GROQ na stronie dokleja `items` — nawias w `(products[]->{…})[filtr]` jest konieczny, bez niego filtr zwraca `null`), `divider` (linia/łapki). Zdjęcie w treści ma pole `caption` (podpis pod zdjęciem; `alt` nie jest już wyświetlany jako podpis w poradnikach). Stałe (tony, style, limity) — `lib/guides/content.ts`, jedno źródło dla schematu, edytora i renderera.
- **Strona artykułu**: kolumna ~760 px, spis treści z H2/H3 (sticky na szerokich ekranach, zwijany na telefonie; kotwice z `guideHeadings` — ta sama funkcja nadaje `id` nagłówkom), autor i daty („Zaktualizowano”, gdy zmiana > 1 dzień po publikacji), udostępnianie (Web Share / kopiuj link — bez skryptów serwisów społecznościowych), JSON-LD `BlogPosting` + okruszki. Kafelki poradników pokazują czas czytania wyliczony w GROQ (`round(length(pt::text(body)) / 1300)`), gdy nie wpisano go ręcznie.
- **Kod**: `lib/admin/guides.ts` (server-only), `actions/adminGuides.ts`, `components/admin/blog/*`, `app/(admin)/admin/blog/*` (`editorData.ts` — kategorie, katalog i lista artykułów dla edytora).
- **Testy** (przy wdrożeniu): sanityzacja i SEO (`lib/guides/content`), cały cykl `lib/admin/guides` na atrapie klienta Sanity z `groq-js` (tworzenie, konflikt `_rev`, publikacja, planowanie, wycofanie, odrzucenie zmian, duplikat, kategorie), interakcje edytora w przeglądarce (Markdown, skróty, link dodaj/edytuj/usuń, bloki, cofanie, wklejanie HTML).

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
AUTOPAY_CARD_IFRAME_ENABLED # true = karta w <iframe> na stronie sklepu (domyślnie false — przekierowanie; wymaga ScreenType=IFRAME u Autopay)
# Wysyłka — Furgonetka (InPost)
FURGONETKA_CLIENT_ID, FURGONETKA_CLIENT_SECRET
FURGONETKA_REDIRECT_URI, FURGONETKA_REFRESH_TOKEN, FURGONETKA_WEBHOOK_SECRET
NEXT_PUBLIC_FURGONETKA_MAP_API_KEY
NEXT_PUBLIC_FURGONETKA_ENV  # sandbox | production (build-time; mapa + API, patrz niżej)
# Newsletter — SMTP (wysyłka maili, np. Gmail/Brevo/Mailgun)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
NEWSLETTER_RATE_PER_MINUTE   # kampanie: maks. maili na minutę (domyślnie 20)
NEWSLETTER_DAILY_LIMIT       # kampanie: maks. maili na dobę, wszystkie kampanie (domyślnie 400)
# Zamówienia bez logowania — podpis linku do zamówienia gościa (opcjonalny;
# bez niego używany jest CLERK_SECRET_KEY)
ORDER_LINK_SECRET
ORDER_PAYMENT_DEADLINE_HOURS # termin płatności nieopłaconego zamówienia (domyślnie 72, 2–720)
# Rejestr cen (najniższa cena z 30 dni) i zadania cykliczne
CRON_SECRET                  # Bearer dla /api/cron/price-history, /api/cron/unpaid-orders i /api/cron/newsletter-campaigns
SANITY_PRICE_WEBHOOK_SECRET  # sekret webhooka Sanity → /api/webhooks/sanity-prices
# Produkcja — SEO, analityka, bezpieczeństwo
NEXT_PUBLIC_GA_MEASUREMENT_ID        # G-XXXXXXXXXX — GA4; skrypt ładuje się DOPIERO po zgodzie
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION # kod z Google Search Console (opcjonalny)
CSP_MODE                             # report-only (domyślnie) | enforce | off
# Dane sprzedawcy (wymóg prawny; build-time — w CI jako vars.SELLER_*)
NEXT_PUBLIC_SELLER_NAME, NEXT_PUBLIC_SELLER_ADDRESS, NEXT_PUBLIC_SELLER_NIP
NEXT_PUBLIC_SELLER_REGISTRY, NEXT_PUBLIC_SELLER_EMAIL, NEXT_PUBLIC_SELLER_PHONE
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
- **Na umowie sklepu (ServiceID 1016072) Autopay NIE udostępnia** BLIK-0 / BLIK
  Level 0 bez przekierowania (white label) ani płatności kartą One Click (kanał
  1503) / płatności automatycznych (recurring) — potwierdzone przez opiekuna
  2026-11-09. BLIK idzie przekierowaniem z `GatewayID=509` (kod wpisuje się na
  stronie Autopay). Kanał 1503 jest odfiltrowany w `/api/autopay/gateways`
  i odrzucany w `checkout()` (`validateGateway`). Zapisanych kart nie ma —
  tabela `saved_cards` i kolumny `save_card_consent`/`card_token` usunięte
  migracją `0007_remove_saved_cards`.
- W panelu Autopay ustawione muszą być: adres powrotu → `/api/autopay/return`,
  adres ITN → `/api/webhooks/autopay`, oraz algorytm i separator zgodne z `.env`.
- Diagnostyka: `GET /api/autopay/diagnostics` (dev + rola admin) sprawdza konfigurację,
  łączność z `paywayList` i buduje przykładową transakcję z hashem.

### Tryby uruchomienia płatności

`checkout()` (i „Zapłać ponownie” — `payExistingOrder()`) zwraca jeden z wariantów:

| Wariant | Kiedy | Co robi klient |
|---|---|---|
| `autopayForm` | każdy kanał Autopay (BLIK, karta, banki, portfele) i „Inne metody płatności” | ukryty formularz POST → strona Autopay |
| `autopayInline` `mode: 'card'` | karta, tylko przy `AUTOPAY_CARD_IFRAME_ENABLED=true` | `<iframe>` z formularzem Autopay |
| `redirectUrl` | Przelewy24, pobranie, dev-bypass | zwykłe przekierowanie |

Karta w ramce idzie przez `startTransactionInBackground()` — wywołanie serwer-serwer
z nagłówkiem `BmHeader: pay-bm-continue-transaction-url`. Odpowiedź to XML
`<transaction>`: albo `status` + `redirecturl`, albo `confirmation=NOTCONFIRMED` +
`reason`. Hash odpowiedzi weryfikujemy tak samo jak ITN. Gdy przedtransakcja się nie
powiedzie (usługa niewłączona, błąd bramki), checkout **schodzi do zwykłego
przekierowania** zamiast blokować płatność.

Ważne szczegóły:

- **Koszyk czyścimy dopiero po udanym starcie płatności** — gdy start się nie uda,
  klient musi mieć do czego wrócić. `CheckoutClient` ma wyjątek w warunku `EmptyCart`
  na czas płatności kartą w ramce.
- **Formularz karty jest hostowany przez Autopay**. Nie wprowadzaj pól numeru karty
  ani CVV do naszego kodu — to natychmiast wciąga sklep w zakres PCI DSS SAQ D.
- `/api/orders/[id]/status` to jedyny sygnał o wyniku dla karty w ramce (nie ma
  przekierowania, więc panel odpytuje status aż ITN go rozstrzygnie). Dostęp ma
  właściciel zamówienia — zalogowany user, gość po cookie `guest_id` albo podpisany link.

## Profil klienta

Wszystko, co dotyczy konta, mieszka pod `/profile` (middleware wymusza tam logowanie):

| Ścieżka | Zawartość |
|---|---|
| `/profile/account` | dane konta |
| `/profile/orders` | lista zamówień |
| `/profile/orders/[id]` | szczegóły zamówienia |
| `/profile/wishlist` | polubione |

(Dawnej zakładki `/profile/payment` z zapisanymi kartami nie ma — sklep nie zapisuje kart.)

Stare `/orders` i `/orders/[id]` zostały jako przekierowania (linkują do nich maile
i historia przeglądarek) — `/orders/[id]` przenosi też parametry zapytania, żeby
`?payment=success` po powrocie z bramki nie ginęło.

`ProfileMenu` używa **ścieżek bezwzględnych** — przy adresach zagnieżdżonych
(`/profile/orders/[id]`) względne `href="orders"` rozwijało się do
`/profile/orders/orders`.

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

## Kody rabatowe

Klient wpisuje kod w koszyku („Masz kod promocyjny?” rozwija pole), rabat widać w koszyku i w podsumowaniu kasy, a zamówienie zapisuje kod i kwotę (`orders.discount_code`, `discount_cents`). Admin zarządza kodami w **Marketing → Kody rabatowe** (`/admin/discounts`).

- **Dane**: MySQL `discount_codes` (typ `percent` | `fixed` | `free_shipping`, próg wartości produktów, maks. rabat dla procentu, daty ważności, limit łączny, limit na klienta, `times_used`, `is_active`) i `discount_redemptions` (jedno użycie = jedno zamówienie, `customer_key` = userId/guestId, `customer_email`). Migracja `drizzle/0002_discount_codes.sql` — **uruchamiana ręcznie na bazie** (deploy nie robi migracji); zakłada też kod `NEWSLETTER10` z maila powitalnego.
- **Reguły** (`lib/discounts.ts`, czyste, wspólne dla przeglądarki i serwera): procent/kwota od WARTOŚCI PRODUKTÓW (bez dostawy), procent zaokrąglany w dół, darmowa dostawa zeruje dostawę, jeden kod na zamówienie, do zapłaty zostaje min. 1 zł (bramki nie przyjmują 0 zł). Kody zapisywane WIELKIMI literami, klient może wpisać małymi.
- **Serwer jest źródłem prawdy.** Koszyk trzyma tylko KOD (`store/discountStore.ts`, sessionStorage); kwotę liczy `previewDiscountCode` (`actions/discounts.ts`) na cenach z Sanity (`lib/cartPricing.ts` — te same funkcje co kasa). Kasa (`actions/checkout.ts`) liczy rabat jeszcze raz w TRANSAKCJI zamówienia: `redeemDiscount` (`lib/discountServer.ts`) blokuje wiersz kodu (`FOR UPDATE`), sprawdza limity, zapisuje użycie i zwiększa licznik — równoczesne zamówienia nie przekroczą limitu, a wycofana transakcja nie zostawia użycia. Odrzucony kod → `discountRejected`, kasa zdejmuje kod i nic nie zamawia.
- **Limit na klienta** liczony po koncie ORAZ po e-mailu z zamówienia. **Anulowanie** zamówienia w panelu (`adminUpdateOrderStatus` → `cancelled`) oddaje użycie (`releaseDiscountForOrder`); zwrot (`refunded`) nie.
- **Zgadywanie kodów**: 12 nieudanych prób (nieistniejący kod) na 15 min na konto/gościa/IP — Redis `discount:failed:v1:*`.
- **Panel**: tabela kodów (korzyść, warunki, użycia, udzielone rabaty i przychód, status), okno tworzenia/edycji, włącz/wyłącz; kod użyty w zamówieniu można tylko wyłączyć (historia rozliczeń). Lista zamówień pokazuje pigułkę z kodem, szczegóły — linię „Rabat (KOD)”, eksport CSV — kolumnę kodu.
- **Testy** (przy wdrożeniu, MariaDB 10.11 + Redis): wyliczenia (procent w dół, limit maks., kwota > wartości, minimum 1 zł, darmowa dostawa, próg, daty, wyłączony), limit na klienta po koncie i e-mailu, zwolnienie po anulowaniu, rollback zamówienia, 10 równoczesnych zamówień przy limicie 3 → dokładnie 3 użycia, duplikat i walidacja w panelu.

## Kolekcje produktów

Kolekcja (`collection` w Sanity) to tematyczny zbiór produktów ze stroną `/kolekcje/[slug]` (lista: `/kolekcje`). Baner strony głównej może wskazywać kolekcję — przycisk prowadzi na jej stronę.

- **Jedno źródło prawdy**: przynależność trzyma PRODUKT w polu `collections` (tablica **słabych** referencji). Dokument kolekcji nie ma listy produktów. Pole „Produkty w kolekcji” w Studio (`sanity/components/CollectionProductsInput.tsx`) to panel, który dopisuje/usuwa referencję w produktach (obie wersje: opublikowaną i szkic). Dzięki temu „dodaj produkt do kolekcji” i „wybierz kolekcję w produkcie” to ta sama operacja.
- **Słabe referencje** (`weak: true`, w danych `_weak: true`): produkt może wskazywać kolekcję istniejącą tylko jako szkic, a usunięcie kolekcji nie jest blokowane. W sklepie (perspektywa `published`) szkic kolekcji nie ma strony, a baner z nieopublikowaną kolekcją nie pokazuje przycisku.
- **Automatyczne szkice**: brakująca kolekcja podana przy produkcie powstaje jako `drafts.collection-<slug>` (deterministyczne `_id`, więc bez duplikatów). Działa w: formularzu produktu w panelu (`CollectionPicker`), imporcie CSV (kolumna `collections`, nazwy rozdzielone `;` lub `|`, przy aktualizacji kolumna ustawia kolekcje DOKŁADNIE jak w pliku — patrz „Aktualizacja = plik nadpisuje”) oraz w Studio (przycisk „Create new” w polu referencji). Dopasowanie do istniejącej kolekcji — po slugu z nazwy, bez względu na wielkość liter i polskie znaki.
- **Kod**: `sanity/lib/collectionRefs.ts` (wspólne: slugify, mutacje referencji, zapytania, sortowania — bez importów serwerowych), `lib/admin/collections.ts` (server-only: lista, tworzenie, przypisywanie, usuwanie ze sprzątaniem referencji), `actions/adminCollections.ts`, zakładka `/admin/collections` (Produkty → Kolekcje), filtr kolekcji w katalogu. Front: `getAllCollections`, `getCollectionBySlug`, `getBaners` (`collectionLink`) w `sanity/helpers/index.ts`.
- **Sortowanie** strony kolekcji: domyślne z pola `sort` kolekcji, nadpisywane `?sort=newest|price-asc|price-desc|title` (whitelista w `collectionOrderClause`).
- **Typy**: po zmianie schematu `npm run typegen`. Gdy `sanity schema extract` nie łączy się z siecią, `schema.json` można wygenerować lokalnie przez `extractSchema` z `@sanity/schema/_internal` (tak powstał obecny plik).

## Promocje (osobno od ceny)

Zmiana pola `price` to ZWYKŁA zmiana ceny — sklep nie pokazuje wtedy przekreślenia ani informacji Omnibus. Obniżkę ogłasza się wyłącznie promocją: pole produktu `promotion` (`enabled`, `discountType` = `percent` | `price`, `value`, opcjonalnie `startsAt`/`endsAt` — promocja czasowa).

- **Logika** (`src/lib/promotion.ts`, czysta): `promotionState` (none/disabled/scheduled/active/ended/invalid), `applyPromotion` (procent liczony w groszach dla każdego wariantu; cena promocyjna obowiązuje tylko warianty droższe od niej; nigdy 0 zł ani drożej), `normalizePromotionInput` (walidacja z panelu, procent 1–90). `effectivePrice` nakłada aktywną promocję, więc koszyk, kasa i rejestr cen liczą cenę promocyjną same.
- **Panel**: okno produktu → sekcja „Promocja” (`components/admin/products/PromotionFields.tsx`, podgląd ceny, stan: trwa/zaplanowana/zakończona); katalog pokazuje etykietę pod ceną. Studio: obiekt „Promocja” w produkcie.
- **Rejestr cen** zapisuje cenę z promocją. Promocja czasowa zmienia cenę bez edycji dokumentu — moment zmiany dla crona/wyświetlenia to granica promocji (`changeMoment` w `priceHistory.ts`), nie `_updatedAt`.
- **Karuzela** pod opiniami na stronie produktu: „Produkty w promocji” (`getPromotedProducts`, GROQ + `isPromotionActive`), a bez promocji — „Zobacz też” z tej samej podkategorii.

## Najniższa cena z 30 dni (Omnibus)

Sklep sam rejestruje historię cen i z niej wylicza „najniższą cenę z 30 dni” oraz obniżki. **Pokazuje je klientowi tylko w czasie aktywnej promocji** (`resolveOmnibus(..., promotionActive)`): przekreślona cena = najniższa z 30 dni przed promocją, procent, mała szara notka „Najniższa cena z 30 dni przed obniżką”. Bez promocji — sama cena (dane Omnibus nie są nawet pobierane). Gdy promocja dopiero ruszyła, a rejestr ma jeszcze cenę sprzed niej, odniesieniem jest najniższa cena z rejestru z ostatnich 30 dni. Gdy cena promocyjna nie jest niższa od tej najniższej — brak przekreślenia (nie wolno ogłosić obniżki). Ręczna „cena przekreślona” (`compareAtPrice`) jest wycofana — pole zostało w Sanity tylko do odczytu, sklep go nie używa.

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

## Zdjęcia wariantów i import produktów

### Zdjęcia per wariant

- **Model**: zdjęcia produktu to jedna lista `images[]`; każde może mieć `variantKeys` (`_key` wariantów, może być kilka). Puste = zdjęcie WSPÓLNE. Logika w `src/lib/variantImages.ts` (czysta): `imagesForVariant` (własne wariantu → wspólne; brak obu → wszystkie), `primaryImageForVariant`, `swatchImageFor` (próbka koloru = zdjęcie wariantu w tej wartości, preferuje ten sam rozmiar), `isOrphanImage`.
- **Sklep**: strona produktu liczy galerię dla `?variant=` (`ImageView key={variant}` resetuje aktywne zdjęcie), próbki kolorów (`OptionWidthImageFromVariant`) pokazują zdjęcia wariantów, koszyk/kasa/kafelek listingu (`defaultVariant`) — zdjęcie wybranego wariantu.
- **Zdjęcie tylko usuniętych wariantów** („osierocone”) NIE jest wspólne — sklep go nie pokazuje, panel oznacza je na czerwono „ukryte”.
- **Studio**: pole „Warianty” przy zdjęciu (`sanity/components/ImageVariantsInput.tsx`) — checkboxy + skróty po wartości opcji.
- **Panel** (okno produktu, `ProductImagesManager`): wrzucenie wielu zdjęć naraz (przeciągnij/„Dodaj”), zaznaczenie jednego lub kilku i klik w wartość opcji („Kolor: mint” = wszystkie rozmiary) albo w konkretny wariant. Zapis zbiorczy z opóźnieniem 0,7 s (`adminSetImagesVariants` → `setImagesVariants`, jedna transakcja, nieistniejące warianty odrzucane). Pliki nazwane `slug-mint.jpg` przypisują się same. Zdjęcia > 10 MB zmniejsza przeglądarka (`lib/imageUpload.ts`).

### Import CSV + ZIP (`/admin/import`)

- **Dane** idą partiami po 10 wierszy (`/api/sanity/import-csv`, maks. 50/żądanie, `jobId` skleja partie w jeden wpis `import_jobs`). Logika wiersza: `src/lib/admin/productImport.ts`.
- **Odporność długiego importu** (`lib/adminRequest.ts` → `postAdminForm`): przed KAŻDĄ partią świeży token Clerka (`window.Clerk.session.getToken()` — odświeża też ciasteczko) wysyłany jako `Authorization: Bearer`. Bez tego w karcie w tle (przeglądarka usypia liczniki clerk-js) 60-sekundowy token wygasał i import stawał na 401 po kilkudziesięciu wierszach („wylogowało”). Partia jest ponawiana do 4 razy (sieć, limit 120 s, 5xx/502/504, HTML zamiast JSON-a, 401 z odświeżeniem tokenu), a gdy dalej się nie mieści — dzielona na pół (aż do 1 wiersza). Ponowienie jest bezpieczne: wiersz rozpoznaje SKU, także szkic z nieudanej próby (liczniki w `import_jobs` mogą wtedy policzyć wiersz dwa razy). Po ostatecznym błędzie panel pokazuje „Wznów import” (od pierwszego niezapisanego wiersza, albo same zdjęcia). Zdjęcia z ZIP-a: ten sam token w `uploadAdminImage`, do 3 prób na plik. Server actions kreatora poprzedza `keepSessionAlive()`. Zamknięcie karty w trakcie — ostrzeżenie `beforeunload`. Trasa loguje czas partii (`[import] zapis wierszy X–Y: N ms`).
- **Warianty** = iloczyn kolumn `filter_<opcja>` dla opcji z `productOptions`. Przy aktualizacji (po SKU) istniejąca kombinacja wartości zachowuje `_key`, SKU, własną cenę i stan (koszyki, rejestr cen i przypisania zdjęć przeżywają import). Cena wariantu równa cenie produktu jest usuwana (wariant dziedziczy cenę produktu). Stany i ceny per wariant — kolumny `stany_wariantow`/`ceny_wariantow` (niżej). Usunięte kombinacje znikają (log + podgląd).
- **Wartości filtrów** tworzą się same (`filterValue-<filtr>-<slug>`), gdy istnieje filtr; dopasowanie po slugu/nazwie bez wielkości liter i polskich znaków. Brak filtra = ostrzeżenie.
- Istniejącemu produktowi import NIE zmienia sluga, chyba że kolumna `slug` jest wypełniona. Patchowane są obie wersje (opublikowana i szkic).
- **Aktualizacja = plik nadpisuje (od 16.11.2026)**, produkt rozpoznaje `sku`. Kolumna OBECNA w pliku zastępuje dane — także pustą komórką, która czyści pole (opis, tagi, wymiary, zakładki `info_*`, flagi, kategoria, kolekcje — dokładnie te z pliku, nie dokładane). Kolumn spoza pliku import nie rusza (CSV z samym `sku` i `price` zmienia tylko ceny). Pustą komórką NIE czyścimy: `title`, `price`, `currency`, `slug` (adres zmienia tylko wypełniona kolumna). `filter_<x>` zastępuje wartości TEGO filtra; parametry filtrów spoza pliku zostają. Puste `productOptions` = produkt bez wariantów (warianty usuwane), chyba że `stany_wariantow`/`ceny_wariantow` wymienia warianty (eksport wariantów ułożonych ręcznie) — wtedy struktura zostaje, a zmieniają się stany/ceny wymienionych. Dane identyczne ze sklepem = wiersz pominięty (`Unchanged`, bez zapisu). Logika: `importProductRow` (`SIMPLE_FIELDS`, `EXISTING_PROJECTION`) — porównanie z NAJNOWSZĄ wersją (szkic przed opublikowaną), zapis do obu. Flaga pusta = „nie”, waluta pusta = PLN (bez fałszywych zmian po eksporcie). Brak pola ≠ 0 (`sameValue`): GROQ oddaje brak jako `null`, a `Number(null) === 0` — wcześniej `stock: 0` nie zapisywał się produktowi bez stanu (np. po usunięciu wariantów) i produkt zostawał „nieprowadzony”, czyli zawsze dostępny. Pełny opis: ten sam tekst co w sklepie (`pt::text`) = zostaje opis z formatowaniem. Liczby w polskim zapisie z Excela („29,99”, „1 299,00 zł”) czyta `parseDecimal`.
- **Stany i ceny wariantów z CSV**: `stany_wariantow` / `ceny_wariantow` (`lib/importVariantColumns.ts`, czyste): `Rozmiar psa: Mały=5 | Rozmiar psa: Duży=2`, kilka opcji `size: S · color: Czarny=3` (kolejność par dowolna), zamiast opisu SKU wariantu (`B1-2=4`), „—”/puste = stan nieprowadzony / cena jak produktu. Opcja = klucz albo nazwa filtra, wartość = nazwa albo slug (bez wielkości liter i ogonków). Wpis bez pasującego wariantu (np. stary rozmiar „S” po zmianie rozmiarów) i wariant bez stanu → ostrzeżenie w podglądzie. Bez tych kolumn `stock` daje ten sam stan każdemu wariantowi (ostrzeżenie). Produkt z wariantami nie ma stanu produktu (byłby zapasowym stanem każdego wariantu bez liczby — z sumą w `stock` każdy pokazywałby całą sumę).
- **„Uzupełnij stany i ceny wariantów”** (kreator importu, `lib/csvVariantTemplate.ts`, w przeglądarce): dla każdego wiersza z `productOptions` wypisuje w `stany_wariantow`/`ceny_wariantow` KAŻDĄ kombinację wartości (ten sam iloczyn co import, kolejność `productOptions`), pobiera plik do Excela (BOM, separator jak w wejściu). Wpisane wartości zostają (dopasowanie jak w imporcie; nazwy filtrów z Sanity przez `adminFilterLabels`), brakujące: stan `0`, cena `—` (= cena z `price` — celowo NIE liczba, bo po zmianie `price` warianty zostałyby ze starą ceną jako własną). Wpisy bez pasującej kombinacji są usuwane i wymienione w raporcie; wiersze bez `productOptions` bez zmian. Przycisk „Wgraj uzupełniony plik bez edycji” ładuje wynik do kreatora. Wzór CSV ma już obie kolumny.
- **Podgląd zmian w kroku „Sprawdź”** (`components/admin/import/ImportChangesPreview.tsx`): kreator puszcza suchy przebieg (`dryRun=1`, partie po 25) tej samej funkcji co zapis; każdy wiersz zwraca `diff` (`ProductDiff`: pola przed → po z rodzajem `added`/`changed`/`cleared`, warianty nowe/usunięte/zachowane, zmienione stany i ceny wariantów, ostrzeżenia, `destructive`, `unchanged`). Lista z pigułkami: Zmienione / Usuwa dane / Ostrzeżenia / Nowe / Bez zmian / Błędy; import z usuwaniem danych wymaga potwierdzenia. Testy (atrapa Sanity + `groq-js`): aktualizacja z czyszczeniem i usuwaniem wariantów (BU0003), częściowy plik, ponowny import = bez zmian, warianty ręczne + stany/ceny, nowy produkt ze stanami per wariant, eksport → import = bez zmian dla wszystkich kształtów produktów, edycja jednego stanu w Excelu.
- **Eksport CSV** (`lib/admin/productExport.ts`, przycisk w Katalogu i w Imporcie): ten sam format co import, separator `;` + BOM (polski Excel), szkic przed wersją opublikowaną. Produkty z wariantami mają pustą kolumnę `stock` — stany i ceny wariantów są w `stany_wariantow`/`ceny_wariantow`, które import CZYTA; warianty, które nie są kompletem kombinacji, dostają pusty `productOptions` (import zostawi ich strukturę, bo `stany_wariantow` je wymienia). Kolumny `status`, `zdjecia_url`, `link` są tylko informacyjne. Eksport → import = „bez zmian” (test). Wartości wariantów w `filter_*` z eksportu nie są zmianą parametrów, nawet gdy produkt z Studio ich nie miał w `filterValues`.
- **Zdjęcia NIE idą przez serwer paczką** — przeglądarka rozpakowuje ZIP (JSZip), dopasowuje pliki (`src/lib/zipImageMatching.ts`) i wysyła je po jednym (`adminUploadProductImage`, 3 równolegle, w obrębie produktu po kolei). Reguły: kolumna `images` (`front.jpg; zielona.jpg=mint; zielona-m.jpg=mint+m`) → prefiks slug/SKU w nazwie (najdłuższy wygrywa; `slug.jpg`, `slug-2.jpg` wspólne, `slug-mint-2.jpg` warianty z mint) → ręczny wybór w podglądzie. Wartości opcji dopasowujemy PRZED numerem (`matchFileToProduct`), bo wartość może zaczynać się od liczby: `miska-250-ml.jpg` = wariant 250 ml, nie zdjęcie wspólne nr 250. Kolejność: wspólne przed wariantowymi, potem numer z nazwy. Już wgrane zdjęcia (SHA-1 = hash w adresie Sanity) są pomijane, więc ZIP można wysłać ponownie. Sam ZIP (bez CSV) dogrywa zdjęcia do istniejących produktów.
- Testy przy wdrożeniu: logika dopasowań (`tsx`), pełny cykl na buildzie produkcyjnym z atrapą Sanity opartą o `groq-js` (import, reimport z usuniętym wariantem, duplikaty zdjęć, strona produktu, okno panelu).

## Widoczność, promowanie i strona główna

### Widoczność produktów = publikacja

- O tym, czy klient widzi produkt, decyduje WYŁĄCZNIE publikacja dokumentu w Sanity (szkic `drafts.<id>` = niewidoczny). Stare pole `visibility` nigdy nie było czytane przez sklep — w Studio jest schowane, import go nie ustawia.
- **Import CSV zakłada NOWE produkty jako szkice** (`drafts.<uuid>`); aktualizacja istniejącego SKU nie zmienia jego stanu publikacji. Kreator po imporcie linkuje do szkiców.
- **Katalog** (`ProductsView`): zaznaczanie (także „wszystkie widoczne” w nagłówku, zaznaczenie przeżywa zmianę filtrów), pasek akcji hurtowych — Opublikuj / Wycofaj / Promuj / Bez promowania / Bestseller / Bez bestsellera / Usuń — oraz baner „N produktów czeka w szkicach → Opublikuj wszystkie”. `adminBulkProducts` → `bulkProductAction` (`lib/admin/catalog.ts`): każdy produkt osobno (4 równolegle, maks. 500), publikacja wymaga ceny i sluga, wynik `{ done, failed[] }` — nieudane zostają zaznaczone. Publikacja/wycofanie/usunięcie zapisuje rejestr cen.
- Zmiany publikacji i flag odświeżają sklep od razu (`revalidatePath('/', 'layout')`).
- **Podgląd szkicu dla admina**: `/product/<slug>` szkicu zwraca 404 klientom, a zalogowanemu adminowi pokazuje produkt z banerem „Podgląd szkicu” (`lib/productPreview.ts`, perspektywa `drafts`, ta sama projekcja `PRODUCT_BY_ID_QUERY`). Katalog linkuje podgląd także dla szkiców.

### Promowanie (`isFeatured` / `isBestseller`)

- Kafelki (`ProductItem2`, `ProductItemWithoutBTN`, `WishlistProduct`) pokazują plakietki „Nowość”, „Bestseller” i „Polecamy” obok obniżki (`components/ProductBadges.tsx`). „Nowość” = ręczna flaga `isNew` (Studio, okno produktu, przycisk w katalogu, akcje hurtowe `new`/`unnew`, kolumna CSV `isNew`) — NIE liczy się sama z daty dodania. Flagi przełącza `setProductFlag` (`PRODUCT_FLAGS` w `lib/admin/catalog.ts`).
- Sortowanie „Popularne” na listingach: najpierw promowane, potem bestsellery, dalej sprzedaż z 90 dni (`promotionRank` w `lib/productSort.ts`).
- Karuzele strony głównej mogą filtrować „tylko promowane/bestsellery/nowości” (`onlyNew`) albo sortować „Promowane i bestsellery”.

### Strona główna (`/admin/home`, Marketing → Strona główna)

- Jeden dokument Sanity `homeLayout` (`_id: "homeLayout"`, schowany w Studio) z listą sekcji w kolejności wyświetlania: karuzele produktów (`products`) + stałe moduły (`valueBar`, `subcategories`, `guides`, `about`) — każdą można przestawiać i ukrywać. Brak dokumentu = `defaultHomeLayout()` (Najczęściej wybierane / Nowości / Polecamy).
- **Karuzela = reguła**: źródło (cały sklep / kolekcja / kategoria / subkategoria / wybrane ręcznie) + kolejność (najczęściej zamawiane = sprzedaż 90 dni, promowane, nowości, oceny, obniżka, cena, **losowo**, ręczna) + filtry (dostępne, promowane, bestsellery, w promocji) + przypięte na początek + wykluczone + limit 4–24 + link „Zobacz wszystkie” (kolekcja/subkategoria). Typy i walidacja: `lib/homeLayout.ts` (czyste); wyliczanie: `lib/homeLayout.server.ts` (`resolveHomeSections`, GROQ + sygnały z `lib/productListing.ts`).
- **Produkty liczy SERWER** i podaje do `ProductCarusel2` jako props (bez zapytań z przeglądarki). Błąd sekcji = sekcja znika, strona działa. Pusta karuzela się nie pokazuje. Szkice nigdy nie trafiają na stronę główną.
- **Losowo** (`order: 'random'`): serwer tasuje kandydatów (`shuffled` w `homeLayout.server.ts`), więc zestaw zmienia się przy odświeżeniu cache strony, a `ProductCarusel2` (`shuffle`, `pinnedCount`) tasuje kolejność PO hydracji przy każdej wizycie — przypięte zostają na początku. Nie tasuj w renderze (błąd hydracji).
- **„O nas”** (`homeLayout.about`, typ `HomeAbout` w `lib/homeLayout.ts`): napis na zdjęciu, tekst (akapity = pusta linia, `*wyróżnienie*` → kolor, renderowane Reactem przez `aboutParagraphs` — bez HTML z panelu), blok z pieskiem (nagłówek, imię, opis, zdjęcie — pokazuje się TYLKO ze zdjęciem) i przełącznik linków social. Brak danych = `DEFAULT_ABOUT` (dotychczasowy tekst). Panel: kliknięcie „O nas” na liście sekcji → `components/admin/marketing/HomeAboutEditor.tsx`; zdjęcie idzie przez `POST /api/admin/images` z `target: 'home'` (tylko asset, zapis w układzie po „Zapisz”). Projekcja dokumentu: `HOME_LAYOUT_PROJECTION`.
- **Media społecznościowe**: `shopSettings.socialFacebook|socialInstagram|socialTiktok`, karta „Media społecznościowe” w Marketing → Strona główna (`saveSocialLinks`, zapis od razu). Walidacja domen i „@nazwa” → link: `normalizeSocialUrl` (`lib/shopSettings.ts`). Ikony: `components/SocialLinks.tsx` — stopka (przez `/api/shop-settings` → `useShopSettings`) i „O nas”; strona główna dokłada `sameAs` do JSON-LD `Organization`.
- Panel: lista sekcji, edytor karuzeli, wybór produktów z wyszukiwarką, **podgląd na żywo** liczony tą samą funkcją co sklep (świeże dane, bez cache), ostrzeżenia (`sectionProblems`), zapis → `revalidatePath('/')`. `components/admin/marketing/HomeLayoutEditor.tsx`, `lib/admin/homeLayout.ts`, `actions/adminHome.ts`.

## Kategorie główne, menu i filtry listingów

- **Kolejność i ukrywanie w menu** (Produkty → Menu sklepu, `/admin/menu`): pola `menuOrder` (liczba, panel zapisuje 10, 20, 30…) i `menuHidden` w dokumentach `category` i `subcategory`. Logika czysta w `lib/menuOrder.ts` (`sortForMenu`, `visibleInMenu`, `buildMenuTree`, `planMenuChanges` — walidacja i lista tylko potrzebnych zmian), zapis `lib/admin/menu.ts` (`saveMenuLayout`: jedna transakcja na wersji opublikowanej i szkicu, potem `revalidatePath('/', 'layout')` w `actions/adminMenu.ts`). Bez `menuOrder` kolejność = `_id` (tak Sanity zwraca dokumenty bez `order()`), więc menu nie zmienia się, dopóki ktoś nie zapisze układu; sortujemy w JS, nie w GROQ. **Ukryta** = nie ma jej w menu (komputer i telefon), w pigułkach podkategorii na `/category/[slug]` ani w kafelkach podkategorii na stronie głównej; ukrycie kategorii ukrywa jej podkategorie. Strona pod adresem, produkty, wyszukiwarka i mapa strony działają dalej — to NIE jest wycofanie publikacji. Używają tego: `hooks/categories.ts` (navbar), `getCategoryBySlug` (kolejność; ukryte zostają w danych, bo ich filtry nadal działają na listingu — pigułki filtruje strona), `getSubcategories` w `clientRequest.ts` (kafelki). Podkategorie przestawia się tylko w obrębie kategorii (zmiana rodzica — Studio). Edytor: przeciąganie (HTML5) + strzałki + oko, podgląd menu, „Cofnij zmiany”, ostrzeżenie przy wyjściu. Stały link „Poradniki” zostaje na końcu menu. Kategorie → „ukryta w menu” jako plakietka.
- **Menu**: nazwa kategorii głównej (Zabawki, Przysmaki…) jest linkiem do `/category/[slug]`; w rozwijanym panelu pierwsza pozycja „Wszystko z kategorii →” (także na telefonie, gdzie dotknięcie nazwy rozwija listę). Animacja panelu trwa ~0,4 s (`variants` w `NavRMenu.tsx`, `globalDelay` 0,06 s) i na komputerze animuje WYŁĄCZNIE `clip-path` (tło zakładki, potem panel; ease-out) — nie wracaj do `max-height`/`height`: przelicza układ co klatkę, a przy sztywnym max-height i liniowym easingu panel „staje” w połowie (szarpanie). Na telefonie lista to akordeon w przepływie, więc rośnie `height: auto` (z `visibility`, nie `display`). Nasłuchy hover zakładek są zakładane raz (efekt), `NavLink` jest w `React.memo`, a `SubmenuPortal` słucha przewijania tylko przy otwartym panelu. Zmiana trasy zamyka menu na telefonie. **Otwarty jest najwyżej jeden panel** — stan trzyma `NavRMenu` (`activeSubmenu`, `openSubmenu`/`closeSubmenu`), nie zakładki. **Zakładka + panel = jeden kształt („płachta”)**: steruje nimi JEDNA wartość postępu `progress` 0 → 1 (`useMotionValue` + `useTransform` w `NavLink`), pierwsze `TAB_SHARE` (0,32) to tło zakładki, reszta to panel, jedna krzywa `SHEET_EASE`. Przy najechaniu rozwija się od góry do dołu (najpierw zakładka, panel rusza dokładnie, gdy zakładka dojdzie do dołu; 0,42 s po `globalDelay`), przy zjechaniu zwija od dołu do góry (panel, potem zakładka; 0,3 s). Przerwana animacja zawraca od bieżącego miejsca. **Przejście z jednej OTWARTEJ listy na drugą nie rozwija nowej od góry** — nowa jest od razu w całości i pojawia się przenikaniem (`fade`, opacity 0 → 1 w `SWITCH_FADE_IN` 0,16 s), a stara gaśnie w miejscu (`SWITCH_FADE_OUT` 0,12 s), po czym wraca do stanu zwiniętego. Rozwijanie od góry jest tylko przy pierwszym najechaniu, zwijanie od dołu — tylko przy zjechaniu kursorem z menu. Logika w `useLayoutEffect` (start w tej samej klatce dla obu list). Wyjazd kursorem zamyka po `LEAVE_GRACE_MS` (110 ms). Pasek przewija się do zakładki tylko przy fokusie (klawiatura), NIE przy najechaniu — przewijanie pod kursorem przełączało kategorie samo. `SubmenuPortal` śledzi pozycję jeszcze 300 ms po zamknięciu. Telefon (akordeon) ma osobne warianty `mobile*`: poprzednia lista zwija się 0,18 s przed rozwinięciem następnej. Test (przeglądarka, 10 kategorii, szybkie losowe przeloty): 0 klatek z dwiema zakładkami/panelami; wersja sprzed przebudowy: ~520 na ~845. Nie wracaj do stanu per zakładka ani do osobnych animacji zakładki i panelu.
- **Strona kategorii** (`app/(products)/category/[slug]`): produkty z `category` ALBO z podkategorii, której rodzicem jest kategoria (`getProductsByCategory`), pigułki podkategorii, filtry = suma `availableFilters` podkategorii, sortowanie, opis SEO na dole. W mapie strony i okruszkach (subkategoria, produkt).
- **Filtry** (`src/lib/listingFilters.ts`, wspólne dla kategorii, subkategorii i wyszukiwarki): adres `cena_od` / `cena_do` (całe zł, oba opcjonalne — „od 100 zł” bez górnej granicy; stary `price` = górna granica), opcje `<filter.key>=<slug>`. Cena = `effectivePrice` (z promocją). Produkty bez wariantów sprawdzane po `filterValues` i cenie produktu (wcześniej znikały przy każdym filtrze). Granice pól (podpowiedzi) = `listingPriceBounds` z całej listy — nie ma już stałego maks. 300 zł. UI: pigułka „Cena” rozwija się w pola „od – do” (`PricePill` w `SubcategoryFilterContainer`), w szufladzie na telefonie te same pola. Otwarta pigułka ceny ma TĘ SAMĄ wysokość co pozostałe (wysokość daje niewidoczny napis, pola leżą warstwą `absolute`). Liczba widocznych pigułek (`calculateVisibleCount`) odejmuje ZMIERZONE szerokości ceny (po otwarciu od razu 300 px) i „Więcej..” oraz odstępy `space-x-3` — bez stałej „400 px”; blok filtrów ma `contain: inline-size`, więc rząd pigułek nie poszerza kolumny i nie wypycha sortowania z docka (overflow nadal zakazany — przycinałby rozwijane listy).
- **Parametry ≠ warianty.** Kolumny `filter_*` z CSV (kolor, rozmiar psa…) zapisują PARAMETRY produktu (`filterValues`) — służą do filtrowania i nie są widoczne na karcie produktu. Kolumna `productOptions` mówi, które z nich tworzą WARIANTY (wybór na karcie). Produkt w jednym kolorze = `filter_color=mint` i pusta `productOptions` (bez wariantu, a filtr go znajduje). `filterListingProducts`: klucz, który jest opcją wariantów danego produktu (`variantOptionKeys`), sprawdzany na wariantach; każdy inny — na parametrach produktu (np. szelki z wariantami kolorów, ale tylko w rozmiarze „duży”, znajdują się po filtrze rozmiaru — do 13.11.2026 produkty z wariantami sprawdzano wyłącznie na wariantach i w takim przypadku znikały). Karta produktu (`VariantManage`) nie pokazuje opcji, która we wszystkich wariantach ma jedną wartość (wybór bez wyboru); bez żadnej opcji do wyboru blok znika cały (razem z „Jak dobrać rozmiar?”).
- **Nowy filtr / nowa opcja wariantu** (np. pojemność): wystarczy kolumna `filter_<nazwa>` w CSV. Nieznany filtr zakłada `ImportSession.createFilter` (`_id` = `filter-import-<klucz>`, `type: enum`, `UX_type: only-value-list`, etykieta z nagłówka, np. `filter_pojemność` → „Pojemność”), a `ensureSubcategoryFilter` dopina go do `availableFilters` podkategorii produktu (obie wersje) — TYLKO filtry z prefiksem `filter-import-`; zestaw istniejących filtrów (kolor, rozmiar) na podkategorii nadal ustawia się w Studio. Usunięty z podkategorii w Studio wróci przy kolejnym imporcie CSV z tą kolumną. Ostrzeżenia `UWAGA:` (liczone w kreatorze): opcja z `productOptions` bez filtra albo z pustą kolumną wartości. Opcje wariantu idą w kolejności `productOptions`.
- **Karta produktu a dowolne opcje** (`VariantManage`, czysta logika `lib/variantSelection.ts`): opcja bez `UX_type` (albo z nieznanym) to lista wartości (`SizeSelect`), próbki ze zdjęciami tylko dla `with-image-from-variant` — wcześniej taka opcja się nie pokazywała i nie dało się wybrać wariantu. Wartości do wyboru = występujące w WARIANTACH (`optionChoices`, kolejność z `filterValues`), nie wszystkie parametry. Kliknięcie wartości bez dokładnej kombinacji (niepełna macierz z Studio) wybiera najbliższy wariant z tą wartością (`pickVariant`) zamiast nic nie robić. `?variant=` idzie za historią przeglądarki.
- **Produkt bez wariantów** ma kartę (wcześniej 404 na `/product/[slug]`): pusty klucz wariantu = cena, stan i zdjęcia produktu, jak w koszyku i kasie (`variantId: ''`). Linki z kafelków przez `productHref` (`lib/productHref.ts`) — bez `?variant=undefined`.
- **Filtry listingu**: wartości pokazują się dla każdego filtra poza `range`/`boolean` (wcześniej tylko `type: enum` — filtr bez typu dawał pustą pigułkę); filtr bez wartości wśród produktów listy jest ukryty (pomiar pigułek liczy tylko widoczne). Kolejność wartości (`sortFilterValues`): rozmiary, potem ilości z jednostką rosnąco (`quantityOf`: 250 ml < 500 ml < 1 l; g/kg, cm/m, szt.), reszta jak w danych.
- **Brak wyników po filtrach** (`components/ListingFilterEmpty.tsx`, subkategoria/kategoria/wyszukiwarka): komunikat po lewej + „Wyczyść filtry” (adres bez filtrów, z zachowanym `sort`/`q` — `listingHrefWithoutFilters`) + „Sprawdź inne produkty z tej podkategorii/kategorii/dla frazy” = cała lista bez filtrów w wybranej kolejności. Siatka listingów: `LISTING_GRID_CLASS`.
- **Kolejność wartości filtrów**: `lib/filterValueOrder.ts` — rozmiary psa (mikro → mały → średni → duży) i XS…XXL rosnąco, reszta jak w danych (filtry i wybór rozmiaru na karcie produktu).
- Dekoracyjny obrazek `white-holo.png` przy docku filtrów został usunięty (nakładał się na filtry).

## Opisy: produkt i kategorie (SEO)

- **Produkt**: `shortDescription` = krótki opis przy cenie (zakładka „Opis”, otwarta od razu); `description` (Portable Text) = pełny opis w sekcji `#opis` pod galerią, przed opiniami.
- **Zakładki „Informacje o produkcie”** (`product.infoSections[] = { _key, title, body }`, `lib/productInfo.ts`): dowolny tytuł i treść dla KAŻDEGO produktu (np. „Skład”, „Dodatkowe informacje”), pod „Opis” w `ProductDetailsList`. Zastąpiły sztywną zakładkę „Materiał”. Stare pola `material`/`care` sklep pokazuje tylko produktom bez zapisanych zakładek (jako „Skład” / „Dodatkowe informacje”); pierwszy zapis zakładek w panelu (`ProductInfoSectionsEditor` w oknie produktu) przenosi je do zakładek i czyści stare pola. Pusta lista = zapis („wszystko usunięte”), nie powrót do starych pól. CSV: kolumny `info_<Tytuł>` (np. `info_Skład`) — gdy plik je ma, ustawiają zakładki w całości. „Szczegóły produktu” pokazują tylko wypełnione pola (SKU, wymiary, waga). W panelu oba pola (pełny opis — `components/admin/kit/RichTextEditor.tsx`, ten sam format co Studio; zapis `sanitizeRichText` z `lib/richText.ts`, tylko bloki tekstu i zdjęcia).
- **Kategoria i subkategoria**: `description` (nagłówek na górze listingu), `seoContent` (długi tekst na DOLE strony, `components/ListingSeoContent.tsx`), `metaTitle`/`metaDescription`. Pola schematu: `sanity/schemaTypes/seoContent.ts`. Panel: Kategorie → „Opis i SEO” (`TaxonomySeoModal`, akcja `adminUpdateTaxonomySeo`).
- `RichTextEditor` renderuje się dopiero po zamontowaniu (PTE przy SSR nadaje losowe klucze → błąd hydracji).

## Zakup bez logowania

- `/checkout` działa dla gości (`isGuest` → baner „Kupujesz bez logowania”, bez zapamiętywania karty i zapisu adresu). Właścicielem zamówienia gościa jest ciasteczko `guest_id` (`getOrCreateGuestId` w kasie), `orders.guest_email` = e-mail z formularza.
- **Powrót z płatności i linki**: wszystko idzie na `/orders/[id]` — zalogowany → `/profile/orders/[id]`, gość → `/zamowienie/[id]` (dostęp: ta sama przeglądarka po `guest_id` ALBO podpisany link `?t=` — `lib/orderAccess.ts`, HMAC z `ORDER_LINK_SECRET`, zapasowo `CLERK_SECRET_KEY`; zmiana sekretu unieważnia linki). Strona gościa = ten sam `Content` co w profilu (`variant="guest"`) + link do zachowania i komunikat `?payment=`.
- **Mail z potwierdzeniem zamówienia** (`lib/orderEmails.ts`, `after()` w kasie — nie opóźnia płatności): pozycje, kwoty, dostawa, link do zamówienia (gość — z tokenem). Błąd SMTP tylko w logu.
- **Logowanie po zakupie**: `hydrateUserSession` przepina zamówienia z `guest_id` tej przeglądarki na konto (`claimGuestOrders`).

## Nieopłacone zamówienia (przerwana / nieudana płatność)

Model jak w dużych sklepach (Allegro, empik, Zalando): zamówienie złożone z płatnością online, której klient nie dokończył (zamknął okno, wrócił „wstecz” z banku, odrzucony BLIK, błąd karty), **zostaje** w statusie `awaiting_payment` i czeka na płatność do terminu. Koszyk jest wtedy już pusty (czyszczony po starcie płatności) — klient płaci za ZAMÓWIENIE, nie składa go od nowa.

- **Termin**: `createdAt + ORDER_PAYMENT_DEADLINE_HOURS` (domyślnie 72 h, zakres 2–720) — `lib/paymentDeadline.ts` (czyste: `paymentDeadline`, `isPaymentOverdue`, `formatPaymentDeadline` składany z `formatToParts`, żeby serwer i przeglądarka dały ten sam tekst, `timeLeftLabel`) i `lib/unpaidOrders.server.ts` (`PAYMENT_DEADLINE_HOURS`, `orderPaymentDeadline`). Ten sam termin idzie do Autopay jako `ValidityTime` (`autopayDateTime` — `YYYY-MM-DD HH:MM:SS` czasu polskiego), więc link bramki wygasa razem z zamówieniem.
- **Zapłać ponownie**: strona zamówienia (`/profile/orders/[id]` i `/zamowienie/[id]`) ma sekcję `#platnosc` (`components/orders/PayOrderPanel.tsx`): kwota, „Opłać do … · zostało …”, wybór metody (`Step2PaymentForm` bez pobrania) i przejście na stronę Autopay (BLIK, karta, przelew). Akcja `payExistingOrder(orderId, selection, accessToken?)` (`actions/checkout.ts`): dostęp przez `resolveOrderAccess` (konto, `guest_id` albo token `?t=` z maila — także na innym urządzeniu), odrzuca opłacone/anulowane/po terminie i gdy zostało < 5 min; stare transakcje `pending` → `expired`, nowa transakcja → `initiatePayment` (te same tryby co kasa).
- **Gdzie klient trafia**: zamknięcie okienka BLIK/karty w kasie → `/orders/[id]?payment=unpaid#platnosc`; okienko ma „Wybierz inną metodę płatności”; powrót z bramki z nieudaną transakcją → `payment=failed` (`/api/autopay/return`). Panel jest wtedy czerwony („Płatność nie została dokończona”). Pusty koszyk i pusta kasa (`EmptyCart`) pokazują `PendingPaymentNotice` — „Masz nieopłacone zamówienie #… → Zapłać” (`getPendingPaymentOrder`, konto albo ciasteczko gościa). Lista zamówień w profilu ma „Opłać do …” + „Zapłać”. Status API (`/api/orders/[id]/status`) przyjmuje `?t=` dla gościa z linku.
- **Maile** (`sendUnpaidOrderEmail`, `lib/orderEmails.ts`): przypomnienie po 1 h, „ostatnia szansa” 12 h przed terminem (tylko gdy termin > 24 h), informacja o anulowaniu. Każdy najwyżej raz — flaga Redis `orders:payment-reminder:v1:<rodzaj>:<id>` (SET NX); nieudana wysyłka zwalnia flagę, więc następne uruchomienie ponowi. Mail potwierdzenia zamówienia czekającego na płatność ma termin i przycisk „Opłać zamówienie”.
- **Anulowanie po terminie**: `cancelUnpaidOrder` w transakcji — `UPDATE … WHERE status='awaiting_payment'` (sprawdza `affectedRows`, więc równoległe wywołania nie dublują), `releaseDiscountForOrder` (kod rabatowy wraca), transakcje `pending` → `expired`. Wołane przez zadanie cykliczne `GET /api/cron/unpaid-orders` (`Bearer $CRON_SECRET`, co godzinę; `processUnpaidOrders`) ORAZ leniwie przy odczycie (`expireIfOverdue` w liście/szczegółach zamówienia i przy próbie zapłaty) — sklep działa poprawnie nawet bez crona, tylko bez maili. Stan magazynu nie jest rezerwowany (schodzi dopiero po opłaceniu — patrz „Automatyczne zdejmowanie stanu”), więc anulowanie nieopłaconego zamówienia nic nie oddaje do magazynu.
- **Spóźniony ITN SUCCESS** dla anulowanego zamówienia nadal oznacza je jako opłacone (pieniądze wpłynęły) — webhook loguje ostrzeżenie do sprawdzenia w panelu.
- Strona anulowanego po terminie zamówienia pokazuje „Zamówienie anulowane — minął termin płatności”; status transakcji „Wygasła”.

## Koszyk: darmowa dostawa, płatności, stany

- **Darmowa dostawa od kwoty**: dokument Sanity `shopSettings` (`freeShippingEnabled`, `freeShippingThreshold`), edycja w panelu: Dostawy → „Darmowa dostawa od kwoty”. Liczona od wartości produktów PRZED kodem rabatowym (`lib/shopSettings.ts`). Kasa czyta świeżo (`getShopSettings({ fresh: true })`) i zeruje dostawę; koszyk/mini koszyk/kasa w przeglądarce — `GET /api/shop-settings` (`useShopSettings`). Pasek „Brakuje X zł do darmowej dostawy” (`components/cart/FreeShippingProgress.tsx`) w koszyku i w okienku po dodaniu produktu. „Dostawa od” w koszyku = najtańsza aktywna metoda.
- **„Akceptujemy”** (`components/cart/AcceptedPayments.tsx`): lista z `/api/autopay/gateways` (BLIK, szybki przelew z liczbą banków, karta, Google/Apple Pay, jeśli włączone) + „Za pobraniem”. Znaki metod: `components/payment/PaymentLogos.tsx` (wspólne z kasą).
- **Stany** (`lib/stock.ts`): stan wariantu → stan produktu; brak liczby = nieprowadzony (dostępny). „Dodaj do koszyka” i +/− w koszyku nie przekraczają stanu, wyprzedany wariant = „Chwilowo niedostępny”, kafelek pokazuje etykietę, listingi spychają wyprzedane na koniec (`sortProducts`). Kasa sprawdza stan i ilości (1–99) na ŚWIEŻYCH danych z Sanity (`lib/cartPricing.ts` → `sanityClient`, bez CDN). Po sprzedaży stan schodzi sam — patrz niżej.
- **Niski stan w panelu** = 1 sztuka albo brak (`LOW_STOCK_THRESHOLD = 2` w `lib/stock.ts`, licznik w sidebarze, filtr katalogu, dashboard).

## Automatyczne zdejmowanie stanu

Migracja **`drizzle/0006_order_stock.sql` — ręcznie na bazie, PRZED wdrożeniem kodu**: tabela `stock_movements`, kolumny `orders.stock_state` / `stock_note`; dotychczasowe złożone zamówienia dostają `legacy` (wstecz nic nie zdejmujemy).

Migracja **`drizzle/0007_remove_saved_cards.sql` — ręcznie na bazie, PO wdrożeniu kodu** (stary kod zapisuje `save_card_consent`): `DROP TABLE saved_cards`, usunięcie `payment_transactions.save_card_consent` i `card_token`. Nieodwracalna.

- **Kiedy**: po OPŁACENIU (ITN Autopay, Przelewy24, dev-bypass — `after()`, nie opóźnia potwierdzenia ITN) albo od razu przy zamówieniu za pobraniem. Nieopłacone niczego nie rezerwują. Anulowanie w panelu (`adminUpdateOrderStatus` → `cancelled`) oddaje stan sam; zwrot (`refunded`) — dopiero przyciskiem „Towar wrócił na magazyn” (`adminRestockOrder`), bo zwrot pieniędzy ≠ paczka na magazynie.
- **Gdzie** (`lib/inventory.ts`, czyste — `applyStockChange`): ta sama reguła co `variantStock` — wariant z własną liczbą → `variants[_key].stock`, inaczej wspólny `stock` produktu, brak liczby = nieprowadzony (bez zmian). Stan nigdy < 0: przy braku (dwie osoby kupiły ostatnią sztukę) zdejmujemy tyle, ile było, a `orders.stock_note` mówi, czego zabrakło (karta Magazyn). Rezerwacji przy złożeniu zamówienia NIE ma. Oddanie = dokładnie zdjęte sztuki (`applied_qty`).
- **Zapis** (`lib/inventory.server.ts`): blokada Redis na zamówienie (`inventory:order:<id>`), stan `none → pending → deducted → restored`, wiersz `stock_movements` (unikalny: zamówienie+produkt+wariant+rodzaj) PRZED zmianą w Sanity (porażka Sanity usuwa wiersz — po awarii procesu stan zostaje najwyżej NIEzdjęty, nigdy podwójnie). Sanity: transakcja z `ifRevisionId` na wersji opublikowanej i szkicu, przy 409 ponowienie od świeżych danych (do 5 prób). Szkic zmienia się o tyle, ile zdjęto w sklepie. Po zmianie `invalidateCatalogCache` + `revalidatePath('/', 'layout')`.
- **Dogrywka**: `reconcileOrderStock` (opłacone/realizowane/wysłane/doręczone z `none`/`pending`) w `GET /api/cron/unpaid-orders` i przy otwarciu zamówienia w panelu (najwyżej 4 s) + przycisk „Zdejmij stan teraz”. Anulowane bez zdjęcia zostaje `none` — spóźniony ITN SUCCESS zdejmie stan normalnie.
- **Panel**: karta „Magazyn” w `/admin/orders/[id]` (stan, ruchy „zdjęto N szt. · stan X → Y”, notatka o braku, przyciski — `OrderStockActions`).
- **Testy** (przy wdrożeniu, MariaDB 10.11 + Redis + atrapa Sanity z `groq-js` i kontrolą rewizji): wariant/stan produktu/nieprowadzony/usunięty produkt, szkic z innym stanem, brak → 0 + notatka, idempotencja, 5 równoległych zamówień tego samego produktu (konflikty rewizji → dokładnie 0), 3 równoległe wywołania jednego zamówienia, awaria Sanity → `pending` → dogrywka bez podwójnego zdjęcia, oddanie tylko zdjętych sztuk, pomijanie `legacy` i nieopłaconych.

## Newsletter (double opt-in)

1. Formularz → `subscribeToNewsletter`: zapis NIEAKTYWNY + mail „Potwierdź zapis” (szablon `newsletter_confirm`, wymagany `{{confirmUrl}}`). Ponowny mail najwcześniej po 2 min, limit 10 zapisów/h na IP (Redis).
2. `/newsletter/potwierdz?token=` → przycisk „Potwierdzam zapis” (akcja, nie samo wejście w link — skanery poczty) → `confirmed_at`, aktywny, mail powitalny z kodem (`newsletter_welcome`, `{{unsubscribeUrl}}`). Link ważny 7 dni, jednorazowy.
3. `/newsletter/wypisz?token=` (`unsub_token`) — wypisanie bez logowania.
- Migracja **`drizzle/0003_newsletter_double_optin.sql`** (ręcznie na bazie, przed wdrożeniem kodu): kolumny `confirm_token`, `confirm_sent_at`, `confirmed_at`; dotychczasowi aktywni = potwierdzeni.
- Panel Marketing: oba szablony, statystyki (aktywni / czekają / wypisani), eksport CSV aktywnych. Ręcznie da się przywrócić tylko adres, który kiedyś potwierdził zapis.

## Kampanie newslettera (`/admin/campaigns`, Marketing → Kampanie)

Maile do aktywnych subskrybentów z potwierdzonym zapisem. Migracja **`drizzle/0005_newsletter_campaigns.sql` — ręcznie na bazie** (tabele `newsletter_campaigns`, `newsletter_campaign_recipients`).

- **Treść** (`lib/campaigns/content.ts`, czyste — panel i serwer): JSON `CampaignContent` = napis obok logo (`eyebrow` → `meta` nagłówka), nagłówek, zdjęcie główne (asset Sanity, upload przez `/api/admin/images` z `target: 'campaign'`), tekst (Portable Text z `RichTextEditor`, sanityzowany `sanitizeRichText`), przycisk, kod rabatowy, do 6 produktów. `renderCampaignEmail` składa mail z klocków `lib/emailLayout.ts` (+ `emailImage`, `emailProducts`) i wersję tekstową. Linki przez `campaignHref` (`normalizeHref`; linki do sklepu dostają `utm_source=newsletter&utm_medium=email&utm_campaign=<slug nazwy>`). Ceny produktów = cena z kafelka (`listingPrice`), BEZ przekreśleń (obniżka w mailu wymagałaby informacji Omnibus). Zdjęcia do maili jako JPG (`emailImageUrl` — Outlook nie pokazuje WebP).
- **Panel**: lista (`CampaignsView`) i edytor (`CampaignEditor`) — podgląd liczony przez serwer tą samą funkcją co wysyłka (`previewCampaign`, iframe `srcDoc` z `sandbox`), komputer/telefon, mail testowy z dopiskiem `[TEST]`, „Wyślij…” (teraz albo zaplanuj; szacowany czas wg limitów). Po starcie edycja jest zablokowana — widok postępu z pauzą, wznowieniem, zatrzymaniem i listą błędów. `ProductListPicker` jest wspólny ze stroną główną.
- **Wysyłka** (`lib/campaigns/campaigns.server.ts`): start robi MIGAWKĘ odbiorców (`INSERT IGNORE … SELECT` aktywnych z `confirmed_at`) i uzupełnia brakujące `unsub_token`. `processCampaigns` uruchamia zaplanowane i wysyła partie w limitach `NEWSLETTER_RATE_PER_MINUTE` (domyślnie 20) i `NEWSLETTER_DAILY_LIMIT` (domyślnie 400 / 24 h, wszystkie kampanie — limity zwykłej skrzynki SMTP/Gmaila). Wołają ją: `after()` po starcie/wznowieniu (do 4 min), otwarty panel kampanii (co 3 s krótka partia) i cron `GET /api/cron/newsletter-campaigns` (`Bearer $CRON_SECRET`, co 5–10 min — bez niego kampania idzie tylko przy otwartym panelu). Blokada Redis `newsletter:campaigns:lock:v1` + warunkowe „zajęcie” odbiorcy (`attempts`) = żaden mail nie wychodzi dwa razy.
- **Błędy SMTP**: 550/551/552/553 → `failed` od razu; 4xx i zerwane połączenie → ponowienie później (maks. 3 próby); `EAUTH` → kampania `paused` z komunikatem. Wypisany w trakcie (`unsubscribeNewsletter` → `skipPendingForSubscriber`) dostaje `skipped`.
- **Wypisanie**: stopka z linkiem `/newsletter/wypisz?token=` + nagłówki `List-Unsubscribe` i `List-Unsubscribe-Post: List-Unsubscribe=One-Click` → `POST /api/newsletter/unsubscribe?token=` (RFC 8058; publiczne w middleware). GET tej trasy przekierowuje na stronę z przyciskiem.
- **Daty**: kolumny `datetime` zapisuje drizzle w UTC. W surowym `sql\`…\`` porównuj przez `utc(date)`, nigdy `NOW()` bazy ani gołe `Date` (mysql2 poda czas lokalny serwera) — inaczej limity rozjeżdżają się o 1–2 h.
- **Testy** (przy wdrożeniu, MariaDB 10.11 + Redis): walidacja, podgląd (escapowanie, UTM, odrzucony `javascript:`), migawka i tokeny, limit minutowy i dobowy, równoległe wywołania (blokada), wypisanie w trakcie (także One-Click), 550 / 421 z ponowieniami / EAUTH → pauza, zatrzymanie, planowanie, usuwanie; zrzuty maila (komputer/telefon) i panelu.

## Wygląd maili

Wszystkie maile (zamówienia: potwierdzenie, przypomnienie o płatności, ostatnia szansa, anulowanie; odstąpienie od umowy: klient i sklep; newsletter: „Potwierdź zapis”, powitalny; kampanie) składa `src/lib/emailLayout.ts`. Styl „profil” — ten sam język co `/profile` w sklepie: płasko i biało (bez karty na szarym tle), treść do 560 px; nagłówek = logo z lewej + kontekst z prawej (`meta`: „Zamówienie #…”, „Newsletter”, napis z kampanii) + czarna linia 1 px; tytuł Poppins 500; szare panele `#EDEDED`; czarne przyciski-pigułki (szare = drugorzędne). Kolor tylko z sensem: mięta = rabat, bursztyn = termin mija. **Bez nadtytułów wersalikami, kolorowych pasków przy komunikatach i emoji** — `emailEyebrow` usunięty celowo.

- **Klocki**: `emailHeading`, `emailParagraph`, `emailSmall`, `emailStatus` („Stan zamówienia: …”, etykiety `ORDER_STATUS_LABEL` z `lib/orderStatus.ts` — te same co w profilu), `emailSectionTitle`, `emailNote(html, { title, tone })`, `emailButton(href, label, { secondary })`, `emailCode(kod, opis)`, `emailDetails`, `emailItems` (panel pozycji jak na stronie zamówienia, z miniaturami), `emailTotals` (ostatni wiersz pod czarną linią), `emailImage`, `emailProducts`, `emailDivider`, `emailStrong`, `emailLink`; całość — `emailDocument({ meta, footer, legal, … })` (`legal` = dane sprzedawcy i prawo odstąpienia, najmniejszy tekst na dole). Nowy mail buduj z tych klocków, nie pisz własnego HTML-a.
- **Miniatury produktów** w mailach o zamówieniu: `order_items.image_url` (adres przysłany przez kasę) przechodzi przez `emailThumbUrl` — przepuszcza WYŁĄCZNIE `https://cdn.sanity.io/images/…` i buduje parametry od nowa (kwadrat 136 px, JPG, białe tło). Inny adres = szary kwadrat zamiast zdjęcia.
- **Poppins** ładuje się z Google Fonts tam, gdzie klient poczty pozwala (Apple Mail, iOS); Gmail/Outlook pokażą Helveticę/Arial — układ ten sam.
- **Logo to PNG** `public/email/hau-logo.png` (240 px, wyświetlane w 48 × 40, kolor logo `#4ECCB5`) — Gmail i Outlook NIE pokazują SVG. Plik powstał z dużej wersji logo (`logo_hau_white.svg` ma w środku PNG 2084 px). Obrazek ładuje się z adresu sklepu (`absoluteUrl`), więc na lokalnym `localhost` klient poczty go nie zobaczy.
- **HTML mailowy**: tabele + style inline, `bgcolor` dla Outlooka, `<style>` w `<head>` tylko jako dodatek (telefon: `hau-col` = kolumny jedna pod drugą, `hau-col-last`, `hau-fluid`, mniejsze miniatury). Teksty od klienta escapuje wołający (`escapeHtml`).
- **Szablony newslettera** (`DEFAULT_NEWSLETTER_*` w `lib/emailTemplates.ts`) też powstają z `emailDocument`, z placeholderami `{{shopUrl}}`, `{{logoUrl}}`, `{{email}}`, `{{confirmUrl}}`, `{{unsubscribeUrl}}`; podgląd w panelu podmienia `{{logoUrl}}`. Szablon zapisany w bazie ma pierwszeństwo — ALE zapis identyczny z jedną z WCZEŚNIEJSZYCH wersji domyślnych (odciski sha256 w `LEGACY_DEFAULT_HTML`) jest traktowany jak brak zapisu, więc nowy wygląd wchodzi sam. Zmieniając domyślny szablon, dopisz odcisk poprzedniego (i stary temat do `LEGACY_DEFAULT_SUBJECTS`, jeśli się zmienia). Szablon zmieniony ręcznie w panelu zostaje w starym wyglądzie — „Domyślny” w edytorze wczytuje nowy.
- **Kampanie**: kolejność klocków: zdjęcie, nagłówek, tekst, kod, przycisk, produkty; pole „Napis obok logo” (`content.eyebrow`) trafia do `meta` w nagłówku (pusty = „Newsletter”).
- **Testy** (przy wdrożeniu): wszystkie 13 wariantów wysłane prawdziwym kodem (MariaDB + Redis, przechwycone lokalnym SMTP), zrzuty 640/390 px; escapowanie nazw (`<Knot>`), odrzucona obca miniatura, oba warianty dopasowania odstąpienia.

## Wyszukiwarka

- Dopasowanie (`lib/search.ts`, czyste): nazwa, marka, kategoria, podkategoria, tagi, SKU, podtytuł, krótki i pełny opis; KAŻDE słowo frazy musi pasować; bez polskich znaków; prosta odmiana (rdzeń bez 1–2 ostatnich liter dla słów 5+). Ranking: nazwa > marka/kategorie/tagi/SKU > opisy, premia za frazę na początku nazwy.
- Indeks (`lib/searchIndex.server.ts`): wszystkie produkty z tekstami, pamięć procesu 5 min + cache Next. Podpowiedzi: `GET /api/search?q=` (8 trafień, `searchProductsByName` w `clientRequest.ts`). Strona `/search`: `getProductsBySearch` (pełna projekcja dla trafień), domyślne sortowanie „Trafność” (`relevance` — tylko w wyszukiwarce, `SortSelect options`).

## Rozmiary psa

Rozmiary to wartości filtra w Sanity. `scripts/migrate-dog-sizes.mjs` (sucha próba; `--apply` zapisuje) zmienia etykietę filtra na „Rozmiar psa”, przemianowuje S/M/L (XS) na Mały/Średni/Duży (Mikro) z zachowaniem `_id` (warianty i zdjęcia działają dalej), dodaje brakujące wartości i poprawia etykiety wariantów. Import CSV rozumie stare oznaczenia (`SIZE_ALIASES` w `productImport.ts`). Rozmiarów może być dowolnie wiele — wzór CSV w kreatorze ma `filter_size` = `mikro;maly;sredni;duzy`; brakująca wartość filtra powstaje sama. Przy wyborze rozmiaru na karcie produktu jest link „Jak dobrać rozmiar?” → `/help/jak-dobrac-rozmiar` (dokument w `HELP_DOCUMENTS`; treść do dodania w Studio).

## Sortowanie listingów

Listy produktów (`/subcategory/[slug]`, `/search`, `/kolekcje/[slug]`) mają wspólny mechanizm sortowania sterowany parametrem `?sort=`.

- **Opcje** (`src/lib/productSort.ts`, czyste, bez importów serwerowych): `relevance` (tylko wyszukiwarka — kolejność trafności), `popular` (domyślne), `price-asc`, `price-desc`, `discount`, `rating`, `newest`, `title`. `parseProductSort` przepuszcza tylko wartości z whitelisty, więc śmieci w adresie nie psują listy.
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
- **Mapa strony i robots**: `src/app/sitemap.ts` (produkty, subkategorie, kolekcje, poradniki, dokumenty pomocy; renderowana na żądanie z buforem procesu 1 h; awaria Sanity nie wywraca strony — zostają sekcje stałe) i `src/app/robots.ts` (blokuje `NOINDEX_PATHS`, wskazuje mapę strony).
- **Nie do indeksu**: panel, Studio, kasa, koszyk, profil, logowanie, strony błędów i wyniki wyszukiwania — `robots: { index: false }` w layoutach grup tras plus `NOINDEX_PATHS` w `robots.txt`. Listingi z filtrami w adresie też idą `noindex` (duplikaty), same listingi bez parametrów — nie.
- **Obrazek podglądu**: `src/app/opengraph-image.tsx` generuje go przy budowaniu. Font ładujemy z `src/app/_og-fonts` (podzbiór Poppinsa) — wbudowany w `next/og` Noto Sans NIE MA polskich znaków i „ł/ś/ą” wychodziły jako puste prostokąty.
- `manifest.ts` (dynamiczny — patrz „Wdrożenie”), `not-found.tsx`, `error.tsx`, `global-error.tsx` — PWA i strony błędów w wyglądzie sklepu.

### Nagłówki bezpieczeństwa

`src/lib/securityHeaders.ts` (wpięte w `next.config.ts`) wysyła przy każdej odpowiedzi: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, HSTS (tylko produkcja) i CSP.

**CSP domyślnie idzie jako `Content-Security-Policy-Report-Only`** — przeglądarka tylko zgłasza naruszenia, nic nie blokuje. Po przeklikaniu kasy, mapy paczkomatów, logowania i Studio z czystą konsolą ustaw `CSP_MODE=enforce`. Lista dozwolonych źródeł odpowiada temu, co sklep faktycznie ładuje (Clerk — także jego produkcyjna subdomena odczytana z klucza `pk_live_…` i Cloudflare Turnstile, Sanity, Google, Autopay/P24, Furgonetka, YouTube/Vimeo) — dokładając integrację, dopisz jej hosty, inaczej po włączeniu `enforce` przestanie działać.

### Lint przy budowaniu

`next.config.ts` ma `eslint.ignoreDuringBuilds: false`, a `no-console` jest na produkcji **błędem** (dozwolone `warn`/`error`/`info`). Debugowy `console.log` nie przejdzie builda — i o to chodzi, bo wyciekał do konsoli klienta. Skrypty CLI z `src/scripts/**` mają wyjątek (konsola to ich jedyny interfejs); w płaskiej konfiguracji ESLinta ten blok musi być PO bloku ogólnym, bo wygrywa ostatnie dopasowanie.

### Gotowość produkcyjna — co sprawdzić po wdrożeniu

- `/admin/settings` pokazuje brakujące zmienne z `.env` (krytyczne vs opcjonalne) oraz gotowe adresy do wklejenia u operatorów — w tym webhook cen Sanity i zadanie cykliczne rejestru cen. Adresy MUSZĄ być pełne (`https://…`); sam `/api/…` Sanity odrzuci.
- Środowisko Furgonetki (mapa paczkomatów `components/FurgonetkaMap.tsx` i API `lib/furgonetka.ts`) wybiera jedna zmienna `NEXT_PUBLIC_FURGONETKA_ENV` = `sandbox` | `production` (`lib/furgonetkaEnv.ts`; bez niej: build produkcyjny → produkcja, dev → piaskownica). Wkompilowywana przy budowaniu — w workflow stagingu z `vars.FURGONETKA_ENV`, domyślnie `sandbox`. **Klucz mapy, dane OAuth i token muszą pochodzić z konta w TYM SAMYM środowisku** — klucz z piaskownicy na `api.furgonetka.pl` daje 403 na `/points/map`. Na produkcji sklepu ustaw `production` i produkcyjne klucze, inaczej klienci zobaczą testowe paczkomaty.
- Po pierwszym wdrożeniu: `/robots.txt` i `/sitemap.xml` odpowiadają 200, w Search Console dodaj mapę strony, a w konsoli przeglądarki sprawdź zgłoszenia CSP przed przełączeniem na `enforce`.

## Wymogi prawne sklepu (PL/UE) — gdzie co jest

- **Dane sprzedawcy**: `SELLER` w `src/lib/site.ts` ze zmiennych `NEXT_PUBLIC_SELLER_NAME|ADDRESS|NIP|REGISTRY|EMAIL|PHONE` (wkompilowywane — w GitHub Actions jako `vars.SELLER_*`, plus `.env` serwera). Stopka (`<address>`), mail z potwierdzeniem zamówienia, JSON-LD `Organization`. Brak danych = blok ukryty, `env.ts` zgłasza „BŁĄD”.
- **Zwroty**: `RETURN_WINDOW_DAYS` w `site.ts` (14 = ustawowe minimum) — jedna liczba dla opisu sklepu, kasy, karty produktu, paska zalet, maili i `hasMerchantReturnPolicy`. Koszt odesłania ponosi kupujący (`RETURN_SHIPPING_PAID_BY_CUSTOMER`, tekst `RETURN_COST_NOTE`: kasa, mail z potwierdzeniem, formularz i mail odstąpienia, `returnFees` w JSON-LD) — konsument musi to wiedzieć przed zakupem (art. 12 ust. 1 pkt 10 u.p.k.). Oba muszą zgadzać się z regulaminem. **Zwrot nie przywraca stanu sam** — towar wraca na stan, gdy admin kliknie „Towar wrócił na magazyn” w karcie Magazyn zamówienia (patrz „Automatyczne zdejmowanie stanu”).
- **Kasa**: pod przyciskiem „Zamawiam i płacę” linki do regulaminu, polityki prywatności i zwrotów (nowa karta) + informacja o prawie odstąpienia.
- **Funkcja odstąpienia od umowy** (dyrektywa (UE) 2023/2673, od 19.06.2026): `/help/odstapienie-od-umowy` — dwa kroki (dane → „Potwierdzam odstąpienie od umowy”), `submitWithdrawal` (`actions/withdrawals.ts`) zapisuje oświadczenie w `order_withdrawals` (migracja **`drizzle/0004_order_withdrawals.sql` — ręcznie na bazie**), wysyła klientowi potwierdzenie z treścią i datą (trwały nośnik), a sklepowi powiadomienie (`SELLER.email`, zapasowo `SMTP_FROM`). Oświadczenie przyjmujemy też bez dopasowania zamówienia. Linki: stopka, strona zamówienia (opłaconego), mail z potwierdzeniem (z wypełnionym numerem i e-mailem). Panel: karta „Odstąpienie od umowy” w szczegółach zamówienia. Limit 10 prób/h na IP.
- **GPSR** (rozporządzenie (UE) 2023/988): pole produktu `safety` (producent: nazwa, adres, kontakt; osoba odpowiedzialna w UE; ostrzeżenia) → sekcja „Bezpieczeństwo produktu” (`components/product/ProductSafetyInfo.tsx`) i `manufacturer` w JSON-LD. Edycja w Studio.
- **Opinie**: pod podsumowaniem informacja, jak weryfikujemy opinie (art. 7 pkt 6 u.p.n.p.r.).
- **Statusy „opłacone”**: `lib/orderStatus.ts` (`isPaidOrderStatus`, `isPaymentSettled`) — webhooki płatności nie zmieniają statusu zamówienia wysłanego/doręczonego/zwróconego (ponowiony ITN cofał je na „opłacone”).

## SEO — zasady nagłówków

Na stronie jest dokładnie JEDEN `<h1>`: produkt = nazwa, kategoria/subkategoria = nazwa (w okruszku), kolekcja = tytuł (bez zdjęcia: `sr-only`), strona główna = `sr-only` z `SITE_TITLE`. Komponenty współdzielone (navbar, stopka, kafelki, karuzele, filtry) NIE używają `<h1>` — sekcje `<h2>`, nazwy produktów w kafelkach `<h3>`, etykiety `<p>`. Galeria produktu: `alt` ze zdjęcia albo „<nazwa> — zdjęcie N”. Strony prywatne mają własne tytuły kart (layouty `cart`, `sign-in`… dla stron klienckich).

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
  ze `standalone` NIE jest wgrywany (`exclude` w kroku FTP) — zależności
  instaluje „Uruchom NPM Install” w `public_html/node_modules` (patrz niżej).
- **`NEXT_PUBLIC_*` są wkompilowywane w paczkę przeglądarki**, więc muszą być
  ustawione PRZY BUDOWANIU (GitHub → Settings → Environments → `staging`).
  Dopisanie ich do `.env` na serwerze nic nie zmieni. **Pusty sekret też jest
  wartością**: trafia do paczki jako `""` (tak zniknął
  klucz mapy paczkomatów → 403 z `api.furgonetka.pl`). Krok Build przerywa się,
  gdy brakuje któregoś z kluczowych `NEXT_PUBLIC_*`. Reszta konfiguracji
  (baza, Redis, klucze płatności, SMTP) to zmienne runtime — te idą do `.env`
  obok `server.js`; Next w trybie standalone czyta ten plik przy starcie.
- **Nagłówki z `next.config.ts` (w tym CSP) powstają przy budowaniu** i trafiają
  do manifestu. `CSP_MODE` ustawia się w środowisku builda, nie na serwerze.
- **`.env` NIE jest w repozytorium** (był śledzony mimo `.gitignore` — wyjęty
  22.10.2026). Build w CI dostaje wszystko z sekretów/zmiennych środowiska
  GitHuba (sprawdzone buildem bez `.env`). Lista zmiennych z opisem: `.env.example`.
  Nowa zmienna = wpis w `.env.example` + w `env.ts` (jeśli ma być raportowana)
  + w workflow, jeśli jest potrzebna przy budowaniu.
- **Protokół FTP** wybiera zmienna `FTP_PROTOCOL` środowiska (`ftp` domyślnie,
  `ftps` szyfruje login, hasło i pliki — ustaw, gdy hosting to obsługuje).

**Po każdej zmianie wersji zależności (`package-lock.json`) kliknij na serwerze „Uruchom NPM Install”, potem restart.** Paczka zbudowana na innej wersji Next.js niż ta w `node_modules` serwera działa tylko częściowo: strony dynamiczne się renderują, ale trasy prerenderowane przy budowaniu (favicon, `manifest.webmanifest`, statyczne `/api/*` jak `/api/shop-settings`) dają 500 z `TypeError: Cannot read properties of undefined (reading 'kind')` — format wpisów cache różni się między wersjami (tak było po podbiciu `next` 15.5.25 → 15.5.27). Pilnuje tego `lib/runtimeCheck.ts`: `next.config.ts` wkleja wersję z builda jako `HAU_NEXT_BUILD_VERSION`, a serwer porównuje ją z `node_modules/next` (szukanym ręcznie od `process.cwd()` w górę — webpack podmienia `require`/`createRequire`). Rozjazd = „BŁĄD” w logu przy starcie (`reportEnvOnce`, plus linijka `[env] Next.js: paczka X, serwer Y (ścieżka)`) i czerwony komunikat w `/admin/settings`. **Środowisko Node.js panelu to `public_html`** (`source /home/srv45036/nodevenv/domains/e-hau-prod.wibbly.pl/public_html/22/bin/activate`), więc „Uruchom NPM Install” instaluje do `public_html/node_modules`. `server.js` leży w `public_html/standalone`, a Node szuka pakietów od jego katalogu w górę — **katalog `public_html/standalone/node_modules` NIE może istnieć** (pierwsza wersja workflow wgrywała go przez FTP; stary `next` 15.5.25 stamtąd przykrywał poprawną instalację i NPM Install niczego nie zmieniał — awaria 22.10). Workflow go nie wgrywa; jeśli się pojawi, przenieś go (`mv`), a kontrola wersji wskaże go w logu. `scripts/deployPackage.mjs` zapisuje przypięte zależności (z `"type": "module"` — `server.js` jest ESM) i lockfile także do `.next/standalone/`, żeby żaden `package.json` na serwerze nie miał luźnych zakresów (`^15.5.7`). **Dodatkowo nic publicznego nie jest prerenderowane przy budowaniu**, więc rozjazd wersji nie wywraca sklepu: `manifest.ts`, `robots.ts`, `sitemap.ts` i `/api/shop-settings` mają `dynamic = 'force-dynamic'` (dane buforowane w procesie: `lib/memo.ts` 60 s dla ustawień, mapa strony 1 h — pusty wynik z awarii Sanity nie jest zapamiętywany), a favicon leży w `public/favicon.ico` (zwykły plik, nie trasa z cache). **Ikony HAU**: `public/favicon.ico` (16–256 px, w małych rozmiarach pogrubiony znak), `icon-192.png`, `icon-512.png` = miętowe logo `#4ECCB5` na PRZEZROCZYSTYM tle; `apple-touch-icon.png` (180) i `icon-maskable-512.png` (manifest) zostają z miętowym tłem i białym znakiem — iOS i Android wypełniają przezroczystość czarnym/obcinają do kształtu, więc te muszą być pełne. Linki w `<head>` mają `?v=ICON_VERSION` (`app/layout.tsx`) — podbij przy zmianie ikon, bo przeglądarki trzymają faviconę (i zapamiętany błąd) tygodniami. `scripts/deployPackage.mjs` kopiuje te pliki także do `deploy-root` → `public_html/`, więc na hostingu serwuje je **Apache, bez udziału Next** (jak `_next/static`). **NIE dodawaj `src/app/favicon.ico` / `icon.*` / `robots.*` itd., gdy plik o tej nazwie jest w `public/`** — Next odpowiada wtedy 500 („conflicting public file and page file”, awaria 22.10.2026). Pilnuje tego `scripts/checkPublicConflicts.mjs` (`prebuild` i `predev`): build i `npm run dev` stają z nazwą konfliktu. Nie dodawaj `export const revalidate` do tras publicznych bez potrzeby. Wyjątek: `opengraph-image.tsx` zostaje statyczny (renderowanie obrazka na żądanie jest drogie) — przy rozjeździe wersji to on jeden da 500.

**`package.json` na serwerze NIE jest package.json projektu.** Generuje go
`scripts/deployPackage.mjs` po buildzie: tylko pakiety, których skompilowane
chunki `.next/server` wymagają w runtime (`next`, `react`, `jsdom` dla Studio…),
z dokładnymi wersjami i własnym lockfile. Panel hostingu (CloudLinux) instaluje
w `~/nodevenv/…/lib`, więc `.npmrc` z katalogu aplikacji jest ignorowany, a pełna
lista zależności wywracała instalację na skrypcie esbuilda. Krok „Test paczki
serwerowej” uruchamia `start.js` na tych zależnościach przed wysyłką FTP.

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
