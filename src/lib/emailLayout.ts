/*
 * Wspólny wygląd maili HAU — newsletter (szablony w bazie) i powiadomienia
 * o zamówieniach (orderEmails.ts). Jedno miejsce na kolory, typografię,
 * logo i stopkę.
 *
 * HTML mailowy, nie stronowy:
 *  - układ na tabelach, style inline (Outlook nie zna flex/grid, część
 *    klientów wycina <style>; blok <style> w <head> to tylko dodatek —
 *    mniejsze marginesy na telefonie),
 *  - logo to PNG z adresu sklepu (`/email/hau-logo.png`) — Gmail i Outlook
 *    NIE wyświetlają SVG; plik powstał z wektorowego logo w wysokiej
 *    rozdzielczości (240 px, wyświetlany w 72 px → ostry na ekranach retina),
 *  - stała paleta jasna (`color-scheme: light`) — tryb ciemny klientów
 *    poczty i tak przyciemnia tło, a miętowe logo jest czytelne na obu.
 *
 * Funkcje przyjmują GOTOWY HTML — teksty od klienta (nazwy produktów,
 * adresy) escapuje wołający (`escapeHtml`).
 */

export const EMAIL_LOGO_PATH = '/email/hau-logo.png'

const C = {
  page:   '#f5f5f3',
  card:   '#ffffff',
  ink:    '#1b1b1b',
  text:   '#4a4a4a',
  muted:  '#8a8a8a',
  line:   '#ececea',
  mint:   '#4eccb5',              // kolor logo
  mintText: '#1f7f6e',            // miętowy do tekstu — kontrast ≥ 4.5:1 na bieli
  mintTint: '#eefaf7',
  amberTint: '#fff6e6',
  amberText: '#8a5300',
  greyTint: '#f4f4f2',
} as const

const FONT = "'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif"
const MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace"

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// ─── klocki treści ───────────────────────────────────────────────────────────

/** Mały nadtytuł nad nagłówkiem („Newsletter”, „Zamówienie #AB12CD34”). */
export const emailEyebrow = (text: string) =>
  `<p style="margin:0 0 14px;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.mintText};">${text}</p>`

export const emailHeading = (text: string) =>
  `<h1 class="hau-h1" style="margin:0 0 14px;font-size:26px;line-height:1.3;font-weight:600;letter-spacing:-0.3px;color:${C.ink};">${text}</h1>`

export const emailParagraph = (html: string, opts: { muted?: boolean; size?: number; margin?: string } = {}) =>
  `<p style="margin:${opts.margin ?? '0 0 20px'};font-size:${opts.size ?? 15}px;line-height:1.7;color:${opts.muted ? C.muted : C.text};">${html}</p>`

/** Przycisk — komórka tabeli z tłem (`bgcolor` dla Outlooka) i linkiem na całą powierzchnię. */
export const emailButton = (href: string, label: string, opts: { margin?: string } = {}) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:${opts.margin ?? '8px 0 4px'};">
  <tr>
    <td bgcolor="${C.ink}" style="background:${C.ink};border-radius:999px;">
      <a href="${href}" style="display:inline-block;padding:15px 34px;font-family:${FONT};font-size:15px;line-height:1;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${label}</a>
    </td>
  </tr>
</table>`

export const emailDivider = (margin = '32px 0') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:${margin};"><tr><td style="height:1px;line-height:1px;font-size:0;background:${C.line};">&nbsp;</td></tr></table>`

