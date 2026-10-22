/*
 * Wspólny wygląd maili HAU — powiadomienia o zamówieniach (orderEmails.ts),
 * odstąpienie od umowy, newsletter (szablony w bazie) i kampanie. Jedno
 * miejsce na kolory, typografię, nagłówek i stopkę.
 *
 * Styl „profil” — ten sam język co strona /profile w sklepie:
 *  - płasko i biało (bez karty na szarym tle), treść do 560 px, do lewej,
 *  - nagłówek: logo z lewej, kontekst (numer zamówienia, „Newsletter”)
 *    z prawej, pod spodem czarna linia 1 px — jak nagłówek profilu,
 *  - tytuł Poppins 500 (jak „Cześć …!”), tekst #3A3A3A, etykiety #6C6C6C,
 *  - pozycje w szarym panelu #EDEDED z miniaturami (lista ze strony
 *    zamówienia), podsumowanie z „Łącznie” pod czarną linią,
 *  - czarne przyciski-pigułki, szare dla akcji drugorzędnych,
 *  - kolor tylko z sensem: mięta = rabat / dobra wiadomość, bursztyn =
 *    termin mija. Bez nadtytułów wersalikami, kolorowych pasków i emoji.
 *
 * HTML mailowy, nie stronowy:
 *  - układ na tabelach, style inline (Outlook nie zna flex/grid, część
 *    klientów wycina <style>; blok <style> w <head> to tylko dodatek —
 *    układ na telefonie),
 *  - Poppins ładuje się z Google Fonts tam, gdzie klient poczty na to
 *    pozwala (Apple Mail, iOS); Gmail i Outlook pokażą Helveticę/Arial —
 *    układ jest ten sam, zmienia się tylko krój,
 *  - logo to PNG z adresu sklepu (`/email/hau-logo.png`) — Gmail i Outlook
 *    NIE wyświetlają SVG,
 *  - stała paleta jasna (`color-scheme: light`).
 *
 * Funkcje przyjmują GOTOWY HTML — teksty od klienta (nazwy produktów,
 * adresy) escapuje wołający (`escapeHtml`).
 */

export const EMAIL_LOGO_PATH = '/email/hau-logo.png'

export const EMAIL_COLORS = {
  page:      '#ffffff',
  ink:       '#20201f',   // --facny-black w sklepie
  text:      '#3a3a3a',
  muted:     '#6c6c6c',
  faint:     '#9a9a9a',
  line:      '#e0e0e0',
  panel:     '#ededed',   // szare panele z profilu
  mint:      '#e2f3f0',   // tło „dobrej wiadomości” (jak baner „Dziękujemy” w profilu)
  mintText:  '#1f6b5e',   // miętowy do tekstu — kontrast ≥ 4.5:1 na bieli
  amber:     '#fff4d6',
  amberText: '#7a5200',
} as const
const C = EMAIL_COLORS

export const EMAIL_FONT_STACK = "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const FONT = EMAIL_FONT_STACK
const TABLE = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"'

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Wyróżnienie w tekście (numer zamówienia, adres e-mail). */
export const emailStrong = (html: string) => `<span style="color:${C.ink};font-weight:500;">${html}</span>`

/** Link w treści — czarny, podkreślony (jak linki w profilu). */
export const emailLink = (href: string, label: string) =>
  `<a href="${href}" style="color:${C.ink};text-decoration:underline;text-underline-offset:2px;">${label}</a>`

/**
 * Miniatura produktu do maila. Adres pochodzi z zamówienia (kasa zapisuje
 * adres CDN Sanity), więc przepuszczamy WYŁĄCZNIE `https://cdn.sanity.io/images/…`
 * i budujemy parametry od nowa: kwadrat, JPG (Outlook nie zna WebP), białe
 * tło pod przezroczystość. Inny adres = brak miniatury.
 */
