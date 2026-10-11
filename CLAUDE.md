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
| `(admin)` | Panel admina `/admin/*` (dashboard, zamówienia, produkty, kategorie, import, blog, klienci, płatności, dostawy, marketing, analityka, integracje) |
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
- **Autoryzacja Furgonetki (OAuth)**: Furgonetka przyjmuje tylko adres przekierowania zapisany w jej aplikacji OAuth — inny kończy się od razu `invalid_client` (bez logowania). Aplikacja HAU ma zarejestrowany `http://localhost:3000/api/furgonetka/callback`. Adres wybiera się w `/admin/settings` przy „Autoryzuj konto” (Redis `furgonetka:oauth_redirect_uri`, `FURGONETKA_REDIRECT_URI` to tylko zapas). Po zatwierdzeniu przeglądarka ląduje na `localhost…?code=…`; ten adres wkleja się w panelu, a serwer wymienia kod z `redirect_uri` wziętym z wklejonego linku (musi być identyczny z tym z `/oauth/authorize`). Refresh token jest rotowany i żyje w Redisie; martwy (`invalid_grant`) jest usuwany.
- **Furgonetka — wersje API**: wersję operacji wybiera typ mediów `application/vnd.furgonetka.vN+json` w `Accept`/`Content-Type` (nieznana wersja jest po cichu ignorowana). `POST /packages`, `GET /packages/{id}` i `/tracking` — v2, reszta v1 (`furgonetkaRequest` w `lib/furgonetka.ts`).
- **Przesyłki kurierskie** (`adminCreateShipment`): `createShipment` (`POST /packages`: `service_id` = LICZBOWE id usługi wyliczone z kodu przez `/account/services` → `resolveServiceId`, `parcels[].type: package` — w v2 typ jest w paczce, nie na górze, `pickup`, `receiver.name`/`postcode`; puste pola pomijamy). Przesyłka ląduje w **KOSZYKU Furgonetki** (stan `waiting`) — sklep jej NIE zamawia: zamawia i opłaca się ją w panelu Furgonetki (zamawianie przez API wymagało akceptacji regulaminów przewoźników na koncie → 409 `terms_and_conditions_not_valid`, i pobierało opłatę bez kontroli admina).
- **Zamówiona = ma numer listu** (`shipments.tracking_number`, bez zmiany schematu). Numer zapisują: webhook (każdy stan poza `waiting`/`canceled`), „Odśwież status” i otwarcie zamówienia w panelu (`syncFurgonetkaShipment` w `lib/shipmentStatus.ts`: `GET /packages/{id}` → stan poza `waiting`/`queued` + `parcels[].package_no`; strona zamówienia czeka na to najwyżej 4 s). Dopiero wtedy panel pokazuje „Etykieta (PDF)”, a trasa etykiety bez numeru zwraca 409. Nieopłaconą przesyłkę można usunąć (`adminDiscardShipment` → `DELETE /packages/{id}` + wiersz w bazie) i utworzyć od nowa.
- **Adres odbioru** (`pickup`) = wpis z KSIĄŻKI ADRESOWEJ Furgonetki wybrany w `/admin/settings` (select; Redis `furgonetka:pickup_address_id`, pobierany świeżo przy każdej przesyłce). Bez wyboru: wpis z `default_pickup` w Furgonetce, na końcu `FURGONETKA_SENDER_*` z `.env`.
- **Etykieta** to PLIK, nie JSON: `GET /packages/{id}/label` (PDF albo ZPL jako tekst; 204 = jeszcze nie ma). Panel otwiera ją przez `GET /api/admin/orders/[id]/label` (admin; token API nie wychodzi do przeglądarki).
- **Statusy przesyłek są automatyczne**: webhook (`/api/webhooks/furgonetka`, logika `lib/furgonetkaWebhook.ts`) + przycisk „Odśwież status” (`adminRefreshShipment` → `GET /packages/{id}/tracking`, najświeższe zdarzenie po dacie). Oba nakładają stan przez `applyShipmentState` (`lib/shipmentStatus.ts`): przesyłka się nie cofa, zamówienie → „wysłane” po odbiorze/transporcie, → „doręczone” po doręczeniu. Przy przesyłce z Furgonetki panel NIE pokazuje ręcznych „Oznacz jako wysłane/Potwierdź doręczenie”.
- **Webhook**: JSON lub XML, suma `control` = `md5(package_id . package_no . partner_order_id . state . description . datetime . branch . sól)` (to NIE HMAC). Sól = `FURGONETKA_WEBHOOK_SECRET`, a bez niej — pobierana z API (`GET /account/settings/notification/webhook`, cache Redis 10 min, przy niezgodności pobierana ponownie). Odpowiedź ZAWSZE w formacie powiadomienia: HTTP 200 + `{"status":"OK"}` / `<status>OK</status>` (gołe „OK” = test adresu nieudany). Powiadomienie o NIEZNANEJ przesyłce dostaje OK bez weryfikacji (nic nie zmienia; tak wygląda test adresu przy zapisie, gdy API nie zna jeszcze nowej soli). Stany z myślnikami (`collected`, `transit`, `delivery`, `delivered`, `delivery-problem`…) mapuje `TRACKING_STATE_MAP`. `/admin/settings` pokazuje, czy webhook w Furgonetce wskazuje na ten sklep.
- Zamówienia do paczkomatu nadaje się w panelu Furgonetki i rejestruje numer ręcznie (status też ręcznie).
- `/api/sanity/import-csv` wymaga roli admina (middleware przepuszcza `/api/sanity/*`),
  ZIP ze zdjęciami jest opcjonalny. `/upload` przekierowuje do `/admin/import`.
