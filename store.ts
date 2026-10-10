import { create } from 'zustand'
import { persist, createJSONStorage, devtools } from 'zustand/middleware'
import { GetSlugProduct } from 'sanity.types'
import { syncCart, syncWishlist } from '@/actions/sync'
import type { CartLine } from '@/lib/cartMerge'
import { maxOrderQty } from '@/lib/stock'
import { effectivePrice } from '@/lib/omnibus'

export type CartItem = {
  product:  GetSlugProduct
  variant:  string
  quantity: number
}

// Skąd przyszło dodanie do koszyka — CartIcon na tej podstawie decyduje,
// czy pokazać popup przy ikonie koszyka (top) czy fixed w rogu okna (bottom)
export type AddToCartType = 'top' | 'bottom'

/**
 * Stan sesji widziany przez store. Ustawia go wyłącznie StoreHydration.
 *  - unknown — Clerk jeszcze się nie załadował albo trwa scalanie po zalogowaniu,
 *  - guest   — niezalogowany: koszyk w localStorage (+ kopia serwerowa pod
 *              ciasteczkiem guest_id), wishlista tylko w localStorage,
 *  - user    — zalogowany: źródłem prawdy jest serwer (Redis + MySQL).
 */
export type StoreSession =
  | { status: 'unknown'; userId: null }
  | { status: 'guest';   userId: null }
  | { status: 'user';    userId: string }

/** 'guest' albo userId — do kogo należy koszyk trzymany w localStorage. */
export type CartOwner = 'guest' | (string & {})

type Store = {
  session:    StoreSession
  setSession: (session: StoreSession) => void

  // ── cart ──────────────────────────────────────────
  cartItems:        CartItem[]
  cartOwner:        CartOwner | null
  /** false dopóki koszyk nie jest zsynchronizowany z właścicielem sesji */
  cartReady:        boolean
  onItemAdded:      ((item: CartItem, type: AddToCartType) => void) | null
  setOnItemAdded:   (cb: ((item: CartItem, type: AddToCartType) => void) | null) => void
  addItem:          (product: GetSlugProduct, variant: string, status?: boolean, type?: AddToCartType) => void
  removeItem:       (productId: string, variant: string) => void
  deleteItem:       (productId: string, variant: string) => void
  resetCart:        () => void
  /** Podmiana całego koszyka bez synchronizacji (wynik hydracji z serwera). */
  replaceCart:      (items: CartItem[], owner: CartOwner) => void
  refreshCartProducts: (products: GetSlugProduct[]) => void
  getItemCount:     (productId: string, variant: string) => number
  getGroupedItems:  () => CartItem[]
  getLatestItem:    () => CartItem | null
  getTotalItems:    () => number
  getTotalPrice:    () => number
  getSubTotalPrice: () => number

  // ── wishlist ───────────────────────────────────────
  wishlistIds:      string[]
  wishlistProducts: GetSlugProduct[]
  wishlistReady:    boolean
  /** Wishlista gościa — jedyna część wishlisty trzymana w localStorage. */
  guestWishlistIds: string[]
  hydrateWishlist:  (ids: string[], products: GetSlugProduct[]) => void
  toggleWishlist:   (productId: string, product?: GetSlugProduct) => void
  setWishlisted:    (productId: string, wishlisted: boolean, product?: GetSlugProduct) => void
  isWishlisted:     (productId: string) => boolean
  clearWishlistState: () => void
}

// ── synchronizacja z serwerem (moduł-level, poza stanem) ──────────────────────
//
// Każdy zapis jest "przypięty" do właściciela z chwili zaplanowania. Serwer
// odrzuca zapis, jeśli sesja się w międzyczasie zmieniła.
//
// Dopóki sesja nie jest rozstrzygnięta (start aplikacji, scalanie po
// zalogowaniu) synchronizacja jest ZAWIESZONA: zmiany robione w tym czasie
// są tylko lokalne i zapamiętywane, a StoreHydration domyka je po hydracji.
// Bez tego częściowy koszyk z przeglądarki mógłby nadpisać koszyk konta,
// zanim serwer zdążył go scalić.

type PendingCart     = { owner: CartOwner; items: CartLine[] }
type PendingWishlist = { owner: string;    ids: string[] }
export type WishlistOp = { productId: string; wishlisted: boolean; product?: GetSlugProduct }

