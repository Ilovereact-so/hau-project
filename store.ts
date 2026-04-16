import { create } from 'zustand'
import { persist, createJSONStorage, devtools } from 'zustand/middleware'
import { GetSlugProduct } from 'sanity.types'
import { syncCart, syncWishlist } from '@/actions/sync'

export type CartItem = {
  product:  GetSlugProduct
  variant:  string
  quantity: number
}

type Store = {
  // ── cart ──────────────────────────────────────────
  cartItems:        CartItem[]
  onItemAdded:      ((item: CartItem) => void) | null
  setOnItemAdded:   (cb: ((item: CartItem) => void) | null) => void
  addItem:          (product: GetSlugProduct, variant: string) => void
  removeItem:       (productId: string, variant: string) => void
  deleteItem:       (productId: string, variant: string) => void
  resetCart:        () => void
  getItemCount:     (productId: string, variant: string) => number
  getGroupedItems:  () => CartItem[]
  getLatestItem:    () => CartItem | null
  getTotalItems:    () => number
  getTotalPrice:    () => number
  getSubTotalPrice: () => number

  // ── wishlist ───────────────────────────────────────
  wishlistIds: string[]
  wishlistProducts: GetSlugProduct[]
  wishlistReady:    boolean
  hydrateWishlist:  (ids: string[], products: GetSlugProduct[]) => void
  toggleWishlist:   (productId: string, product?: GetSlugProduct) => void
  isWishlisted:     (productId: string) => boolean
  clearWishlistState: () => void
}

// ── timery poza store — moduł-level ───────────────────
let cartTimer:       ReturnType<typeof setTimeout> | null = null
let wishlistTimer:   ReturnType<typeof setTimeout> | null = null
let pendingWishlist: string[] | null = null
let pendingCart:     Array<{ productId: string; variantId: string; qty: number }> | null = null

function scheduleCartSync(items: CartItem[]) {
  const payload = items.map(i => ({
    productId: i.product._id,
    variantId: i.variant,
    qty:       i.quantity,
  }))
  pendingCart = payload
  if (cartTimer) clearTimeout(cartTimer)
  cartTimer = setTimeout(async () => {
    await syncCart(payload).catch(console.error)
    pendingCart = null
    cartTimer   = null
  }, 500)
}

function scheduleWishlistSync(ids: string[]) {
  pendingWishlist = ids
  if (wishlistTimer) clearTimeout(wishlistTimer)
  wishlistTimer = setTimeout(async () => {
    await syncWishlist(ids).catch(console.error)
    pendingWishlist = null
    wishlistTimer   = null
  }, 500)
}

export async function flushPendingSync() {
  if (cartTimer)     { clearTimeout(cartTimer);     cartTimer     = null }
  if (wishlistTimer) { clearTimeout(wishlistTimer); wishlistTimer = null }

  const promises: Promise<any>[] = []
  if (pendingWishlist !== null) {
    promises.push(syncWishlist(pendingWishlist).catch(console.error))
    pendingWishlist = null
  }
  if (pendingCart !== null) {
    promises.push(syncCart(pendingCart).catch(console.error))
    pendingCart = null
  }
  await Promise.all(promises)
}

function resolvePrice(product: GetSlugProduct, variantKey: string): number {
  return product.variants?.find(v => v._key === variantKey)?.price
    ?? product.price
    ?? 0
}

const useStore = create<Store>()(
  devtools( 
  persist(
    (set, get) => ({

      // ── CART ────────────────────────────────────────

      cartItems:   [],
      onItemAdded: null,
      setOnItemAdded: cb => set({ onItemAdded: cb }),

      addItem: (product, variant) =>
        set(state => {
          const existing = state.cartItems.find(
            i => i.product._id === product._id && i.variant === variant
          )
          const next: CartItem[] = existing
            ? state.cartItems.map(i =>
                i.product._id === product._id && i.variant === variant
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              )
            : [...state.cartItems, { product, variant, quantity: 1 }]

          get().onItemAdded?.(
            next.find(i => i.product._id === product._id && i.variant === variant)!
          )
          scheduleCartSync(next)
          return { cartItems: next }
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
          scheduleCartSync(next)
          return { cartItems: next }
        }),

      deleteItem: (productId, variant) =>
        set(state => {
          const next = state.cartItems.filter(
            i => !(i.product._id === productId && i.variant === variant)
          )
          scheduleCartSync(next)
          return { cartItems: next }
        }),

      resetCart: () => {
        scheduleCartSync([])
        set({ cartItems: [] })
      },

      getItemCount: (productId, variant) =>
        get().cartItems.find(
          i => i.product._id === productId && i.variant === variant
        )?.quantity ?? 0,

      getGroupedItems:  () => get().cartItems,
      getLatestItem:    () => get().cartItems.at(-1) ?? null,
      getTotalItems:    () =>
        get().cartItems.reduce((t, i) => t + i.quantity, 0),
      getTotalPrice: () =>
        get().cartItems.reduce(
          (t, i) => t + resolvePrice(i.product, i.variant) * i.quantity, 0
        ),
      getSubTotalPrice: () =>
        get().cartItems.reduce(
          (t, i) => t + resolvePrice(i.product, i.variant) * i.quantity, 0
        ),

      // ── WISHLIST ─────────────────────────────────────

      wishlistIds:      [],
      wishlistProducts: [],
      wishlistReady:    false,

      hydrateWishlist: (ids, products) => set({
        wishlistIds:      ids,
        wishlistProducts: products,
        wishlistReady:    true,
      }),

      toggleWishlist: (productId, product) =>
        set(state => {
         const has = state.wishlistIds.includes(productId)
    
        const nextIds = has
          ? state.wishlistIds.filter(id => id !== productId)
          : [...state.wishlistIds, productId]

        const nextProducts = has
          ? state.wishlistProducts.filter(p => p._id !== productId)
          : product && !state.wishlistProducts.find(p => p._id === productId)
            ? [...state.wishlistProducts, product]
            : state.wishlistProducts

          scheduleWishlistSync([...nextIds])
          return { wishlistIds: nextIds, wishlistProducts: nextProducts }
        }),

      isWishlisted: productId => get().wishlistIds.includes(productId),

      clearWishlistState: () => set({
        wishlistIds:      [],
        wishlistProducts: [],
        wishlistReady:    false,
      }),
    }),
    {
      name:    'hau-store',
      storage: createJSONStorage(() => localStorage),
      // persist TYLKO cart — wishlist nigdy nie trafia do localStorage
      partialize: state => ({
        cartItems: state.cartItems,
      }),
      // przy odczycie z localStorage — wishlist zawsze pusta, cart z localStorage
      merge: (persisted: any, current) => ({
        ...current,
        cartItems: persisted.cartItems ?? [],
      }),
    }
  ),{ name: 'Store' })
)

export default useStore