- `next.config.ts`: `serverActions.bodySizeLimit = 12mb` (zdjęcia produktów i CSV).
- **Zdjęcia z panelu idą przez `POST /api/admin/images`** (`target`: `product` | `collection` | `subcategory`), NIE przez server action: na hostingu akcja z plikiem potrafiła zawisnąć bez odpowiedzi („Wysyłam…” w nieskończoność, pusta konsola). Klient (`lib/adminImageUpload.ts` → `uploadAdminImage`) ma limit 150 s, serwer — 30 s na odbiór pliku i 90 s na wysyłkę do Sanity (`withTimeout` w `catalog.ts`); błąd wraca z nazwą etapu, a log serwera ma linie `[images]` z czasami. Nowe miejsca z uploadem zdjęć podpinaj pod tę trasę.

## Blog (poradniki) w panelu (`/admin/blog`)

Pisanie i publikacja poradników bez wchodzenia do Studio. Dane to te same dokumenty `guide`/`guideCategory` co w Studio — obie drogi działają równolegle.

- **Trasy**: `/admin/blog` (lista: filtry statusu/kategorii, wyszukiwarka + `?q=` z paska, wyróżnianie, duplikowanie), `/admin/blog/new` (po pierwszym zapisie adres zmienia się bez nawigacji na `/admin/blog/new?id=…` — NIE na `/admin/blog/<id>`, bo odświeżanie danych panelu co 60 s zamontowałoby wtedy edytor od nowa), `/admin/blog/[id]`, `/admin/blog/categories`.
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
AUTOPAY_RECURRING_ENABLED   # true = tokenizacja kart (wymaga włączenia usługi)
AUTOPAY_BLIK0_ENABLED       # false = powrót do przekierowania zamiast BLIK-0 (domyślnie true)
AUTOPAY_CARD_IFRAME_ENABLED # false = karta przez przekierowanie zamiast iframe (domyślnie true)
# Wysyłka — Furgonetka (InPost)
FURGONETKA_CLIENT_ID, FURGONETKA_CLIENT_SECRET
FURGONETKA_REDIRECT_URI, FURGONETKA_REFRESH_TOKEN, FURGONETKA_WEBHOOK_SECRET
NEXT_PUBLIC_FURGONETKA_MAP_API_KEY
NEXT_PUBLIC_FURGONETKA_ENV  # sandbox | production (build-time; mapa + API, patrz niżej)
# Newsletter — SMTP (wysyłka maili, np. Gmail/Brevo/Mailgun)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
# Zamówienia bez logowania — podpis linku do zamówienia gościa (opcjonalny;
# bez niego używany jest CLERK_SECRET_KEY)
ORDER_LINK_SECRET
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
- **Automatyczne szkice**: brakująca kolekcja podana przy produkcie powstaje jako `drafts.collection-<slug>` (deterministyczne `_id`, więc bez duplikatów). Działa w: formularzu produktu w panelu (`CollectionPicker`), imporcie CSV (kolumna `collections`, nazwy rozdzielone `;` lub `|`, przy aktualizacji kolekcje są DOKŁADANE) oraz w Studio (przycisk „Create new” w polu referencji). Dopasowanie do istniejącej kolekcji — po slugu z nazwy, bez względu na wielkość liter i polskie znaki.
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
- **Warianty** = iloczyn kolumn `filter_<opcja>` dla opcji z `productOptions`. Przy aktualizacji (po SKU) istniejąca kombinacja wartości zachowuje `_key`, SKU, własną cenę i stan (koszyki, rejestr cen i przypisania zdjęć przeżywają import). Cena wariantu równa starej cenie produktu (kopia ze starego importu) jest usuwana, żeby wariant dziedziczył nową. Pusta kolumna `stock` nie zmienia stanów. Usunięte kombinacje znikają (log).
- **Wartości filtrów** tworzą się same (`filterValue-<filtr>-<slug>`), gdy istnieje filtr; dopasowanie po slugu/nazwie bez wielkości liter i polskich znaków. Brak filtra = ostrzeżenie.
- Istniejącemu produktowi import NIE zmienia sluga, chyba że kolumna `slug` jest wypełniona. Patchowane są obie wersje (opublikowana i szkic).
- **Zdjęcia NIE idą przez serwer paczką** — przeglądarka rozpakowuje ZIP (JSZip), dopasowuje pliki (`src/lib/zipImageMatching.ts`) i wysyła je po jednym (`adminUploadProductImage`, 3 równolegle, w obrębie produktu po kolei). Reguły: kolumna `images` (`front.jpg; zielona.jpg=mint; zielona-m.jpg=mint+m`) → prefiks slug/SKU w nazwie (najdłuższy wygrywa; `slug.jpg`, `slug-2.jpg` wspólne, `slug-mint-2.jpg` warianty z mint) → ręczny wybór w podglądzie. Kolejność: wspólne przed wariantowymi, potem numer z nazwy. Już wgrane zdjęcia (SHA-1 = hash w adresie Sanity) są pomijane, więc ZIP można wysłać ponownie. Sam ZIP (bez CSV) dogrywa zdjęcia do istniejących produktów.
- Testy przy wdrożeniu: logika dopasowań (`tsx`), pełny cykl na buildzie produkcyjnym z atrapą Sanity opartą o `groq-js` (import, reimport z usuniętym wariantem, duplikaty zdjęć, strona produktu, okno panelu).