const SYNC_DEBOUNCE_MS = 500

let cartTimer:       ReturnType<typeof setTimeout> | null = null
let wishlistTimer:   ReturnType<typeof setTimeout> | null = null
let pendingCart:     PendingCart | null = null
let pendingWishlist: PendingWishlist | null = null

let syncSuspended            = true
let cartDirtyWhileSuspended  = false
let wishlistOpsWhileSuspended: WishlistOp[] = []

export const toCartLines = (items: CartItem[]): CartLine[] =>
  items.map(i => ({ productId: i.product._id, variantId: i.variant, qty: i.quantity }))

function currentOwner(session: StoreSession): CartOwner | null {
  if (session.status === 'user')  return session.userId
  if (session.status === 'guest') return 'guest'
  return null
}

function scheduleCartSync(items: CartItem[], session: StoreSession) {
  const owner = currentOwner(session)
  if (syncSuspended || !owner) {
    cartDirtyWhileSuspended = true
    return
  }
  pendingCart = { owner, items: toCartLines(items) }
  if (cartTimer) clearTimeout(cartTimer)
  cartTimer = setTimeout(() => {
    cartTimer = null
    const job = pendingCart
    pendingCart = null
    if (job) syncCart(job.items, job.owner).catch(console.error)
  }, SYNC_DEBOUNCE_MS)
}

function scheduleWishlistSync(ids: string[], session: StoreSession) {
  // Wishlista gościa nie ma kopii serwerowej — zapisuje ją persist.
  if (session.status !== 'user') return
  pendingWishlist = { owner: session.userId, ids: [...ids] }
  if (wishlistTimer) clearTimeout(wishlistTimer)
  wishlistTimer = setTimeout(() => {
    wishlistTimer = null
    const job = pendingWishlist
    pendingWishlist = null
    if (job) syncWishlist(job.ids, job.owner).catch(console.error)
  }, SYNC_DEBOUNCE_MS)
}

function takePending() {
  if (cartTimer)     { clearTimeout(cartTimer);     cartTimer     = null }
  if (wishlistTimer) { clearTimeout(wishlistTimer); wishlistTimer = null }
  const jobs = { cart: pendingCart, wishlist: pendingWishlist }
  pendingCart = null
  pendingWishlist = null
  return jobs
}

/** Natychmiastowy zapis zaległych zmian (np. przed wylogowaniem). */
export async function flushPendingSync() {
  const { cart, wishlist } = takePending()
  await Promise.all([
    cart     ? syncCart(cart.items, cart.owner).catch(console.error)             : null,
    wishlist ? syncWishlist(wishlist.ids, wishlist.owner).catch(console.error)   : null,
  ])
}

/**
 * Wersja dla zamykanej/ukrywanej karty: `fetch` z `keepalive` przeżywa
 * zamknięcie strony, wywołanie akcji serwerowej — nie.
 */
export function flushPendingSyncOnPageHide() {
  const { cart, wishlist } = takePending()
  const send = (url: string, body: unknown) =>
    fetch(url, {
      method:      'PUT',
      keepalive:   true,
      credentials: 'same-origin',
      headers:     { 'Content-Type': 'application/json' },
      body:        JSON.stringify(body),
    }).catch(() => {})

  if (cart)     send('/api/cart',     { owner: cart.owner, items: cart.items })
  if (wishlist) send('/api/wishlist', { owner: wishlist.owner, ids: wishlist.ids })
}

/** Porzuca zaległe zapisy (np. po wykryciu wylogowania — sesji już nie ma). */
export function dropPendingSync() {
  takePending()
}

export function suspendSync() {
  syncSuspended = true
}

/**
 * Wznawia synchronizację i zwraca zmiany zrobione w czasie zawieszenia —
 * wywołujący (StoreHydration) decyduje, jak je nałożyć na stan z serwera.
 */
export function resumeSync(): { cartDirty: boolean; wishlistOps: WishlistOp[] } {
  syncSuspended = false
  const result = { cartDirty: cartDirtyWhileSuspended, wishlistOps: wishlistOpsWhileSuspended }
  cartDirtyWhileSuspended   = false
  wishlistOpsWhileSuspended = []
  return result
}

/** Wymusza zapis bieżącego koszyka (po wznowieniu, jeśli był "brudny"). */
export function syncCurrentCart() {
  const { cartItems, session } = useStore.getState()
  scheduleCartSync(cartItems, session)
}

