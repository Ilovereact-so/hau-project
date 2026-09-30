import { BookIcon, HelpCircleIcon, StackCompactIcon, TagIcon } from '@sanity/icons'
import type {StructureResolver} from 'sanity/structure'

// Typy obsługiwane przez własne pozycje niżej — nie mogą dublować się w
// automatycznej liście "reszta", bo admin dostałby dwa wejścia do tego samego
// zbioru dokumentów (jedno pogrupowane, jedno luzem).
// `homeLayout` edytuje się wyłącznie w panelu (/admin/home) — reguły karuzel z podglądem.
const HANDLED_TYPES = ['category', 'collection', 'guide', 'guideCategory', 'helpDocument', 'homeLayout']

// https://www.sanity.io/docs/structure-builder-cheat-sheet
export const structure: StructureResolver = (S) =>
  S.list()
    .title('Hau_store Backend')
    .items([
      S.documentTypeListItem('category').title('Categories').icon(TagIcon),
      S.documentTypeListItem('collection').title('Kolekcje').icon(StackCompactIcon),
      S.divider(),
      // Poradniki mają własną sekcję, oddzieloną od katalogu produktów —
      // to jest ta "osobna część w Sanity": wpisy i ich kategorie leżą razem,
      // ale nie mieszają się z kategoriami sklepu.
      S.listItem()
        .title('Poradniki')
        .icon(BookIcon)
        .child(
          S.list()
            .title('Poradniki')
            .items([
              S.documentTypeListItem('guide')
                .title('Wszystkie poradniki')
                .icon(BookIcon),
              S.documentTypeListItem('guideCategory')
                .title('Kategorie poradników')
                .icon(TagIcon),
            ]),
        ),
      S.documentTypeListItem('helpDocument')
        .title('Centrum pomocy')
        .icon(HelpCircleIcon),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => item.getId() && !HANDLED_TYPES.includes(item.getId()!),
      ),
    ])
