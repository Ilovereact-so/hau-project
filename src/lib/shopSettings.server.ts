import 'server-only'
import { sanityClient } from '@/sanity/sanityClient.server'
import { EMPTY_SHOP_SETTINGS, SHOP_SETTINGS_ID, normalizeShopSettings, type ShopSettings } from '@/lib/shopSettings'

/**
 * Ustawienia sklepu prosto z Sanity (bez CDN) — kasa liczy z nich koszt
 * dostawy w zamówieniu, więc nie mogą pochodzić z cache sprzed zmiany.
 */
const fresh = sanityClient.withConfig({ useCdn: false, perspective: 'published' })

export async function getShopSettings(options: { fresh?: boolean } = {}): Promise<ShopSettings> {
  try {
    const data = await (options.fresh ? fresh : sanityClient).fetch<{
      settings: {
        freeShippingEnabled?: boolean
        freeShippingThreshold?: number
        socialFacebook?: string
        socialInstagram?: string
        socialTiktok?: string
      } | null
      minShipping: number | null
    }>(
      `{
        "settings": *[_id == $id][0]{ freeShippingEnabled, freeShippingThreshold, socialFacebook, socialInstagram, socialTiktok },
        "minShipping": math::min(*[_type == "shipping_methods" && active == true && defined(internal_price)].internal_price)
      }`,
      { id: SHOP_SETTINGS_ID },
      options.fresh ? { cache: 'no-store' } : { next: { revalidate: 60, tags: ['sanity'] } },
    )
    return normalizeShopSettings(data?.settings, data?.minShipping)
  } catch (error) {
    console.error('[shopSettings] fetch failed', error)
    return EMPTY_SHOP_SETTINGS
  }
}