export function emailThumbUrl(raw: string | null | undefined, size = 136): string | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.sanity.io' || !url.pathname.startsWith('/images/')) return null
  return `https://cdn.sanity.io${url.pathname}?w=${size}&h=${size}&fit=crop&fm=jpg&q=80&bg=ffffff`
}

// ─── klocki treści ───────────────────────────────────────────────────────────

/** Tytuł maila — Poppins 500, jak „Cześć …!” w profilu. */
export const emailHeading = (text: string) =>
  `<h1 class="hau-h1" style="margin:0 0 16px;font-size:28px;line-height:1.25;font-weight:500;letter-spacing:-0.2px;color:${C.ink};">${text}</h1>`

export const emailParagraph = (html: string, opts: { muted?: boolean; size?: number; margin?: string } = {}) =>
  `<p style="margin:${opts.margin ?? '0 0 24px'};font-size:${opts.size ?? 15}px;line-height:1.65;color:${opts.muted ? C.muted : C.text};">${html}</p>`

/** Drobny szary tekst (uwagi pod przyciskiem, „jeśli to nie Ty…”). */
export const emailSmall = (html: string, margin = '16px 0 0') =>
  `<p style="margin:${margin};font-size:13px;line-height:1.6;color:${C.muted};">${html}</p>`

/** „Stan zamówienia: Opłacone” — ta sama linijka co na stronie zamówienia. */
export const emailStatus = (label: string, value: string) =>
  `<p style="margin:0 0 28px;font-size:15px;line-height:1.5;color:${C.muted};">${label}: <span style="color:${C.ink};font-weight:500;">${value}</span></p>`

/** Tytuł sekcji w treści („Co dalej”, „Polecamy”). */
export const emailSectionTitle = (text: string) =>
  `<p style="margin:0 0 16px;font-size:18px;line-height:1.4;font-weight:500;color:${C.ink};">${text}</p>`

/** Przycisk-pigułka — komórka z tłem (`bgcolor` dla Outlooka) i linkiem na całą powierzchnię. */
export const emailButton = (href: string, label: string, opts: { margin?: string; secondary?: boolean } = {}) => {
  const bg = opts.secondary ? C.panel : C.ink
  const fg = opts.secondary ? C.ink : '#ffffff'
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${opts.margin ?? '0'};">
  <tr>
    <td bgcolor="${bg}" style="background:${bg};border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:17px 32px;font-family:${FONT};font-size:15px;line-height:1;font-weight:600;color:${fg};text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`
}

export const emailDivider = (margin = '32px 0') =>
  `<table ${TABLE} style="margin:${margin};"><tr><td style="height:1px;line-height:1px;font-size:0;background:${C.line};">&nbsp;</td></tr></table>`

/**
 * Komunikat w zaokrąglonym panelu (termin płatności, treść oświadczenia).
 * `grey` — informacja, `mint` — dobra wiadomość, `amber` — termin mija / do sprawdzenia.
 */
export const emailNote = (html: string, opts: { title?: string; tone?: 'grey' | 'mint' | 'amber' } = {}) => {
  const tone = opts.tone ?? 'grey'
  const bg = tone === 'mint' ? C.mint : tone === 'amber' ? C.amber : C.panel
  return `<table ${TABLE} style="margin:0 0 28px;">
  <tr>
    <td bgcolor="${bg}" style="background:${bg};border-radius:20px;padding:18px 22px;">
      ${opts.title ? `<p style="margin:0 0 4px;font-size:15px;line-height:1.5;font-weight:500;color:${C.ink};">${opts.title}</p>` : ''}
      <p style="margin:0;font-size:14px;line-height:1.6;color:${C.text};">${html}</p>
    </td>
  </tr>
</table>`
}