/** Wyróżniona ramka (termin płatności, informacja). */
export const emailNote = (html: string, tone: 'mint' | 'amber' | 'grey' = 'mint') => {
  const bg = tone === 'amber' ? C.amberTint : tone === 'grey' ? C.greyTint : C.mintTint
  const color = tone === 'amber' ? C.amberText : tone === 'grey' ? C.text : C.ink
  const bar = tone === 'amber' ? '#f0b44c' : tone === 'grey' ? '#d6d6d2' : C.mint
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    <td width="3" style="width:3px;background:${bar};border-radius:3px 0 0 3px;font-size:0;line-height:0;">&nbsp;</td>
    <td style="background:${bg};border-radius:0 12px 12px 0;padding:14px 18px;font-size:14px;line-height:1.6;color:${color};">${html}</td>
  </tr>
</table>`
}

/** Kod rabatowy — duży, czytelny, łatwy do zaznaczenia. */
export const emailCode = (code: string, label: string, caption: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">
  <tr>
    <td align="center" style="background:${C.mintTint};border-radius:16px;padding:26px 20px 24px;">
      <p style="margin:0 0 10px;font-size:12px;line-height:1.4;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${C.mintText};">${label}</p>
      <p style="margin:0;font-family:${MONO};font-size:28px;line-height:1.2;font-weight:700;letter-spacing:5px;color:${C.ink};">${code}</p>
      <p style="margin:10px 0 0;font-size:14px;line-height:1.4;color:${C.text};">${caption}</p>
    </td>
  </tr>
</table>`

/** Etykieta + wartość (np. „Dostawa” / adres) — dwie kolumny obok siebie. */
export const emailDetails = (columns: { label: string; value: string }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
  <tr>
    ${columns
      .map(
        (column, index) => `<td valign="top" width="${Math.floor(100 / columns.length)}%" class="hau-col" style="padding:0 ${index < columns.length - 1 ? '16px' : '0'} 0 0;">
      <p style="margin:0 0 6px;font-size:11px;line-height:1.4;font-weight:600;letter-spacing:1.4px;text-transform:uppercase;color:${C.muted};">${column.label}</p>
      <p style="margin:0;font-size:14px;line-height:1.6;color:${C.ink};">${column.value}</p>
    </td>`,
      )
      .join('')}
  </tr>
</table>`

export interface EmailLineItem {
  /** Escapowany HTML. */
  name:    string
  /** Escapowany HTML (wariant), opcjonalny. */
  detail?: string
  qty:     number
  /** Sformatowana kwota albo pusty ciąg (lista bez cen). */
  amount?: string
}

/** Lista pozycji zamówienia. */
export const emailItems = (items: EmailLineItem[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px;border-top:1px solid ${C.line};">
  ${items
    .map(
      (item) => `<tr>
    <td style="padding:14px 12px 14px 0;border-bottom:1px solid ${C.line};font-size:14px;line-height:1.5;color:${C.ink};">
      ${item.name}${item.detail ? `<br><span style="font-size:13px;color:${C.muted};">${item.detail}</span>` : ''}
    </td>
    <td align="right" style="padding:14px 0;border-bottom:1px solid ${C.line};font-size:13px;line-height:1.5;color:${C.muted};white-space:nowrap;">${item.qty}&nbsp;szt.</td>
    ${item.amount !== undefined ? `<td align="right" width="96" style="padding:14px 0 14px 12px;border-bottom:1px solid ${C.line};font-size:14px;line-height:1.5;color:${C.ink};white-space:nowrap;">${item.amount}</td>` : ''}
  </tr>`,
    )
    .join('')}
</table>`

/** Podsumowanie kwot; ostatni wiersz pogrubiony. */
export const emailTotals = (rows: { label: string; value: string; accent?: boolean }[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px;">
  ${rows
    .map((row, index) => {
      const last = index === rows.length - 1
      const color = row.accent ? C.mintText : last ? C.ink : C.text
      return `<tr>
    <td style="padding:${last ? '12px' : '4px'} 0 0;font-size:${last ? 16 : 14}px;line-height:1.5;font-weight:${last ? 600 : 400};color:${color};">${row.label}</td>
    <td align="right" style="padding:${last ? '12px' : '4px'} 0 0;font-size:${last ? 16 : 14}px;line-height:1.5;font-weight:${last ? 600 : 400};color:${color};white-space:nowrap;">${row.value}</td>
  </tr>`
    })
    .join('')}
</table>`

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
  /** Treść karty (gotowy HTML z klocków powyżej). */
  body:      string
  /** Drobny tekst w stopce (zgoda, wypisanie, kontakt). */
  footer?:   string
}

export function emailDocument({ title, preheader, shopUrl, logoUrl, body, footer }: EmailDocumentOptions): string {
  // Wypełniacz po preheaderze — bez niego skrzynka dokleja do podglądu
  // początek treści maila („Newsletter Potwierdź…”).
  const spacer = '&#8204;&nbsp;'.repeat(60)
  return `<!DOCTYPE html>
<html lang="pl" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
<style>
  @media only screen and (max-width: 600px) {
    .hau-outer { padding: 24px 12px !important; }
    .hau-card { padding: 32px 24px 28px !important; border-radius: 16px !important; }
    .hau-h1 { font-size: 22px !important; }
    .hau-col { display: block !important; width: 100% !important; padding: 0 0 16px 0 !important; }
  }
  a { text-decoration: none; }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:${C.page};">${preheader}${spacer}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background:${C.page};">
  <tr>
    <td align="center" class="hau-outer" style="padding:40px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;font-family:${FONT};color:${C.ink};">
        <tr>
          <td align="center" style="padding:0 0 28px;">
            <a href="${shopUrl}" style="display:inline-block;text-decoration:none;">
              <img src="${logoUrl}" width="72" height="60" alt="HAU" style="display:block;width:72px;height:60px;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:22px;font-weight:700;letter-spacing:3px;color:${C.ink};">
            </a>
          </td>
        </tr>
        <tr>
          <td class="hau-card" bgcolor="${C.card}" style="background:${C.card};border-radius:20px;padding:44px 44px 40px;">
            ${body}
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:28px 24px 0;font-size:12px;line-height:1.7;color:${C.muted};">
            <p style="margin:0 0 10px;">
              <a href="${shopUrl}" style="color:${C.ink};text-decoration:none;font-weight:600;">Sklep</a>
              <span style="color:#c9c9c5;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
              <a href="${shopUrl}/poradniki" style="color:${C.ink};text-decoration:none;font-weight:600;">Poradniki</a>
              <span style="color:#c9c9c5;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
              <a href="${shopUrl}/help" style="color:${C.ink};text-decoration:none;font-weight:600;">Pomoc</a>
            </p>
            ${footer ? `<p style="margin:0 0 10px;">${footer}</p>` : ''}
            <p style="margin:0;color:#b0b0ac;">HAU · e-hau.pl — wszystko dla Twojego psa</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
