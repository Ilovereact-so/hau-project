/*
 * Kampanie newslettera — model treści, walidacja i składanie maila.
 * Czyste funkcje (bez importów serwerowych): używa ich edytor w panelu
 * (podgląd, licznik problemów) i serwer (wysyłka).
 *
 * Mail składa się z klocków `lib/emailLayout.ts` (ten sam wygląd co maile
 * zamówień i newslettera): nadtytuł, nagłówek, zdjęcie, tekst (Portable Text
 * z edytora panelu → HTML mailowy), przycisk, polecane produkty, kod rabatowy
 * i stopka z linkiem wypisania. Żaden HTML z panelu nie trafia do maila
 * „surowo” — tekst jest escapowany, linki przechodzą przez `normalizeHref`.
 */

import {
  EMAIL_COLORS as C,
  emailButton,
  emailCode,
  emailDocument,
  emailHeading,
  emailImage,
  emailLink,
  emailProducts,
  emailSectionTitle,
  escapeHtml,
  type EmailProductCard,
} from '@/lib/emailLayout'
import { normalizeHref } from '@/lib/guides/content'

export type CampaignImage = { assetId: string; url: string | null; alt: string }

export type CampaignContent = {
  /** krótki napis w nagłówku maila obok logo, np. „Nowości jesień 2026” (pusty = „Newsletter”) */
  eyebrow: string
  heading: string
  image: CampaignImage | null
  /** Portable Text z edytora (akapity, nagłówki, listy, linki, pogrubienia) */
  body: unknown[]
  button: { label: string; url: string } | null
  productsTitle: string
  productIds: string[]
  code: { code: string; caption: string } | null
}

export const CAMPAIGN_LIMITS = {
  name: 160,
  subject: 200,
  preheader: 200,
  eyebrow: 60,
  heading: 140,
  alt: 160,
  buttonLabel: 40,
  productsTitle: 80,
  products: 6,
  code: 40,
  codeCaption: 160,
} as const

export const EMPTY_CAMPAIGN_CONTENT: CampaignContent = {
  eyebrow: 'Newsletter HAU',
  heading: '',
  image: null,
  body: [],
  button: { label: 'Zobacz w sklepie', url: '/' },
  productsTitle: 'Polecamy',
  productIds: [],
  code: null,
}

const str = (value: unknown, max: number) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const ID_RE = /^[A-Za-z0-9._-]{1,128}$/
const ASSET_RE = /^image-[A-Za-z0-9]+-\d+x\d+-[a-z0-9]+$/

/** Dane z formularza albo bazy → poprawna treść (nieznane pola odpadają). */
export function normalizeCampaignContent(input: unknown): CampaignContent {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const image = (raw.image ?? null) as Record<string, unknown> | null
  const assetId = String(image?.assetId ?? '')
  const url = String(image?.url ?? '')
  const button = (raw.button ?? null) as Record<string, unknown> | null
  const code = (raw.code ?? null) as Record<string, unknown> | null
  const codeValue = str(code?.code, CAMPAIGN_LIMITS.code).toUpperCase().replace(/\s+/g, '')
  return {
    eyebrow: str(raw.eyebrow, CAMPAIGN_LIMITS.eyebrow),
    heading: str(raw.heading, CAMPAIGN_LIMITS.heading),
    image: ASSET_RE.test(assetId)
      ? { assetId, url: /^https:\/\/cdn\.sanity\.io\//.test(url) ? url : null, alt: str(image?.alt, CAMPAIGN_LIMITS.alt) }
      : null,
    body: Array.isArray(raw.body) ? raw.body : [],
    button: button && (str(button.label, 1) || str(button.url, 1))
      ? { label: str(button.label, CAMPAIGN_LIMITS.buttonLabel), url: String(button.url ?? '').trim().slice(0, 2000) }
      : null,
    productsTitle: str(raw.productsTitle, CAMPAIGN_LIMITS.productsTitle),
    productIds: [...new Set((Array.isArray(raw.productIds) ? raw.productIds : []).map((id) => String(id).replace(/^drafts\./, '')))]
      .filter((id) => ID_RE.test(id))
      .slice(0, CAMPAIGN_LIMITS.products),
    code: codeValue ? { code: codeValue, caption: str(code?.caption, CAMPAIGN_LIMITS.codeCaption) } : null,
  }
}

/** Tekst bloku Portable Text (bez formatowania). */
function blockText(block: Record<string, unknown>): string {
  const children = Array.isArray(block.children) ? (block.children as Array<Record<string, unknown>>) : []
  return children.map((child) => (typeof child?.text === 'string' ? child.text : '')).join('')
}

export function bodyHasText(body: unknown[]): boolean {
  return body.some((block) => {
    const b = (block ?? {}) as Record<string, unknown>
    return (b._type === 'block' && blockText(b).trim().length > 0) || b._type === 'image'
  })
}

export type CampaignDraft = { name: string; subject: string; preheader: string; content: CampaignContent }

/**
 * Co blokuje wysyłkę (pusta lista = można wysłać). Te same reguły sprawdza
 * serwer przed startem — panel tylko je pokazuje wcześniej.
 */
export function campaignProblems(draft: CampaignDraft): string[] {
  const problems: string[] = []
  if (!draft.subject.trim()) problems.push('Uzupełnij temat maila.')
  if (!draft.content.heading.trim()) problems.push('Uzupełnij nagłówek w treści.')
  if (!bodyHasText(draft.content.body) && !draft.content.productIds.length) {
    problems.push('Dodaj tekst albo produkty — mail nie może być pusty.')
  }
  if (draft.content.button) {
    if (!draft.content.button.label.trim()) problems.push('Przycisk nie ma napisu.')
    if (!normalizeHref(draft.content.button.url)) problems.push('Adres przycisku jest nieprawidłowy.')
  }
  if (draft.content.image && !draft.content.image.alt.trim()) {
    problems.push('Opisz zdjęcie (tekst alternatywny) — część skrzynek domyślnie nie pokazuje obrazków.')
  }
  return problems
}

// ─── linki ───────────────────────────────────────────────────────────────────

/** Slug do UTM: „Nowości jesień!” → „nowosci-jesien”. */
export function campaignSlug(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[łŁ]/g, 'l')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'kampania'
  )
}

