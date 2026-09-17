import type { GetSlugProduct } from 'sanity.types'
import useStore, {
  dropPendingSync, resumeSync, suspendSync,
  syncCurrentCart, toCartLines, type CartItem, type WishlistOp,
} from 'store'
import { hydrateUserSession } from '@/actions/sync'
import { mergeCartLines } from '@/lib/cartMerge'

// ─────────────────────────────────────────────────────────────────────────────
// Jedyne miejsce, które ustala, do kogo należy stan koszyka i wishlisty.
//
//  gość            → koszyk z localStorage (właściciel 'guest'), wishlista z
//                    localStorage (guestWishlistIds) + dane produktów z Sanity
//  logowanie       → hydrateUserSession: serwer scala koszyk/wishlistę gościa
//                    z kontem i zwraca gotowy stan (koszyk konta = źródło prawdy)
//  odświeżenie     → to samo, ale bez danych gościa (serwer = źródło prawdy)
//  wylogowanie     → czyścimy wszystko, dane konta nie mogą zostać w przeglądarce
//  zmiana konta    → dane poprzedniego konta są porzucane, nigdy scalane
//
// Na czas ustalania stanu synchronizacja w store jest zawieszona (patrz store.ts).
// ─────────────────────────────────────────────────────────────────────────────

const get = () => useStore.getState()

const HYDRATE_RETRY_DELAYS_MS = [0, 1000, 3000]
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export type Guard = () => boolean // true = ta hydracja jest już nieaktualna

