import 'server-only'
import { auth } from '@clerk/nextjs/server'
import { unstable_rethrow } from 'next/navigation'
import { sanityClient } from '@/sanity/sanityClient.server'
import { PRODUCT_BY_ID_QUERY } from '@/sanity/helpers'
import type { GetSlugProduct } from 'sanity.types'

/*
 * Podgląd nieopublikowanego produktu (szkicu) dla admina.
 *
 * Klient widzi wyłącznie opublikowane produkty (perspektywa `published`),
 * więc szkic z importu albo wycofany produkt daje mu 404. Admin może go
 * jednak obejrzeć pod tym samym adresem — z banerem „Podgląd szkicu”.
 */

const drafts = sanityClient.withConfig({ perspective: 'drafts', useCdn: false })

export async function isAdminViewer(): Promise<boolean> {
  try {
    const { sessionClaims } = await auth()
    return (sessionClaims?.metadata as { role?: string } | undefined)?.role === 'admin'
  } catch (err) {
    unstable_rethrow(err)
    return false
  }
}

/** Szkic (albo zmiany w szkicu) produktu po slugu — tylko dla admina, inaczej null. */
export async function getProductPreviewForAdmin(slug: string): Promise<GetSlugProduct | null> {
  if (!(await isAdminViewer())) return null
  try {
    const product = await drafts.fetch<GetSlugProduct | null>(PRODUCT_BY_ID_QUERY, { slug })
    if (!product) return null
    // Perspektywa `drafts` zwraca `_id` szkicu — reszta sklepu (opinie, ceny,
    // koszyk) posługuje się bazowym id.
    return { ...product, _id: product._id.replace(/^drafts\./, '') }
  } catch (err) {
    console.error('[preview] draft product failed', err)
    return null
  }
}