/**
 * Bezpieczny, pełny adres linku z maila. Linki do sklepu dostają parametry
 * UTM (Google Analytics pokaże ruch z kampanii); adresy zewnętrzne zostają
 * bez zmian. `null` = link odrzucony (np. `javascript:`).
 */
export function campaignHref(input: unknown, shopUrl: string, slug: string): string | null {
  const href = normalizeHref(input)
  if (!href) return null
  if (/^(mailto|tel):/i.test(href)) return href
  if (href.startsWith('#')) return null
  const base = shopUrl.replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(href.startsWith('/') ? `${base}${href}` : href)
  } catch {
    return null
  }
  let shopHost = ''
  try {
    shopHost = new URL(base).host
  } catch {
    shopHost = ''
  }
  if (url.host === shopHost) {
    if (!url.searchParams.has('utm_source')) url.searchParams.set('utm_source', 'newsletter')
    if (!url.searchParams.has('utm_medium')) url.searchParams.set('utm_medium', 'email')
    if (!url.searchParams.has('utm_campaign')) url.searchParams.set('utm_campaign', slug)
  }
  return url.toString()
}

// ─── Portable Text → HTML mailowy ────────────────────────────────────────────

type PtSpan = { _type?: string; text?: string; marks?: string[] }
type PtBlock = {
  _type?: string
  _key?: string
  style?: string
  listItem?: string
  level?: number
  children?: PtSpan[]
  markDefs?: Array<{ _key?: string; _type?: string; href?: string }>
  asset?: { _ref?: string }
  alt?: string
  caption?: string
}

const P_STYLE = `margin:0 0 20px;font-size:15px;line-height:1.65;color:${C.text};`

function spansHtml(block: PtBlock, link: (href: unknown) => string | null): string {
  const defs = new Map((block.markDefs ?? []).map((def) => [def._key, def]))
  return (block.children ?? [])
    .map((span) => {
      let html = escapeHtml(String(span?.text ?? '')).replace(/\n/g, '<br>')
      if (!html) return ''
      const marks = Array.isArray(span?.marks) ? span.marks : []
      if (marks.includes('strong')) html = `<strong style="font-weight:500;color:${C.ink};">${html}</strong>`
      if (marks.includes('em')) html = `<em>${html}</em>`
      if (marks.includes('underline')) html = `<u>${html}</u>`
      for (const mark of marks) {
        const def = defs.get(mark)
        if (def?._type === 'link') {
          const href = link(def.href)
          if (href) html = emailLink(escapeHtml(href), html)
        }
      }
      return html
    })
    .join('')
}

/**
 * Portable Text → HTML z inline stylami. Obsługuje to, co daje edytor
 * panelu: akapit, H1–H4 (jako nagłówki maila), cytat, listy punktowane
 * i numerowane, pogrubienie, kursywę, podkreślenie, linki i zdjęcia.
 */