## Widoczność, promowanie i strona główna

### Widoczność produktów = publikacja

- O tym, czy klient widzi produkt, decyduje WYŁĄCZNIE publikacja dokumentu w Sanity (szkic `drafts.<id>` = niewidoczny). Stare pole `visibility` nigdy nie było czytane przez sklep — w Studio jest schowane, import go nie ustawia.
- **Import CSV zakłada NOWE produkty jako szkice** (`drafts.<uuid>`); aktualizacja istniejącego SKU nie zmienia jego stanu publikacji. Kreator po imporcie linkuje do szkiców.
- **Katalog** (`ProductsView`): zaznaczanie (także „wszystkie widoczne” w nagłówku, zaznaczenie przeżywa zmianę filtrów), pasek akcji hurtowych — Opublikuj / Wycofaj / Promuj / Bez promowania / Bestseller / Bez bestsellera / Usuń — oraz baner „N produktów czeka w szkicach → Opublikuj wszystkie”. `adminBulkProducts` → `bulkProductAction` (`lib/admin/catalog.ts`): każdy produkt osobno (4 równolegle, maks. 500), publikacja wymaga ceny i sluga, wynik `{ done, failed[] }` — nieudane zostają zaznaczone. Publikacja/wycofanie/usunięcie zapisuje rejestr cen.
- Zmiany publikacji i flag odświeżają sklep od razu (`revalidatePath('/', 'layout')`).
- **Podgląd szkicu dla admina**: `/product/<slug>` szkicu zwraca 404 klientom, a zalogowanemu adminowi pokazuje produkt z banerem „Podgląd szkicu” (`lib/productPreview.ts`, perspektywa `drafts`, ta sama projekcja `PRODUCT_BY_ID_QUERY`). Katalog linkuje podgląd także dla szkiców.

