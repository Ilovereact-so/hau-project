import { getAllHelpDocuments } from '@/sanity/helpers'
import { HELP_DOCUMENTS } from '@/constants'

export type HelpNavItem = {
    title: string
    slug: string
    /** Czy dokument ma już treść w Sanity (false = strona pokaże "w przygotowaniu"). */
    hasContent: boolean
}

/**
 * Scala kanoniczną listę z `constants` (te 5 dokumentów jest z góry znane i
 * podlinkowane w stopce) z tym, co faktycznie istnieje w Sanity.
 *
 * Dzięki temu:
 *  - linki działają zanim admin cokolwiek doda (hasContent === false → strona
 *    renderuje stan "w przygotowaniu" zamiast 404),
 *  - tytuł z Sanity nadpisuje ten ze stałej, gdy admin go zmieni,
 *  - dokumenty dodane w Studio POZA kanoniczną piątką i tak pojawiają się na
 *    liście — bez ruszania kodu. To jest ta część "systemu umożliwiającego
 *    przejście" na pełną edycję z panelu.
 */
export async function getHelpNavigation(): Promise<HelpNavItem[]> {
    const docs = await getAllHelpDocuments()
    const bySlug = new Map(docs.map((d) => [d.slug, d]))

    const canonical: HelpNavItem[] = HELP_DOCUMENTS.map((link) => ({
        title: bySlug.get(link.slug)?.title ?? link.title,
        slug: link.slug,
        hasContent: bySlug.has(link.slug),
    }))

    const canonicalSlugs = new Set(HELP_DOCUMENTS.map((l) => l.slug))
    const extra: HelpNavItem[] = docs
        .filter((d) => !canonicalSlugs.has(d.slug))
        .map((d) => ({ title: d.title, slug: d.slug, hasContent: true }))

    return [...canonical, ...extra]
}