/** Kod rabatowy: szary panel, kod duży i rozstrzelony, opis z prawej (na telefonie pod spodem). */
export const emailCode = (code: string, caption: string, label = 'Twój kod') =>
  `<table ${TABLE} style="margin:0 0 28px;">
  <tr>
    <td bgcolor="${C.panel}" style="background:${C.panel};border-radius:20px;padding:22px 24px;">
      <table ${TABLE}>
        <tr>
          <td valign="middle" class="hau-col${caption ? '' : ' hau-col-last'}">
            <p style="margin:0 0 2px;font-size:13px;line-height:1.5;color:${C.muted};">${label}</p>
            <p style="margin:0;font-size:26px;line-height:1.25;font-weight:500;letter-spacing:4px;color:${C.ink};">${code}</p>
          </td>
          ${caption ? `<td valign="middle" align="right" class="hau-col hau-col-last" style="padding:0 0 0 16px;font-size:14px;line-height:1.5;color:${C.text};">${caption}</td>` : ''}
        </tr>
      </table>
    </td>
  </tr>
</table>`

/** Etykieta + wartość (np. „Dostawa” / adres) — kolumny obok siebie, na telefonie jedna pod drugą. */
export const emailDetails = (columns: { label: string; value: string }[]) =>
  `<table ${TABLE} style="margin:0 0 32px;">
  <tr>
    ${columns
      .map(
        (column, index) => `<td valign="top" width="${Math.floor(100 / columns.length)}%" class="hau-col${index === columns.length - 1 ? ' hau-col-last' : ''}" style="padding:0 ${index < columns.length - 1 ? '20px' : '0'} 0 0;">
      <p style="margin:0 0 4px;font-size:13px;line-height:1.5;color:${C.muted};">${column.label}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${C.ink};">${column.value}</p>
    </td>`,
      )
      .join('')}
  </tr>
</table>`

export interface EmailLineItem {
  /** Escapowany HTML. */
  name:      string
  /** Escapowany HTML (wariant), opcjonalny. */
  detail?:   string
  qty:       number
  /** Sformatowana kwota; brak = lista bez cen. */
  amount?:   string
  /** Adres miniatury (już przez `emailThumbUrl`); brak = bez miniatury. */
  imageUrl?: string | null
}

/**
 * Pozycje zamówienia w szarym panelu — jak lista na stronie zamówienia
 * w profilu: miniatura, nazwa, „wariant · ilość” szarym, kwota z prawej.
 * Kolumna miniatur pojawia się, gdy choć jedna pozycja ma zdjęcie.
 */
export const emailItems = (items: EmailLineItem[]) => {
  const withThumbs = items.some((item) => item.imageUrl)
  const rows = items
    .map((item, index) => {
      const top = index === 0 ? 12 : 8
      const bottom = index === items.length - 1 ? 12 : 8
      const pad = (left: number, right: number) => `padding:${top}px ${right}px ${bottom}px ${left}px;`
      const meta = [item.detail, `${item.qty}&nbsp;szt.`].filter(Boolean).join(' · ')
      return `<tr>
      ${withThumbs
        ? `<td width="68" valign="middle" class="hau-thumb" style="width:68px;${pad(0, 16)}">
        ${item.imageUrl
          ? `<img src="${item.imageUrl}" width="68" height="68" alt="" style="display:block;width:68px;height:68px;border:0;border-radius:16px;background:#ffffff;">`
          : `<div style="width:68px;height:68px;border-radius:16px;background:#e2e2e2;">&nbsp;</div>`}
      </td>`
        : ''}
      <td valign="middle" style="${pad(0, 0)}">
        <p style="margin:0;font-size:15px;line-height:1.4;color:${C.ink};">${item.name}</p>
        <p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:${C.muted};">${meta}</p>
      </td>
      ${item.amount !== undefined
        ? `<td valign="middle" align="right" style="${pad(12, 0)}white-space:nowrap;font-size:15px;line-height:1.4;font-weight:500;color:${C.ink};">${item.amount}</td>`
        : ''}
    </tr>`
    })
    .join('')
  return `<table ${TABLE} style="margin:0 0 28px;">
  <tr>
    <td bgcolor="${C.panel}" class="hau-panel" style="background:${C.panel};border-radius:28px;padding:10px 22px;">
      <table ${TABLE}>${rows}</table>
    </td>
  </tr>
</table>`
}