/** Wymusza zapis bieżącej wishlisty konta. */
export function syncCurrentWishlist() {
  const { wishlistIds, session } = useStore.getState()
  scheduleWishlistSync(wishlistIds, session)
}

function resolvePrice(product: GetSlugProduct, variantKey: string): number {
  // Ta sama reguła co checkout i rejestr cen (lib/omnibus.ts).
  return effectivePrice(product, variantKey) ?? 0
}

const MAX_LINE_QTY = 99

type PersistedState = {
  cartItems?:        CartItem[]
  cartOwner?:        CartOwner | null
  guestWishlistIds?: string[]
}

const useStore = create<Store>()(
  devtools(
  persist(
    (set, get) => ({

      session:    { status: 'unknown', userId: null },
      setSession: session => set({ session }),

      // ── CART ────────────────────────────────────────

      cartItems:   [],
      cartOwner:   null,
      cartReady:   false,
      onItemAdded: null,
      setOnItemAdded: cb => set({ onItemAdded: cb }),

      addItem: (product, variant, status = true, type: AddToCartType = 'top') =>
        set(state => {
          const existing = state.cartItems.find(
            i => i.product._id === product._id && i.variant === variant
          )
          // Nie więcej niż jest w magazynie (stan nieprowadzony = limit 99).
          // Kasa i tak sprawdza stan jeszcze raz na świeżych danych.
          const limit = Math.min(MAX_LINE_QTY, maxOrderQty(product, variant))
          if (limit <= 0 || (existing && existing.quantity >= limit)) return {}
          const next: CartItem[] = existing
            ? state.cartItems.map(i =>
                i.product._id === product._id && i.variant === variant
                  ? { ...i, product, quantity: Math.min(limit, i.quantity + 1) }
                  : i
              )
            : [...state.cartItems, { product, variant, quantity: 1 }]
          if (status) {
            get().onItemAdded?.(
              next.find(i => i.product._id === product._id && i.variant === variant)!,
              type
            )
          }
          scheduleCartSync(next, state.session)
          // Właściciela ustala StoreHydration; w trakcie zawieszenia (np. nieudane
          // scalanie po zalogowaniu) nie może się zmienić, bo kolejne wejście
          // musi ponowić scalanie koszyka gościa.
          const cartOwner = syncSuspended ? state.cartOwner : (currentOwner(state.session) ?? state.cartOwner)
          return { cartItems: next, cartOwner }
        }),

      removeItem: (productId, variant) =>
        set(state => {
          const next = state.cartItems.reduce((acc, item) => {
            if (item.product._id === productId && item.variant === variant) {
              if (item.quantity > 1) acc.push({ ...item, quantity: item.quantity - 1 })
            } else {
              acc.push(item)
            }
            return acc
          }, [] as CartItem[])
          scheduleCartSync(next, state.session)
          return { cartItems: next }
        }),

      deleteItem: (productId, variant) =>
        set(state => {
          const next = state.cartItems.filter(
            i => !(i.product._id === productId && i.variant === variant)
          )
          scheduleCartSync(next, state.session)
          return { cartItems: next }
        }),

      resetCart: () =>
        set(state => {
          scheduleCartSync([], state.session)
          return { cartItems: [] }
        }),

      replaceCart: (items, owner) => set({ cartItems: items, cartOwner: owner }),

      // Podmienia dane produktu (cena, dostępność, obrazy...) w istniejących
      // pozycjach koszyka świeżymi danymi z Sanity — koszyk trzymany w
      // localStorage może się zdezaktualizować, jeśli produkt zmienił się po
      // dodaniu. Nie zmienia ilości/wariantów i nie triggeruje sync do serwera
      // (to tylko odświeżenie widoku, nie akcja użytkownika).
      refreshCartProducts: products => {
        if (!products.length) return
        const byId = new Map(products.map(p => [p._id, p]))
        set(state => ({
          cartItems: state.cartItems.map(item => {
            const fresh = byId.get(item.product._id)
            return fresh ? { ...item, product: fresh } : item
          }),
        }))
      },

      getItemCount: (productId, variant) =>
        get().cartItems.find(
          i => i.product._id === productId && i.variant === variant
        )?.quantity ?? 0,

      getGroupedItems:  () => get().cartItems,
      getLatestItem:    () => get().cartItems.at(-1) ?? null,
      getTotalItems:    () =>
        get().cartItems.reduce((t, i) => t + i.quantity, 0),
      // getTotalPrice i getSubTotalPrice były dwiema kopiami tej samej sumy —
      // dostawa i rabaty liczą się dopiero w checkout (kwota na stronie
      // koszyka to celowo sama wartość produktów), więc oba są dziś tożsame.
      // Zostawione jako dwie nazwy pod kątem UI ("wartość produktów" vs
      // "do zapłaty"), ale liczone raz, żeby nie utrzymywać dwóch kopii tej
      // samej logiki.
      getSubTotalPrice: () =>
        get().cartItems.reduce(
          (t, i) => t + resolvePrice(i.product, i.variant) * i.quantity, 0
        ),
      getTotalPrice: () => get().getSubTotalPrice(),

      // ── WISHLIST ─────────────────────────────────────

      wishlistIds:      [],
      wishlistProducts: [],
      wishlistReady:    false,
      guestWishlistIds: [],

      hydrateWishlist: (ids, products) => set(state => ({
        wishlistIds:      ids,
        wishlistProducts: products,
        wishlistReady:    true,
        ...(state.session.status === 'guest' ? { guestWishlistIds: ids } : {}),
      })),

      setWishlisted: (productId, wishlisted, product) =>
        set(state => {
          const has = state.wishlistIds.includes(productId)
          if (has === wishlisted) {
            // Stan się zgadza, ale mogło brakować danych produktu do widoku.
            if (wishlisted && product && !state.wishlistProducts.some(p => p._id === productId)) {
              return { wishlistProducts: [...state.wishlistProducts, product] }
            }
            return {}
          }

          const nextIds = wishlisted
            ? [...state.wishlistIds, productId]
            : state.wishlistIds.filter(id => id !== productId)

          const nextProducts = !wishlisted
            ? state.wishlistProducts.filter(p => p._id !== productId)
            : product && !state.wishlistProducts.some(p => p._id === productId)
              ? [...state.wishlistProducts, product]
              : state.wishlistProducts

          if (syncSuspended || state.session.status === 'unknown') {
            wishlistOpsWhileSuspended.push({ productId, wishlisted, product })
          } else {
            scheduleWishlistSync(nextIds, state.session)
          }

          return {
            wishlistIds:      nextIds,
            wishlistProducts: nextProducts,
            ...(state.session.status === 'guest' ? { guestWishlistIds: nextIds } : {}),
          }
        }),

      toggleWishlist: (productId, product) => {
        const { isWishlisted, setWishlisted } = get()
        setWishlisted(productId, !isWishlisted(productId), product)
      },

      isWishlisted: productId => get().wishlistIds.includes(productId),

      clearWishlistState: () => set({
        wishlistIds:      [],
        wishlistProducts: [],
        wishlistReady:    false,
      }),
    }),
    {
      name:    'hau-store',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Persistujemy koszyk (z właścicielem) i wishlistę GOŚCIA.
      // Wishlista konta nigdy nie trafia do localStorage.
      partialize: state => ({
        cartItems:        state.cartItems,
        cartOwner:        state.cartOwner,
        guestWishlistIds: state.guestWishlistIds,
      }),
      // v0 miał tylko cartItems — właściciel nieznany (null). StoreHydration
      // traktuje taki koszyk jak koszyk gościa: po zalogowaniu scala go z
      // kontem (scalanie max() nie zdubluje ilości, jeśli to był już koszyk konta).
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as PersistedState
        if (version < 1) return { cartItems: p.cartItems ?? [], cartOwner: null, guestWishlistIds: [] }
        return p
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as PersistedState
        const owner = currentOwner(current.session)
        // Odczyt z innej karty (event `storage`) nie może podmienić koszyka
        // innego właściciela niż sesja tej karty — tym zajmie się StoreHydration.
        if (owner && p.cartOwner && p.cartOwner !== owner) return current
        return {
          ...current,
          cartItems:        Array.isArray(p.cartItems) ? p.cartItems : [],
          cartOwner:        p.cartOwner ?? null,
          guestWishlistIds: Array.isArray(p.guestWishlistIds) ? p.guestWishlistIds : [],
        }
      },
    }
  ), { name: 'Store', enabled: process.env.NODE_ENV === 'development' })
)

export default useStore
