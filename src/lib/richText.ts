import { sanitizeGuideBody } from '@/lib/guides/content'

/*
 * Sanityzacja tekstu sformatowanego (Portable Text) z panelu — długi opis
 * produktu i opis SEO kategorii. Korzysta z tej samej, przetestowanej
 * sanityzacji co poradniki (bezpieczne linki, poprawne referencje zdjęć,
 * unikalne `_key`), a potem zostawia tylko bloki dozwolone w danym polu.
 */

export const RICH_TEXT_MAX_BLOCKS = 600

export type RichTextResult = { value: Record<string, unknown>[]; dropped: string[] }

export function sanitizeRichText(input: unknown, options: { images?: boolean } = {}): RichTextResult {
  if (input == null) return { value: [], dropped: [] }
  if (Array.isArray(input) && input.length > RICH_TEXT_MAX_BLOCKS) {
    throw new Error(`Opis jest zbyt długi (${input.length} bloków, limit ${RICH_TEXT_MAX_BLOCKS}).`)
  }
  const { body, dropped } = sanitizeGuideBody(input)
  const allowed = new Set(options.images ? ['block', 'image'] : ['block'])
  const value: Record<string, unknown>[] = []
  for (const block of body) {
    if (allowed.has(String(block._type))) value.push(block)
    else dropped.push(`nieobsługiwany blok „${String(block._type)}”`)
  }
  return { value, dropped }
}

/** Czy treść ma jakikolwiek tekst (pusty edytor = brak opisu). */
export function hasRichText(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.some((block) => {
    if (!block || typeof block !== 'object') return false
    const b = block as { _type?: string; children?: Array<{ text?: unknown }> }
    if (b._type === 'image') return true
    return b._type === 'block' && Array.isArray(b.children) && b.children.some((c) => typeof c?.text === 'string' && c.text.trim())
  })
}