/**
 * Podsumowanie kwot jak „Podsumowanie” w profilu: etykiety szare, ostatni
 * wiersz („Łącznie”, „Do zapłaty”) pod czarną linią. `accent` = rabat (mięta).
 */
export const emailTotals = (rows: { label: string; value: string; accent?: boolean }[]) => {
  if (!rows.length) return ''
  const last = rows[rows.length - 1]
  const rest = rows.slice(0, -1)
  return `<table ${TABLE} style="margin:0 0 32px;">
  ${rest
    .map(
      (row) => `<tr>
    <td style="padding:3px 0;font-size:14px;line-height:1.5;color:${row.accent ? C.mintText : C.muted};">${row.label}</td>
    <td align="right" style="padding:3px 0;font-size:14px;line-height:1.5;color:${row.accent ? C.mintText : C.ink};white-space:nowrap;">${row.value}</td>
  </tr>`,
    )
    .join('')}
  ${rest.length ? `<tr><td colspan="2" style="padding:12px 0 0;"><table ${TABLE}><tr><td style="height:1px;line-height:1px;font-size:0;background:${C.ink};">&nbsp;</td></tr></table></td></tr>` : ''}
  <tr>
    <td style="padding:${rest.length ? 12 : 0}px 0 0;font-size:16px;line-height:1.4;font-weight:500;color:${C.ink};">${last.label}</td>
    <td align="right" style="padding:${rest.length ? 12 : 0}px 0 0;font-size:18px;line-height:1.4;font-weight:500;color:${C.ink};white-space:nowrap;">${last.value}</td>
  </tr>
</table>`
}

/** Zdjęcie na całą szerokość treści (np. główne zdjęcie kampanii). `href` — opcjonalny link. */
export const emailImage = (src: string, alt: string, opts: { href?: string; margin?: string } = {}) => {
  const img = `<img src="${src}" width="560" alt="${alt}" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:24px;outline:none;text-decoration:none;">`
  return `<table ${TABLE} style="margin:${opts.margin ?? '0 0 28px'};">
  <tr><td>${opts.href ? `<a href="${opts.href}" style="display:block;text-decoration:none;">${img}</a>` : img}</td></tr>
</table>`
}

export interface EmailProductCard {
  /** Escapowany HTML. */
  name:     string
  /** Sformatowana cena (np. „49,99 zł”) albo pusty ciąg. */
  price:    string
  href:     string
  imageUrl: string | null
}

/** Produkty po dwa (na telefonie jeden pod drugim): zdjęcie 20 px zaokrąglenia, nazwa, cena. */
export const emailProducts = (products: EmailProductCard[]) => {
  const cell = (p: EmailProductCard, right: boolean) => `<td valign="top" width="50%" class="hau-col" style="padding:0 ${right ? 0 : 8}px 24px ${right ? 8 : 0}px;">
      <a href="${p.href}" style="display:block;text-decoration:none;color:${C.ink};">
        ${p.imageUrl ? `<img src="${p.imageUrl}" width="272" alt="" class="hau-fluid" style="display:block;width:100%;max-width:272px;height:auto;border:0;border-radius:20px;background:${C.panel};">` : ''}
        <p style="margin:12px 0 2px;font-size:15px;line-height:1.4;color:${C.ink};">${p.name}</p>
        ${p.price ? `<p style="margin:0;font-size:15px;line-height:1.4;font-weight:500;color:${C.ink};">${p.price}</p>` : ''}
      </a>
    </td>`
  const rows: string[] = []
  for (let i = 0; i < products.length; i += 2) {
    const pair = products.slice(i, i + 2)
    rows.push(`<tr>${pair.map((p, j) => cell(p, j === 1)).join('')}${pair.length === 1 ? '<td width="50%" class="hau-col hau-hide" style="padding:0;">&nbsp;</td>' : ''}</tr>`)
  }
  return `<table ${TABLE} style="margin:0 0 4px;">
  ${rows.join('\n  ')}
</table>`
}