async function fetchGuestWishlist(ids: string[]): Promise<{ ids: string[]; products: GetSlugProduct[] }> {
  if (!ids.length) return { ids: [], products: [] }
  const res = await fetch(`/api/wishlist?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`wishlist ${res.status}`)
  return res.json()
}

// Koszyk gościa trzyma pełne obiekty produktów w localStorage — mogą się
// zdezaktualizować (cena, dostępność) między wizytami. Po cichu dociągamy
// świeże dane i podmieniamy je w store (bez zmiany ilości, bez synchronizacji).
async function refreshCartProducts() {
  const ids = [...new Set(get().cartItems.map(i => i.product._id))]
  if (!ids.length) return
  const res = await fetch(`/api/cart/refresh?ids=${encodeURIComponent(ids.join(','))}`, { cache: 'no-store' })
  if (!res.ok) return
  const { products }: { products: GetSlugProduct[] } = await res.json()
  get().refreshCartProducts(products)
}

function replayWishlistOps(ops: WishlistOp[]) {
  for (const op of ops) get().setWishlisted(op.productId, op.wishlisted, op.product)
}

/**
 * Dociąga dane produktów dla wishlisty gościa. Wynik nakładamy na AKTUALNY
 * stan (użytkownik mógł w tym czasie coś polubić/odlubić), usuwając tylko te
 * id, których produktów nie ma już w katalogu.
 */
export async function loadGuestWishlistProducts(guard: Guard) {
  const requested = get().wishlistIds
  try {
    const { ids: existing, products } = await fetchGuestWishlist(requested)
    if (guard()) return
    const gone    = new Set(requested.filter(id => !existing.includes(id)))
    const current = get()
    const ids     = current.wishlistIds.filter(id => !gone.has(id))
    const byId    = new Map([...current.wishlistProducts, ...products].map(p => [p._id, p]))
    current.hydrateWishlist(ids, ids.map(id => byId.get(id)).filter((p): p is GetSlugProduct => !!p))
  } catch (err) {
    console.error('[StoreHydration] guest wishlist', err)
    if (guard()) return
    // Nie kasujemy polubień przy awarii — pokazujemy to, co mamy.
    const current = get()
    current.hydrateWishlist(current.wishlistIds, current.wishlistProducts)
  }
}

export async function startGuestSession({ afterLogout }: { afterLogout: boolean }, guard: Guard) {
  suspendSync()
  const s = get()

  if (afterLogout) {
    // Sesji już nie ma — zaległe zapisy konta i tak zostałyby odrzucone.
    dropPendingSync()
    s.replaceCart([], 'guest')
    useStore.setState({ guestWishlistIds: [] })
  } else if (s.cartOwner && s.cartOwner !== 'guest') {
    // Koszyk konta z poprzedniej wizyty (sesja wygasła bez wylogowania) —
    // nie pokazujemy go osobie niezalogowanej.
    s.replaceCart([], 'guest')
    useStore.setState({ guestWishlistIds: [] })
  } else {
    s.replaceCart(s.cartItems, 'guest')
  }

  get().setSession({ status: 'guest', userId: null })
  useStore.setState({
    cartReady:        true,
    wishlistIds:      get().guestWishlistIds,
    wishlistProducts: [],
    wishlistReady:    false,
  })

  const { cartDirty, wishlistOps } = resumeSync()
  replayWishlistOps(wishlistOps)
  if (cartDirty) syncCurrentCart()

  await Promise.all([
    loadGuestWishlistProducts(guard),
    refreshCartProducts().catch(console.error),
  ])
}

function linesToItems(lines: ReturnType<typeof mergeCartLines>, sources: CartItem[][]): CartItem[] {
  const productById = new Map<string, GetSlugProduct>()
  for (const list of sources) for (const i of list) productById.set(i.product._id, i.product)
  return lines
    .map(l => {
      const product = productById.get(l.productId)
      return product ? { product, variant: l.variantId, quantity: l.qty } : null
    })
    .filter((i): i is CartItem => !!i)
}

export async function startUserSession(userId: string, guard: Guard) {
  suspendSync()
  const s = get()

  // Dane innego konta (ta sama przeglądarka, inny użytkownik) — porzucamy.
  const foreignCart = !!s.cartOwner && s.cartOwner !== 'guest' && s.cartOwner !== userId
  const prevUser    = s.session.status === 'user' && s.session.userId !== userId
  if (foreignCart || prevUser) {
    dropPendingSync()
    s.replaceCart([], userId)
    s.clearWishlistState()
  }

  // Koszyk bez właściciela (stara wersja store) traktujemy jak koszyk gościa —
  // scalanie max() nie zdubluje ilości, jeśli to był już koszyk tego konta.
  const cartIsGuest   = get().cartOwner === 'guest' || get().cartOwner === null
  const guestItems    = cartIsGuest ? get().cartItems : []
  const guestWishlist = get().guestWishlistIds

  get().setSession({ status: 'user', userId })
  useStore.setState({ cartReady: false, wishlistReady: false })

  let result: Awaited<ReturnType<typeof hydrateUserSession>> | null = null
  for (const delay of HYDRATE_RETRY_DELAYS_MS) {
    if (delay) await sleep(delay)
    if (guard()) return
    try {
      result = await hydrateUserSession({ guestCart: toCartLines(guestItems), guestWishlist })
    } catch (err) {
      console.error('[StoreHydration] hydrateUserSession', err)
      result = null
    }
    if (result?.ok) break
  }
  if (guard()) return

  if (!result?.ok || result.userId !== userId) {
    // Nie udało się scalić. Zostawiamy lokalny stan i NIE wznawiamy
    // synchronizacji — inaczej lokalny koszyk nadpisałby koszyk konta.
    // Właściciel koszyka zostaje bez zmian, więc kolejne wejście ponowi scalanie.
    console.error('[StoreHydration] hydration failed', result)
    useStore.setState({ cartReady: true })
    const current = get()
    current.hydrateWishlist(current.wishlistIds, current.wishlistProducts)
    return
  }

  const serverItems: CartItem[] = result.cart.map(l => ({
    product: l.product, variant: l.variantId, quantity: l.qty,
  }))

  const { cartDirty, wishlistOps } = resumeSync()

  let items = serverItems
  if (cartDirty) {
    // Zmiany zrobione w trakcie hydracji — nakładamy je na wynik z serwera
    // (max ilości, nowe pozycje dopisane), a potem zapisujemy.
    // Usunięcie pozycji w tym oknie (ułamek sekundy) nie jest odtwarzane.
    const local = get().cartItems
    items = linesToItems(
      mergeCartLines(toCartLines(serverItems), toCartLines(local)),
      [serverItems, local],
    )
  }

  get().replaceCart(items, userId)
  useStore.setState({ guestWishlistIds: [], cartReady: true })
  get().hydrateWishlist(result.wishlist.ids, result.wishlist.products)
  replayWishlistOps(wishlistOps)
  if (cartDirty) syncCurrentCart()
}
