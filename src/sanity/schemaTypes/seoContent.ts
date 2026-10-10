import { defineArrayMember, defineField } from 'sanity'

/*
 * Długi opis pod SEO — tekst na DOLE strony kategorii / subkategorii
 * (klient rzadko go czyta, ale Google tak). Ten sam zestaw formatowania,
 * który obsługuje edytor w panelu (components/admin/kit/RichTextEditor.tsx)
 * i renderer w sklepie (components/PortableTextContent.tsx): akapity,
 * nagłówki H2–H3, cytat, listy, pogrubienie/kursywa i linki.
 */
export const seoContentField = (name = 'seoContent', title = 'Opis SEO (na dole strony)') =>
  defineField({
    name,
    title,
    type: 'array',
    description:
      'Dłuższy tekst pod pozycjonowanie — wyświetla się na samym dole strony, pod produktami. Najlepiej 150–400 słów z naturalnymi frazami (np. „zabawki na smakołyki dla psa”).',
    of: [
      defineArrayMember({
        type: 'block',
        styles: [
          { title: 'Akapit', value: 'normal' },
          { title: 'Nagłówek H2', value: 'h2' },
          { title: 'Nagłówek H3', value: 'h3' },
          { title: 'Cytat', value: 'blockquote' },
        ],
        lists: [
          { title: 'Punktory', value: 'bullet' },
          { title: 'Numeracja', value: 'number' },
        ],
        marks: {
          decorators: [
            { title: 'Pogrubienie', value: 'strong' },
            { title: 'Kursywa', value: 'em' },
          ],
          annotations: [
            {
              name: 'link',
              type: 'object',
              title: 'Link',
              fields: [{ name: 'href', type: 'string', title: 'Adres (https://… albo /sciezka)' }],
            },
          ],
        },
      }),
    ],
  })

/** Tytuł i opis do wyników Google (opcjonalne — bez nich sklep składa je sam). */
export const metaFields = () => [
  defineField({
    name: 'metaTitle',
    title: 'Tytuł w Google (opcjonalnie)',
    type: 'string',
    validation: (Rule) => Rule.max(70).warning('Google zwykle obcina tytuły dłuższe niż ~60 znaków.'),
  }),
  defineField({
    name: 'metaDescription',
    title: 'Opis w Google (opcjonalnie)',
    type: 'text',
    rows: 3,
    validation: (Rule) => Rule.max(170).warning('Google zwykle obcina opisy dłuższe niż ~155 znaków.'),
  }),
]
