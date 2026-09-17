// src/actions/sync.ts
'use server'

import { auth } from '@clerk/nextjs/server'
import type { GetSlugProduct } from 'sanity.types'
import { fetchProductsByIds } from '@/sanity/helpers/clientRequest'
import {
  clearGuestCookie, deleteCart, getOrCreateGuestId, readCart, readGuestId,
  readWishlist, writeCart, writeWishlist,
} from '@/lib/cartServer'
import {
  mergeCartLines, mergeWishlistIds, reconcileWithCatalog, sanitizeCartLines,
  sanitizeWishlistIds, type CartLine,
} from '@/lib/cartMerge'

/**
 * Właściciel, dla którego klient przygotował payload: `'guest'` albo userId.
 * Serwer ignoruje zapis, gdy sesja w międzyczasie się zmieniła (np. debounce
 * odpalony już po wylogowaniu) — bez tego koszyk konta mógł wylądować
 * w koszyku gościa i odwrotnie.
 */
export type CartOwnerHint = 'guest' | (string & {})

export async function syncCart(items: CartLine[], expectedOwner: CartOwnerHint): Promise<void> {
  const lines = sanitizeCartLines(items)
  const { userId } = await auth()

  if (expectedOwner === 'guest') {
    if (userId) return
    await writeCart(await getOrCreateGuestId(), lines)
    return
  }

  if (!userId || userId !== expectedOwner) return
  await writeCart(userId, lines)
}

export async function syncWishlist(productIds: string[], expectedUserId: string): Promise<void> {
  const { userId } = await auth()
  if (!userId || userId !== expectedUserId) return
  await writeWishlist(userId, sanitizeWishlistIds(productIds))
}

export type HydratedCartLine = CartLine & { product: GetSlugProduct }

export type HydrateResult =
  | {
      ok:       true
      userId:   string
      cart:     HydratedCartLine[]
      wishlist: { ids: string[]; products: GetSlugProduct[] }
    }
  | { ok: false; error: 'unauthenticated' | 'failed' }

const sameCart = (a: CartLine[], b: CartLine[]) =>
  a.length === b.length &&
  a.every((l, i) => l.productId === b[i].productId && l.variantId === b[i].variantId && l.qty === b[i].qty)

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every(id => b.includes(id))

/**
 * Wywoływane po zalogowaniu i przy każdym starcie aplikacji dla zalogowanego.
 * Scala koszyk i wishlistę gościa z kontem, zapisuje wynik, sprząta dane gościa
 * i zwraca stan gotowy do wstawienia w store — razem ze świeżymi danymi
 * produktów z Sanity (ceny, dostępność).
 *
 * Zwraca wynik zamiast rzucać — Next maskuje treść wyjątków na produkcji.
 */
export async function hydrateUserSession(input: {
  guestCart:     CartLine[]
  guestWishlist: string[]
}): Promise<HydrateResult> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: 'unauthenticated' }

  try {
    const guestId = await readGuestId()

    const [userCart, serverGuestCart, userWishlist] = await Promise.all([
      readCart(userId),
      guestId ? readCart(guestId) : Promise.resolve<CartLine[]>([]),
      readWishlist(userId),
    ])

    // Kopia z localStorage jest najświeższa (kopia serwerowa gościa jest
    // debounce'owana). Gdy localStorage jest pusty, a ciasteczko gościa
    // przetrwało — korzystamy z kopii serwerowej.
    const clientGuestCart = sanitizeCartLines(input.guestCart)
    const guestCart       = clientGuestCart.length ? clientGuestCart : serverGuestCart

    const mergedCart     = mergeCartLines(userCart, guestCart)
    const mergedWishlist = mergeWishlistIds(userWishlist, sanitizeWishlistIds(input.guestWishlist))

    const ids      = [...new Set([...mergedCart.map(l => l.productId), ...mergedWishlist])]
    // Rzuca przy awarii Sanity → trafiamy do catch i NIE nadpisujemy danych
    // konta okrojoną listą.
    const products = await fetchProductsByIds(ids)

    const cart        = reconcileWithCatalog(mergedCart, products)
    const productById = new Map(products.map(p => [p._id, p]))
    const wishlistIds = mergedWishlist.filter(id => productById.has(id))
    const cartLines   = cart.map(({ productId, variantId, qty }) => ({ productId, variantId, qty }))

    await Promise.all([
      sameCart(cartLines, userCart)       ? null : writeCart(userId, cartLines),
      sameIds(wishlistIds, userWishlist)  ? null : writeWishlist(userId, wishlistIds),
    ])

    if (guestId) {
      await deleteCart(guestId)
      await clearGuestCookie()
    }

    return {
      ok: true,
      userId,
      cart,
      wishlist: { ids: wishlistIds, products: wishlistIds.map(id => productById.get(id)!) },
    }
  } catch (err) {
    console.error('[hydrateUserSession] failed', err)
    return { ok: false, error: 'failed' }
  }
}
