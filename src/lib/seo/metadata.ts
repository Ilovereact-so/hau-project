import type { Metadata } from 'next'
import { SELLER, SITE_DESCRIPTION, SITE_INDEXABLE, SITE_LOCALE, SITE_NAME, SITE_TITLE, SITE_URL, absoluteUrl } from '@/lib/site'

/*
 * Pomocniki do metadanych stron. Wszystko, co wpływa na wygląd linku
 * w Google i przy udostępnianiu, przechodzi przez to miejsce, żeby tytuły,
 * opisy i adresy kanoniczne były spójne.
 */

/** Opis skrócony do długości, którą Google i tak wyświetla. */
export function clampDescription(value: string | null | undefined, fallback = SITE_DESCRIPTION, max = 160): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.–-]+$/, '')}…`
}

type PageMetaInput = {
  title: string
  description?: string | null
  /** Ścieżka kanoniczna (bez parametrów). */
  path: string
  images?: Array<{ url: string; width?: number; height?: number; alt?: string }>
  /** `false` → strona z `noindex, follow` (listingi z filtrami, wyszukiwarka, konto). */
  index?: boolean
  type?: 'website' | 'article'
  /** `true` → tytuł bez dopisku „— HAU” (strona główna ma go już w treści). */
  absoluteTitle?: boolean
}

/** Metadane strony: tytuł, opis, adres kanoniczny, Open Graph i Twitter. */
export function pageMetadata({
  title,
  description,
  path,
  images,
  index = true,
  type = 'website',
  absoluteTitle = false,
}: PageMetaInput): Metadata {
  const canonical = path
  const desc = clampDescription(description)
  // Na staging (SITE_INDEXABLE=false) żadna strona nie idzie do indeksu.
  const indexable = index && SITE_INDEXABLE
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description: desc,
    alternates: { canonical },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: {
      type,
      url: absoluteUrl(canonical),
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      title,
      description: desc,
      ...(images?.length ? { images } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      ...(images?.length ? { images: images.map((image) => image.url) } : {}),
    },
  }
}

/** Dane strukturalne sklepu i wyszukiwarki — wstawiane raz, na stronie głównej. */
export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        ...(SELLER.name ? { legalName: SELLER.name } : {}),
        url: SITE_URL,
        // Rastrowe logo (PNG) — Google nie zawsze akceptuje SVG jako logo organizacji.
        logo: absoluteUrl('/email/hau-logo.png'),
        ...(SELLER.nip ? { vatID: `PL${SELLER.nip.replace(/\D/g, '')}` } : {}),
        ...(SELLER.email || SELLER.phone
          ? {
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer service',
                availableLanguage: 'pl',
                ...(SELLER.email ? { email: SELLER.email } : {}),
                ...(SELLER.phone ? { telephone: SELLER.phone } : {}),
              },
            }
          : {}),
        ...(SELLER.address ? { address: { '@type': 'PostalAddress', streetAddress: SELLER.address, addressCountry: 'PL' } } : {}),
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_TITLE,
        inLanguage: 'pl-PL',
        publisher: { '@id': `${SITE_URL}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

/** Okruszki nawigacji dla wyszukiwarek (ścieżka do bieżącej strony). */
export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  }
}

/**
 * `<script type="application/ld+json">` z bezpiecznym escapowaniem `<`,
 * żeby treść z CMS-a nie mogła zamknąć tagu script.
 */
export function jsonLdScript(data: unknown) {
  return {
    type: 'application/ld+json',
    dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, '\\u003c') },
  } as const
}
