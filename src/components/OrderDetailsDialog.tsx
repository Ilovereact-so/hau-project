// DEPRECATED — martwy, nieużywany komponent.
//
// Pochodzi z czasów, gdy zamówienia były osobnym typem dokumentu w Sanity
// (`_type == "order"`, stary `getMyOrders` w src/sanity/helpers/index.ts).
// Zamówienia zostały przeniesione do Postgres przez Drizzle
// (src/db/schema.ts) — zobacz src/actions/orders.ts oraz strony
// src/app/(client)/orders/page.tsx i
// src/app/(client)/profile/orders/Content.tsx, które renderują zamówienia
// bezpośrednio z nowego kształtu danych (bez tego komponentu).
//
// Ten plik nie jest nigdzie importowany w całym `src` (sprawdzone przed tą
// zmianą). Typ `MY_ORDERS_QUERYResult` z sanity.types.ts od migracji
// rozwiązuje się do `Array<never>`, bo schemat "order" już nie istnieje w
// Sanity — to psuło `tsc --noEmit` mimo że komponent i tak nigdy się nie
// renderuje. Zawartość została wyczyszczona, żeby build nie czerwienił się
// na martwym kodzie referencjonującym nieistniejący typ.
//
// Bezpiecznie usuń ten plik (i OrdersComponent.tsx — ten sam przypadek).
export {};