export function portableTextToEmailHtml(
  body: unknown[],
  opts: { link: (href: unknown) => string | null; imageUrl: (ref: string) => string | null },
): string {
  const out: string[] = []
  let list: { type: string; items: string[] } | null = null
  const flushList = () => {
    if (!list) return
    const tag = list.type === 'number' ? 'ol' : 'ul'
    out.push(
      `<${tag} style="margin:0 0 20px;padding:0 0 0 22px;font-size:15px;line-height:1.65;color:${C.text};">${list.items
        .map((item) => `<li style="margin:0 0 6px;">${item}</li>`)
        .join('')}</${tag}>`,
    )
    list = null
  }

  for (const raw of body) {
    const block = (raw ?? {}) as PtBlock
    if (block._type === 'image') {
      flushList()
      const src = block.asset?._ref ? opts.imageUrl(block.asset._ref) : null
      if (src) {
        out.push(emailImage(escapeHtml(src), escapeHtml(String(block.alt ?? '')), { margin: block.caption ? '0 0 10px' : '0 0 24px' }))
        if (block.caption) out.push(`<p style="margin:0 0 24px;font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(block.caption)}</p>`)
      }
      continue
    }
    if (block._type !== 'block') continue
    const html = spansHtml(block, opts.link)
    if (block.listItem) {
      const type = block.listItem === 'number' ? 'number' : 'bullet'
      if (list && list.type !== type) flushList()
      if (!list) list = { type, items: [] }
      if (html) list.items.push(html)
      continue
    }
    flushList()
    if (!html.trim()) continue
    switch (block.style) {
      case 'h1':
      case 'h2':
        out.push(`<h2 style="margin:32px 0 12px;font-size:20px;line-height:1.35;font-weight:500;color:${C.ink};">${html}</h2>`)
        break
      case 'h3':
      case 'h4':
        out.push(`<h3 style="margin:24px 0 10px;font-size:17px;line-height:1.4;font-weight:500;color:${C.ink};">${html}</h3>`)
        break
      case 'blockquote':
        out.push(
          `<p style="margin:0 0 20px;padding:2px 0 2px 16px;border-left:1px solid ${C.ink};font-size:15px;line-height:1.65;color:${C.text};">${html}</p>`,
        )
        break
      default:
        out.push(`<p style="${P_STYLE}">${html}</p>`)
    }
  }
  flushList()
  return out.join('\n')
}