// ─── cały mail ───────────────────────────────────────────────────────────────

export interface EmailDocumentOptions {
  /** <title> i tekst dla czytników ekranu. */
  title:     string
  /** Podgląd w skrzynce (szary tekst obok tematu). */
  preheader: string
  /** Adres sklepu — w szablonach z bazy placeholder `{{shopUrl}}`. */
  shopUrl:   string
  /** Adres PNG z logo — w szablonach z bazy placeholder `{{logoUrl}}`. */
  logoUrl:   string
  /** Kontekst w nagłówku z prawej („Zamówienie #AB12CD34”, „Newsletter”). Gotowy HTML. */
  meta?:     string
  /** Treść (gotowy HTML z klocków powyżej). */
  body:      string
  /** Tekst w stopce (kontakt, wypisanie). */
  footer?:   string
  /** Najmniejszy tekst na samym dole (dane sprzedawcy, prawo odstąpienia). */
  legal?:    string
}

export function emailDocument({ title, preheader, shopUrl, logoUrl, meta, body, footer, legal }: EmailDocumentOptions): string {
  // Wypełniacz po preheaderze — bez niego skrzynka dokleja do podglądu
  // początek treści maila.
  const spacer = '&#8204;&nbsp;'.repeat(60)
  const sep = `<span style="color:${C.line};">&nbsp;&nbsp;/&nbsp;&nbsp;</span>`
  const nav = (path: string, label: string) => `<a href="${shopUrl}${path}" style="color:${C.ink};text-decoration:none;">${label}</a>`
  return `<!DOCTYPE html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width: 600px) {
    .hau-outer { padding: 28px 20px 36px !important; }
    .hau-h1 { font-size: 24px !important; }
    .hau-col { display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; text-align: left !important; }
    .hau-col-last { padding-bottom: 0 !important; }
    .hau-fluid { width: 100% !important; max-width: none !important; }
    .hau-hide { display: none !important; }
    .hau-panel { padding: 8px 16px !important; border-radius: 24px !important; }
    .hau-thumb, .hau-thumb img, .hau-thumb div { width: 56px !important; height: 56px !important; }
  }
  a { text-decoration: none; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${preheader}${spacer}</div>
<table ${TABLE} bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" class="hau-outer" style="padding:44px 24px 48px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;font-family:${FONT};color:${C.ink};">
        <tr>
          <td style="padding:0 0 18px;">
            <table ${TABLE}>
              <tr>
                <td valign="bottom">
                  <a href="${shopUrl}" style="display:inline-block;text-decoration:none;">
                    <img src="${logoUrl}" width="48" height="40" alt="HAU" style="display:block;width:48px;height:40px;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:18px;font-weight:600;letter-spacing:2px;color:${C.ink};">
                  </a>
                </td>
                <td valign="bottom" align="right" style="font-size:13px;line-height:1.4;color:${C.muted};">${meta ?? ''}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td style="height:1px;line-height:1px;font-size:0;background:${C.ink};">&nbsp;</td></tr>
        <tr>
          <td style="padding:40px 0 0;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:44px 0 0;">
            <table ${TABLE}><tr><td style="height:1px;line-height:1px;font-size:0;background:${C.line};">&nbsp;</td></tr></table>
            <p style="margin:24px 0 0;font-size:14px;line-height:1.5;">
              ${nav('', 'Sklep')}${sep}${nav('/profile/orders', 'Moje zamówienia')}${sep}${nav('/poradniki', 'Poradniki')}${sep}${nav('/help', 'Pomoc')}
            </p>
            ${footer ? `<p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:${C.muted};">${footer}</p>` : ''}
            ${legal ? `<p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${C.faint};">${legal}</p>` : ''}
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${C.faint};">HAU · e-hau.pl</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
