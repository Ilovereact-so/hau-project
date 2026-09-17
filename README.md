# hau-project

Sklep e-commerce (Next.js 15, App Router) — katalog produktów w Sanity CMS, dane transakcyjne (koszyk, zamówienia, wishlist) w MySQL przez Drizzle ORM, cache w Redis, logowanie przez Clerk. Płatności: Przelewy24, Autopay, płatność za pobraniem. Wysyłka: Furgonetka (InPost), DPD.

Szczegółowy opis architektury, konwencji i zmiennych środowiskowych — patrz [`CLAUDE.md`](./CLAUDE.md).

## Szybki start

1. Skopiuj `.env.example` do `.env` i uzupełnij dane (Sanity, MySQL, Redis, Clerk, Furgonetka, Autopay, Przelewy24 — pełna lista w `CLAUDE.md`).
2. Zainstaluj zależności:

   ```bash
   npm install
   ```

3. Uruchom serwer deweloperski:

   ```bash
   npm run dev
   ```

   Aplikacja wystartuje pod [http://localhost:3000](http://localhost:3000).

## Przydatne komendy

```bash
npm run dev       # serwer deweloperski (Next.js + Turbopack)
npm run build     # build produkcyjny
npm run lint      # ESLint
npm run typegen   # regeneracja typów TS ze schemy Sanity (sanity.types.ts)
```

Sanity Studio (panel CMS) jest zamontowane pod `/studio`.