### Promowanie (`isFeatured` / `isBestseller`)

- Kafelki (`ProductItem2`, `ProductItemWithoutBTN`, `WishlistProduct`) pokazują plakietki „Bestseller” i „Polecamy” obok obniżki (`components/ProductBadges.tsx`).
- Sortowanie „Popularne” na listingach: najpierw promowane, potem bestsellery, dalej sprzedaż z 90 dni (`promotionRank` w `lib/productSort.ts`).
- Karuzele strony głównej mogą filtrować „tylko promowane/bestsellery” albo sortować „Promowane i bestsellery”.

### Strona główna (`/admin/home`, Marketing → Strona główna)

- Jeden dokument Sanity `homeLayout` (`_id: "homeLayout"`, schowany w Studio) z listą sekcji w kolejności wyświetlania: karuzele produktów (`products`) + stałe moduły (`valueBar`, `subcategories`, `guides`, `about`) — każdą można przestawiać i ukrywać. Brak dokumentu = `defaultHomeLayout()` (Najczęściej wybierane / Nowości / Polecamy).
- **Karuzela = reguła**: źródło (cały sklep / kolekcja / kategoria / subkategoria / wybrane ręcznie) + kolejność (najczęściej zamawiane = sprzedaż 90 dni, promowane, nowości, oceny, obniżka, cena, ręczna) + filtry (dostępne, promowane, bestsellery, w promocji) + przypięte na początek + wykluczone + limit 4–24 + link „Zobacz wszystkie” (kolekcja/subkategoria). Typy i walidacja: `lib/homeLayout.ts` (czyste); wyliczanie: `lib/homeLayout.server.ts` (`resolveHomeSections`, GROQ + sygnały z `lib/productListing.ts`).
- **Produkty liczy SERWER** i podaje do `ProductCarusel2` jako props (bez zapytań z przeglądarki). Błąd sekcji = sekcja znika, strona działa. Pusta karuzela się nie pokazuje. Szkice nigdy nie trafiają na stronę główną.
- Panel: lista sekcji, edytor karuzeli, wybór produktów z wyszukiwarką, **podgląd na żywo** liczony tą samą funkcją co sklep (świeże dane, bez cache), ostrzeżenia (`sectionProblems`), zapis → `revalidatePath('/')`. `components/admin/marketing/HomeLayoutEditor.tsx`, `lib/admin/homeLayout.ts`, `actions/adminHome.ts`.

## Kategorie główne, menu i filtry listingów

