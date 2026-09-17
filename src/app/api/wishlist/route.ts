import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import type { GetSlugProduct } from 'sanity.types'
import { fetchProductsByIds } from '@/sanity/helpers/clientRequest'
import { readWishlist } from '@/lib/cartServer'
import { sanitizeWishlistIds } from '@/lib/cartMerge'
import { syncWishlist } from '@/actions/sync'
import { isSameOrigin } from '@/lib/sameOrigin'

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * GET /api/wishlist
 *  - zalogowany: wishlista konta (Redis → fallback MySQL) + produkty,
 *  - gość: `?ids=a,b,c` z localStorage → produkty (wishlisty gościa nie
 *    trzymamy na serwerze). Zwracane `ids` to tylko te, które wciąż istnieją
 *    w katalogu — klient na tej podstawie sprząta localStorage.
 * Przy awarii Sanity zwraca 502, żeby klient niczego nie kasował.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth()

  try {
    const ids = userId
      ? await readWishlist(userId)
      : sanitizeWishlistIds((req.nextUrl.searchParams.get('ids') ?? '').split(','))

    const products = await fetchProductsByIds(ids)
    const byId     = new Map(products.map(p => [p._id, p]))
    const ordered  = ids.map(id => byId.get(id)).filter((p): p is GetSlugProduct => !!p)

    return NextResponse.json(
      { ids: ordered.map(p => p._id), products: ordered },
      { headers: NO_STORE },
    )
  } catch (err) {
    console.error('[api/wishlist] GET failed', err)
    return NextResponse.json({ error: 'failed' }, { status: 502, headers: NO_STORE })
  }
}

/** PUT /api/wishlist — zapis keepalive przy zamykaniu karty (tylko konto). */
export async function PUT(req: NextRequest) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const { ids, owner } = (body ?? {}) as { ids?: unknown; owner?: unknown }
  if (typeof owner !== 'string' || !Array.isArray(ids)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  try {
    // syncWishlist sanityzuje listę i sprawdza, czy owner == zalogowany user.
    await syncWishlist(ids as string[], owner)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/wishlist] PUT failed', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
