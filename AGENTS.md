# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (Next.js + Turbopack)
npm run build     # Production build
npm run lint      # ESLint
npm run typegen   # Regenerate TypeScript types from Sanity schema
```

## Architecture

This is a Next.js 15 e-commerce app using the App Router. The three main data systems are:

- **Sanity CMS** — product catalog (products, categories, subcategories, banners). Queried via GROQ from `src/sanity/helpers/`. The Sanity Studio is mounted at `/studio` via `src/app/studio/`.
- **MySQL via Drizzle ORM** — transactional data: cart items, wishlist, orders. Schema in `src/db/`. Config in `drizzle.config.ts`.
- **Redis** — caching layer for cart and wishlist with TTL-based expiry. Client in `src/lib/`.

Authentication is handled by **Clerk**. A webhook at `src/app/api/webhooks/clerk/` assigns `role: "user"` on signup and syncs users to MySQL. The middleware (`src/middleware.ts`) enforces admin-only access to `/admin/*` routes and manages a guest ID cookie for unauthenticated users.

## State Management

The Zustand store (`store.ts` at project root) manages cart and wishlist state client-side with localStorage persistence for the cart. Key behaviors:

- Cart syncs to Redis + MySQL with a 500ms debounce after any change.
- Wishlist is fetched from Redis on mount and never persisted to localStorage.
- On login/logout, `StoreHydration` (a component) triggers `flushPendingSync()` and handles cart merging (authenticated user's items take precedence over guest items).
- Wishlist uses optimistic updates with automatic rollback on error.

Server actions for these operations live in `src/actions/`.

## Route Groups

App routes are organized into groups under `src/app/`:

| Group | Purpose |
|---|---|
| `(auth)` | Sign-in, sign-up, password reset, SSO callback |
| `(admin)` | CSV product import, admin panel |
| `(products)` | Product detail pages `[slug]`, subcategory listings |
| `(client)` | Cart, wishlist, orders, order success |
| `(errors)` | 403, 404 pages |
| `(using)` | Home page with banner |

## Key Conventions

- **Prices**: Product prices live in Sanity. Order prices are snapshotted into the `order_items` MySQL table at purchase time — never recalculate from Sanity for historical orders.
- **Images**: All product images are served from `cdn.sanity.io` via the `urlFor()` helper from `src/lib/`.
- **Styling**: Tailwind CSS 4 is the default. `styled-components` is used for more complex component styling.
- **TypeScript path alias**: `@/` maps to `src/`.
- **Admin CSV import**: Products can be bulk-imported via CSV through `/admin`; the import pipeline is in `src/app/api/sanity/` and `src/sanity/helpers/`.

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
# Wysyłka — Furgonetka (InPost)
FURGONETKA_CLIENT_ID, FURGONETKA_CLIENT_SECRET
FURGONETKA_REDIRECT_URI, FURGONETKA_REFRESH_TOKEN, FURGONETKA_WEBHOOK_SECRET
NEXT_PUBLIC_FURGONETKA_MAP_API_KEY
# Newsletter — SMTP (wysyłka maili, np. Gmail/Brevo/Mailgun)
SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
```

Uwaga: w `checkout.ts` brak `AUTOPAY_SERVICE_ID`/`AUTOPAY_HASH_KEY` poza produkcją włącza dev-bypass płatności Autopay (symuluje natychmiastowy sukces bez realnej transakcji) — w produkcji (`NODE_ENV=production`) jest to zablokowane i rzuca błąd zamiast fałszywie oznaczać zamówienie jako opłacone.

## Imported Claude Cowork project instructions