- **Menu**: nazwa kategorii głównej (Zabawki, Przysmaki…) jest linkiem do `/category/[slug]`; w rozwijanym panelu pierwsza pozycja „Wszystko z kategorii →” (także na telefonie, gdzie dotknięcie nazwy rozwija listę). Animacja panelu trwa ~0,4 s (`variants` w `NavRMenu.tsx`, `globalDelay` 0,06 s) i na komputerze animuje WYŁĄCZNIE `clip-path` (tło zakładki, potem panel; ease-out) — nie wracaj do `max-height`/`height`: przelicza układ co klatkę, a przy sztywnym max-height i liniowym easingu panel „staje” w połowie (szarpanie). Na telefonie lista to akordeon w przepływie, więc rośnie `height: auto` (z `visibility`, nie `display`). Nasłuchy hover zakładek są zakładane raz (efekt), `NavLink` jest w `React.memo`, a `SubmenuPortal` słucha przewijania tylko przy otwartym panelu. Zmiana trasy zamyka menu na telefonie.
- **Strona kategorii** (`app/(products)/category/[slug]`): produkty z `category` ALBO z podkategorii, której rodzicem jest kategoria (`getProductsByCategory`), pigułki podkategorii, filtry = suma `availableFilters` podkategorii, sortowanie, opis SEO na dole. W mapie strony i okruszkach (subkategoria, produkt).
- **Filtry** (`src/lib/listingFilters.ts`, wspólne dla kategorii, subkategorii i wyszukiwarki): adres `cena_od` / `cena_do` (całe zł, oba opcjonalne — „od 100 zł” bez górnej granicy; stary `price` = górna granica), opcje `<filter.key>=<slug>`. Cena = `effectivePrice` (z promocją). Produkty bez wariantów sprawdzane po `filterValues` i cenie produktu (wcześniej znikały przy każdym filtrze). Granice pól (podpowiedzi) = `listingPriceBounds` z całej listy — nie ma już stałego maks. 300 zł. UI: pigułka „Cena” rozwija się w pola „od – do” (`PricePill` w `SubcategoryFilterContainer`), w szufladzie na telefonie te same pola. Otwarta pigułka ceny ma TĘ SAMĄ wysokość co pozostałe (wysokość daje niewidoczny napis, pola leżą warstwą `absolute`). Liczba widocznych pigułek (`calculateVisibleCount`) odejmuje ZMIERZONE szerokości ceny (po otwarciu od razu 300 px) i „Więcej..” oraz odstępy `space-x-3` — bez stałej „400 px”; blok filtrów ma `contain: inline-size`, więc rząd pigułek nie poszerza kolumny i nie wypycha sortowania z docka (overflow nadal zakazany — przycinałby rozwijane listy).
- **Brak wyników po filtrach** (`components/ListingFilterEmpty.tsx`, subkategoria/kategoria/wyszukiwarka): komunikat po lewej + „Wyczyść filtry” (adres bez filtrów, z zachowanym `sort`/`q` — `listingHrefWithoutFilters`) + „Sprawdź inne produkty z tej podkategorii/kategorii/dla frazy” = cała lista bez filtrów w wybranej kolejności. Siatka listingów: `LISTING_GRID_CLASS`.
- **Kolejność wartości filtrów**: `lib/filterValueOrder.ts` — rozmiary psa (mikro → mały → średni → duży) i XS…XXL rosnąco, reszta jak w danych (filtry i wybór rozmiaru na karcie produktu).
- Dekoracyjny obrazek `white-holo.png` przy docku filtrów został usunięty (nakładał się na filtry).

## Opisy: produkt i kategorie (SEO)

- **Produkt**: `shortDescription` = krótki opis przy cenie (zakładka „Opis”, otwarta od razu); `description` (Portable Text) = pełny opis w sekcji `#opis` pod galerią, przed opiniami. W panelu oba pola (pełny opis — `components/admin/kit/RichTextEditor.tsx`, ten sam format co Studio; zapis `sanitizeRichText` z `lib/richText.ts`, tylko bloki tekstu i zdjęcia).
- **Kategoria i subkategoria**: `description` (nagłówek na górze listingu), `seoContent` (długi tekst na DOLE strony, `components/ListingSeoContent.tsx`), `metaTitle`/`metaDescription`. Pola schematu: `sanity/schemaTypes/seoContent.ts`. Panel: Kategorie → „Opis i SEO” (`TaxonomySeoModal`, akcja `adminUpdateTaxonomySeo`).
- `RichTextEditor` renderuje się dopiero po zamontowaniu (PTE przy SSR nadaje losowe klucze → błąd hydracji).

