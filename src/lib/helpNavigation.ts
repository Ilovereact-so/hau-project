import { getAllHelpDocuments } from '@/sanity/helpers'
import { HELP_DOCUMENTS, HELP_GROUPS, type HelpGroupId } from '@/constants'

export type HelpNavItem = {
    title: string
    slug: string
    /** Czy dokument ma już treść w Sanity (false = strona pokaże "w przygotowaniu"). */
    hasContent: boolean
    /** `lead` z Sanity, a gdy go nie ma — opis ze stałej HELP_DOCUMENTS. */
    description?: string
    group: HelpGroupId
}

export type HelpNavGroup = {
    id: HelpGroupId
    title: string
    items: HelpNavItem[]
}

/**
 * Scala kanoniczną listę z `constants` (te dokumenty są z góry znane i
 * podlinkowane w stopce) z tym, co faktycznie istnieje w Sanity.
 *
 * Dzięki temu:
 *  - linki działają zanim admin cokolwiek doda (hasContent === false → strona
 *    renderuje stan "w przygotowaniu" zamiast 404),
 *  - tytuł i wstęp z Sanity nadpisują te ze stałej, gdy admin je zmieni,
 *  - dokumenty dodane w Studio POZA listą kanoniczną i tak pojawiają się na
 *    liście (w grupie „Pozostałe dokumenty”) — bez ruszania kodu.
 */
export async function getHelpNavigation(): Promise<HelpNavItem[]> {
    const docs = await getAllHelpDocuments()
    const bySlug = new Map(docs.map((d) => [d.slug, d]))

    const canonical: HelpNavItem[] = HELP_DOCUMENTS.map((link) => {
        const doc = bySlug.get(link.slug)
        return {
            title: doc?.title ?? link.title,
            slug: link.slug,
            hasContent: Boolean(doc),
            description: doc?.lead?.trim() || link.description,
            group: link.group,
        }
    })

    const canonicalSlugs = new Set(HELP_DOCUMENTS.map((l) => l.slug))
    const extra: HelpNavItem[] = docs
        .filter((d) => !canonicalSlugs.has(d.slug))
        .map((d) => ({
            title: d.title,
            slug: d.slug,
            hasContent: true,
            description: d.lead?.trim() || undefined,
            group: 'inne' as const,
        }))

    return [...canonical, ...extra]
}

/**
 * Dokumenty pogrupowane wg HELP_GROUPS (puste grupy pominięte). Kolejność
 * w grupie = kolejność z HELP_DOCUMENTS, a dla dodatkowych — `order` z Sanity.
 */
export function groupHelpNavigation(items: HelpNavItem[]): HelpNavGroup[] {
    return HELP_GROUPS.map((group) => ({
        ...group,
        items: items.filter((item) => item.group === group.id),
    })).filter((group) => group.items.length > 0)
}

/**
 * Kolejność „czytania” — ta sama, w której dokumenty stoją na /help i w
 * sidebarze. Z niej biorą się linki „Poprzedni / Następny” pod dokumentem.
 */
export function flattenHelpNavigation(items: HelpNavItem[]): HelpNavItem[] {
    return groupHelpNavigation(items).flatMap((group) => group.items)
}