/** Wersja tekstowa treści (multipart/alternative). */
export function portableTextToPlain(body: unknown[]): string {
  const lines: string[] = []
  let number = 0
  for (const raw of body) {
    const block = (raw ?? {}) as PtBlock
    if (block._type !== 'block') continue
    const text = blockText(block as Record<string, unknown>).trim()
    if (block.listItem === 'number') {
      number += 1
      if (text) lines.push(`${number}. ${text}`)
      continue
    }
    number = 0
    if (block.listItem) {
      if (text) lines.push(`• ${text}`)
      continue
    }
    if (text) lines.push(/^h[1-4]$/.test(block.style ?? '') ? text.toUpperCase() : text, '')
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

// ─── cały mail kampanii ──────────────────────────────────────────────────────

export type CampaignProduct = { id: string; title: string; slug: string; price: number | null; imageUrl: string | null }

export type RenderCampaignInput = {
  name: string
  subject: string
  preheader: string
  content: CampaignContent
  products: CampaignProduct[]
  shopUrl: string
  logoUrl: string
  /** Adres wypisania dla tego odbiorcy (podgląd: link poglądowy). */
  unsubscribeUrl: string
  /** Adres zdjęcia z Sanity (asset id → https://cdn.sanity.io/…). */
  imageUrl: (assetId: string, width: number) => string | null
}

const formatPrice = (value: number | null) =>
  value === null ? '' : `${value.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`

/** HTML i tekst maila kampanii dla jednego odbiorcy. */
export function renderCampaignEmail(input: RenderCampaignInput): { subject: string; html: string; text: string } {
  const { content, shopUrl } = input
  const slug = campaignSlug(input.name)
  const link = (href: unknown) => campaignHref(href, shopUrl, slug)
  const parts: string[] = []
  const textParts: string[] = []

  if (content.image) {
    const src = input.imageUrl(content.image.assetId, 1120) ?? content.image.url
    const href = content.button ? link(content.button.url) : null
    if (src) parts.push(emailImage(escapeHtml(src), escapeHtml(content.image.alt), href ? { href: escapeHtml(href) } : {}))
  }
  if (content.heading) {
    parts.push(emailHeading(escapeHtml(content.heading)))
    textParts.push(content.heading, '')
  }
  const bodyHtml = portableTextToEmailHtml(content.body, { link, imageUrl: (ref) => input.imageUrl(ref, 1120) })
  if (bodyHtml) parts.push(bodyHtml)
  const bodyText = portableTextToPlain(content.body)
  if (bodyText) textParts.push(bodyText, '')

  if (content.code) {
    parts.push(emailCode(escapeHtml(content.code.code), escapeHtml(content.code.caption || 'Wpisz go w koszyku przy zamówieniu.')))
    textParts.push(`Kod: ${content.code.code}${content.code.caption ? ` — ${content.code.caption}` : ''}`, '')
  }

  if (content.button) {
    const href = link(content.button.url)
    if (href && content.button.label) {
      parts.push(emailButton(escapeHtml(href), escapeHtml(content.button.label), { margin: '4px 0 32px' }))
      textParts.push(`${content.button.label}: ${href}`, '')
    }
  }

  const products: EmailProductCard[] = input.products
    .map((product) => {
      const href = link(`/product/${product.slug}`)
      if (!href) return null
      return { name: escapeHtml(product.title), price: formatPrice(product.price), href: escapeHtml(href), imageUrl: product.imageUrl ? escapeHtml(product.imageUrl) : null }
    })
    .filter((p): p is EmailProductCard => Boolean(p))
  if (products.length) {
    if (content.productsTitle) {
      parts.push(emailSectionTitle(escapeHtml(content.productsTitle)))
    }
    parts.push(emailProducts(products))
    if (content.productsTitle) textParts.push(content.productsTitle.toUpperCase())
    for (const product of input.products) {
      const href = link(`/product/${product.slug}`)
      if (href) textParts.push(`• ${product.title}${product.price !== null ? ` — ${formatPrice(product.price)}` : ''}: ${href}`)
    }
    textParts.push('')
  }

  const unsubscribe = escapeHtml(input.unsubscribeUrl)
  const footer =
    `Dostajesz tę wiadomość, bo zapisałeś(-aś) się do newslettera HAU i potwierdziłeś(-aś) zapis. ` +
    `${emailLink(unsubscribe, 'Wypisz się z newslettera')} (bez logowania).`
  textParts.push('—', `Dostajesz tę wiadomość, bo zapisałeś(-aś) się do newslettera HAU. Wypisz się: ${input.unsubscribeUrl}`, shopUrl)

  const html = emailDocument({
    title: escapeHtml(input.subject || content.heading || 'Newsletter HAU'),
    preheader: escapeHtml(input.preheader || content.heading || ''),
    shopUrl,
    logoUrl: input.logoUrl,
    meta: content.eyebrow ? escapeHtml(content.eyebrow) : 'Newsletter',
    body: parts.join('\n'),
    footer,
  })
  return { subject: input.subject, html, text: textParts.join('\n').replace(/\n{3,}/g, '\n\n').trim() }
}

// ─── statusy (etykiety w panelu) ─────────────────────────────────────────────

export const CAMPAIGN_STATUS_LABELS: Record<string, { label: string; tone: 'neutral' | 'info' | 'primary' | 'success' | 'danger' | 'purple' }> = {
  draft: { label: 'Szkic', tone: 'neutral' },
  scheduled: { label: 'Zaplanowana', tone: 'purple' },
  sending: { label: 'Wysyłanie', tone: 'info' },
  paused: { label: 'Wstrzymana', tone: 'danger' },
  sent: { label: 'Wysłana', tone: 'success' },
  cancelled: { label: 'Zatrzymana', tone: 'neutral' },
}

/** Szacowany czas wysyłki przy limitach („ok. 12 min”, „ok. 3 dni”). */
export function estimateSendTime(recipients: number, perMinute: number, perDay: number): string {
  if (recipients <= 0) return '—'
  if (recipients > perDay) {
    const days = Math.ceil(recipients / perDay)
    return `ok. ${days} ${days === 1 ? 'dzień' : 'dni'} (limit ${perDay} maili na dobę)`
  }
  const minutes = Math.ceil(recipients / Math.max(1, perMinute))
  if (minutes < 2) return 'ok. minuty'
  if (minutes < 60) return `ok. ${minutes} min`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `ok. ${String(hours).replace('.', ',')} h`
}