## Zakup bez logowania

- `/checkout` działa dla gości (`isGuest` → baner „Kupujesz bez logowania”, bez zapamiętywania karty i zapisu adresu). Właścicielem zamówienia gościa jest ciasteczko `guest_id` (`getOrCreateGuestId` w kasie), `orders.guest_email` = e-mail z formularza.
- **Powrót z płatności i linki**: wszystko idzie na `/orders/[id]` — zalogowany → `/profile/orders/[id]`, gość → `/zamowienie/[id]` (dostęp: ta sama przeglądarka po `guest_id` ALBO podpisany link `?t=` — `lib/orderAccess.ts`, HMAC z `ORDER_LINK_SECRET`, zapasowo `CLERK_SECRET_KEY`; zmiana sekretu unieważnia linki). Strona gościa = ten sam `Content` co w profilu (`variant="guest"`) + link do zachowania i komunikat `?payment=`.
- **Mail z potwierdzeniem zamówienia** (`lib/orderEmails.ts`, `after()` w kasie — nie opóźnia płatności): pozycje, kwoty, dostawa, link do zamówienia (gość — z tokenem). Błąd SMTP tylko w logu.
- **Logowanie po zakupie**: `hydrateUserSession` przepina zamówienia z `guest_id` tej przeglądarki na konto (`claimGuestOrders`).

## Koszyk: darmowa dostawa, płatności, stany

- **Darmowa dostawa od kwoty**: dokument Sanity `shopSettings` (`freeShippingEnabled`, `freeShippingThreshold`), edycja w panelu: Dostawy → „Darmowa dostawa od kwoty”. Liczona od wartości produktów PRZED kodem rabatowym (`lib/shopSettings.ts`). Kasa czyta świeżo (`getShopSettings({ fresh: true })`) i zeruje dostawę; koszyk/mini koszyk/kasa w przeglądarce — `GET /api/shop-settings` (`useShopSettings`). Pasek „Brakuje X zł do darmowej dostawy” (`components/cart/FreeShippingProgress.tsx`) w koszyku i w okienku po dodaniu produktu. „Dostawa od” w koszyku = najtańsza aktywna metoda.
- **„Akceptujemy”** (`components/cart/AcceptedPayments.tsx`): lista z `/api/autopay/gateways` (BLIK, szybki przelew z liczbą banków, karta, Google/Apple Pay, jeśli włączone) + „Za pobraniem”. Znaki metod: `components/payment/PaymentLogos.tsx` (wspólne z kasą).
- **Stany** (`lib/stock.ts`): stan wariantu → stan produktu; brak liczby = nieprowadzony (dostępny). „Dodaj do koszyka” i +/− w koszyku nie przekraczają stanu, wyprzedany wariant = „Chwilowo niedostępny”, kafelek pokazuje etykietę, listingi spychają wyprzedane na koniec (`sortProducts`). Kasa sprawdza stan i ilości (1–99) na danych z Sanity. **Sklep nie zdejmuje stanu po sprzedaży** — stan ustawia się w panelu.
- **Niski stan w panelu** = 1 sztuka albo brak (`LOW_STOCK_THRESHOLD = 2` w `lib/stock.ts`, licznik w sidebarze, filtr katalogu, dashboard).

## Newsletter (double opt-in)

1. Formularz → `subscribeToNewsletter`: zapis NIEAKTYWNY + mail „Potwierdź zapis” (szablon `newsletter_confirm`, wymagany `{{confirmUrl}}`). Ponowny mail najwcześniej po 2 min, limit 10 zapisów/h na IP (Redis).
2. `/newsletter/potwierdz?token=` → przycisk „Potwierdzam zapis” (akcja, nie samo wejście w link — skanery poczty) → `confirmed_at`, aktywny, mail powitalny z kodem (`newsletter_welcome`, `{{unsubscribeUrl}}`). Link ważny 7 dni, jednorazowy.
3. `/newsletter/wypisz?token=` (`unsub_token`) — wypisanie bez logowania.
- Migracja **`drizzle/0003_newsletter_double_optin.sql`** (ręcznie na bazie, przed wdrożeniem kodu): kolumny `confirm_token`, `confirm_sent_at`, `confirmed_at`; dotychczasowi aktywni = potwierdzeni.
- Panel Marketing: oba szablony, statystyki (aktywni / czekają / wypisani), eksport CSV aktywnych (do Brevo/MailerLite — panel nie wysyła kampanii). Ręcznie da się przywrócić tylko adres, który kiedyś potwierdził zapis.

## Wyszukiwarka

- Dopasowanie (`lib/search.ts`, czyste): nazwa, marka, kategoria, podkategoria, tagi, SKU, podtytuł, krótki i pełny opis; KAŻDE słowo frazy musi pasować; bez polskich znaków; prosta odmiana (rdzeń bez 1–2 ostatnich liter dla słów 5+). Ranking: nazwa > marka/kategorie/tagi/SKU > opisy, premia za frazę na początku nazwy.
- Indeks (`lib/searchIndex.server.ts`): wszystkie produkty z tekstami, pamięć procesu 5 min + cache Next. Podpowiedzi: `GET /api/search?q=` (8 trafień, `searchProductsByName` w `clientRequest.ts`). Strona `/search`: `getProductsBySearch` (pełna projekcja dla trafień), domyślne sortowanie „Trafność” (`relevance` — tylko w wyszukiwarce, `SortSelect options`).

## Rozmiary psa

Rozmiary to wartości filtra w Sanity. `scripts/migrate-dog-sizes.mjs` (sucha próba; `--apply` zapisuje) zmienia etykietę filtra na „Rozmiar psa”, przemianowuje S/M/L (XS) na Mały/Średni/Duży (Mikro) z zachowaniem `_id` (warianty i zdjęcia działają dalej), dodaje brakujące wartości i poprawia etykiety wariantów. Import CSV rozumie stare oznaczenia (`SIZE_ALIASES` w `productImport.ts`). Przy wyborze rozmiaru na karcie produktu jest link „Jak dobrać rozmiar?” → `/help/jak-dobrac-rozmiar` (dokument w `HELP_DOCUMENTS`; treść do dodania w Studio).

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
- Środowisko Furgonetki (mapa paczkomatów `components/FurgonetkaMap.tsx` i API `lib/furgonetka.ts`) wybiera jedna zmienna `NEXT_PUBLIC_FURGONETKA_ENV` = `sandbox` | `production` (`lib/furgonetkaEnv.ts`; bez niej: build produkcyjny → produkcja, dev → piaskownica). Wkompilowywana przy budowaniu — w workflow stagingu z `vars.FURGONETKA_ENV`, domyślnie `sandbox`. **Klucz mapy, dane OAuth i token muszą pochodzić z konta w TYM SAMYM środowisku** — klucz z piaskownicy na `api.furgonetka.pl` daje 403 na `/points/map`. Na produkcji sklepu ustaw `production` i produkcyjne klucze, inaczej klienci zobaczą testowe paczkomaty.
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
  Dopisanie ich do `.env` na serwerze nic nie zmieni. **Pusty sekret też jest
  wartością**: przykrywa `.env` z repo i trafia do paczki jako `""` (tak zniknął
  klucz mapy paczkomatów → 403 z `api.furgonetka.pl`). Krok Build przerywa się,
  gdy brakuje któregoś z kluczowych `NEXT_PUBLIC_*`. Reszta konfiguracji
  (baza, Redis, klucze płatności, SMTP) to zmienne runtime — te idą do `.env`
  obok `server.js`; Next w trybie standalone czyta ten plik przy starcie.
- **Nagłówki z `next.config.ts` (w tym CSP) powstają przy budowaniu** i trafiają
  do manifestu. `CSP_MODE` ustawia się w środowisku builda, nie na serwerze.

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
